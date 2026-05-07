// input.js
window.Game = window.Game || {};

let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;
let dragMoveHandler = null;
let clickStart = null;
let _dragRAF = null; // RAF throttle for doDrag

function startDrag(sx, sy) {
    if (isDragging) return;
    isDragging = true;
    Game._isDragging = true;
    lastMouseX = sx;
    lastMouseY = sy;
    Game.canvas.style.cursor = 'grabbing';

    if (dragMoveHandler) {
        window.removeEventListener('mousemove', dragMoveHandler);
    }
    dragMoveHandler = function(e) {
        e.preventDefault();
        const p = getCanvasCoords(e);
        doDrag(p.x, p.y);
    };
    window.addEventListener('mousemove', dragMoveHandler);
}

function doDrag(sx, sy) {
    if (!isDragging) return;
    Game.view.offsetX += sx - lastMouseX;
    Game.view.offsetY += sy - lastMouseY;
    lastMouseX = sx;
    lastMouseY = sy;
    Game.clampOffset();
    // RAF-throttled draw: avoid flooding render from high-polling-rate mice
    if (!_dragRAF) {
        _dragRAF = requestAnimationFrame(() => {
            _dragRAF = null;
            Game.drawMap();
        });
    }
}

function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    Game._isDragging = false;
    Game.canvas.style.cursor = 'default';
    if (_dragRAF) {
        cancelAnimationFrame(_dragRAF);
        _dragRAF = null;
    }
    if (dragMoveHandler) {
        window.removeEventListener('mousemove', dragMoveHandler);
        dragMoveHandler = null;
    }
    // Ensure a final render to restart blink animation if needed
    Game.drawMap();
}

function getCanvasCoords(e) {
    const rect = Game.canvas.getBoundingClientRect();
    const scaleX = Game.canvas.width / rect.width;
    const scaleY = Game.canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// 触摸变量
let lastTouchDist = 0;
let lastTouchCenter = { x: 0, y: 0 };
let touchStartCoord = null;
let isTap = false;
let touchMoved = false;

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

function getCanvasCoordsFromTouchCenter(center) {
    const rect = Game.canvas.getBoundingClientRect();
    return {
        x: (center.x - rect.left) * (Game.canvas.width / rect.width),
        y: (center.y - rect.top) * (Game.canvas.height / rect.height)
    };
}

Game.initEvents = function() {
    const canvas = Game.canvas;

    // 全局鼠标松开（处理点击与拖拽结束）
    window.addEventListener('mouseup', function(e) {
        if (isDragging) {
            stopDrag();
            e.preventDefault();
            return;
        }
        if (e.button === 0 && clickStart) {
            const current = getCanvasCoords(e);
            const dx = Math.abs(current.x - clickStart.x);
            const dy = Math.abs(current.y - clickStart.y);
            if (dx < 5 && dy < 5) {
                const world = Game.screenToWorld(current.x, current.y);
                const col = Math.floor(world.x / Game.BASE_CELL_SIZE);
                const row = Math.floor(world.y / Game.BASE_CELL_SIZE);
                if (row >= 0 && row < Game.mapData.height && col >= 0 && col < Game.mapData.width) {
                    Game.handleTileClick(col, row);
                }
            }
            clickStart = null;
            e.preventDefault();
        }
    });

    // 左键按下：记录点击起始位置，并监听移动以判断是否进入拖拽
    canvas.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const button = e.button;
        if (button === 0) {
            const p = getCanvasCoords(e);
            clickStart = { x: p.x, y: p.y };
            // 临时移动监听，用于启动拖拽
            function checkDragMove(ev) {
                const cur = getCanvasCoords(ev);
                if (Math.hypot(cur.x - clickStart.x, cur.y - clickStart.y) > 5) {
                    window.removeEventListener('mousemove', checkDragMove);
                    clickStart = null; // 不再触发点击
                    startDrag(p.x, p.y);
                }
            }
            window.addEventListener('mousemove', checkDragMove);
            // 一旦鼠标松开，移除临时监听
            function cleanUp() {
                window.removeEventListener('mousemove', checkDragMove);
                window.removeEventListener('mouseup', cleanUp);
            }
            window.addEventListener('mouseup', cleanUp);
            return;
        }
        if (button === 1 || button === 2) {
            const p = getCanvasCoords(e);
            startDrag(p.x, p.y);
        }
    });

    // 滚轮缩放
    canvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        const p = getCanvasCoords(e);
        const delta = -Math.sign(e.deltaY) * 0.1;
        Game.scheduleWheelZoom(1 + delta, p.x, p.y);
    }, { passive: false });

    // 右键菜单屏蔽
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 触摸事件
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1) {
            const p = getCanvasCoords(e);
            touchStartCoord = { x: p.x, y: p.y };
            isTap = true;
            touchMoved = false;
            startDrag(p.x, p.y);
        } else if (touches.length === 2) {
            isTap = false;
            stopDrag();
            lastTouchDist = getTouchDistance(touches);
            lastTouchCenter = getTouchCenter(touches);
        } else {
            isTap = false;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 1 && isDragging) {
            const p = getCanvasCoords(e);
            if (touchStartCoord && Math.hypot(p.x - touchStartCoord.x, p.y - touchStartCoord.y) > 10) {
                isTap = false;
                touchMoved = true;
            }
            doDrag(p.x, p.y);
        } else if (touches.length === 2) {
            isTap = false;
            touchMoved = true;
            const dist = getTouchDistance(touches);
            const center = getTouchCenter(touches);
            const canvasCenter = getCanvasCoordsFromTouchCenter(center);
            if (lastTouchDist > 0) {
                const factor = dist / lastTouchDist;
                Game.touchZoom(factor, canvasCenter.x, canvasCenter.y);
            }
            lastTouchDist = dist;
            lastTouchCenter = center;
        }
    });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const touches = e.touches;
        if (touches.length === 0) {
            if (isTap && !touchMoved && touchStartCoord) {
                const world = Game.screenToWorld(touchStartCoord.x, touchStartCoord.y);
                const col = Math.floor(world.x / Game.BASE_CELL_SIZE);
                const row = Math.floor(world.y / Game.BASE_CELL_SIZE);
                if (row >= 0 && row < Game.mapData.height && col >= 0 && col < Game.mapData.width) {
                    Game.handleTileClick(col, row);
                }
            }
            stopDrag();
            lastTouchDist = 0;
            isTap = false;
            touchMoved = false;
            touchStartCoord = null;
        } else if (touches.length === 1) {
            const p = getCanvasCoords(e);
            touchStartCoord = { x: p.x, y: p.y };
            isTap = true;
            touchMoved = false;
            startDrag(p.x, p.y);
            lastTouchDist = 0;
        } else if (touches.length === 2) {
            isTap = false;
            touchMoved = true;
            lastTouchDist = getTouchDistance(touches);
            lastTouchCenter = getTouchCenter(touches);
        }
    });

    canvas.addEventListener('touchcancel', function(e) {
        stopDrag();
        lastTouchDist = 0;
        isTap = false;
        touchMoved = false;
        touchStartCoord = null;
    });

    // 键盘快捷键
    window.addEventListener('keydown', function(e) {
        const tag = document.activeElement && document.activeElement.tagName;
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
        if (isEditable) return;

        const key = e.key;

        if (key === 'Enter') {
            e.preventDefault();
            Game.endTurn();
        } else if (key === 'z' || key === 'Z') {
            e.preventDefault();
            Game.undoLastAction();
        } else if (key === 'i' || key === 'I') {
            e.preventDefault();
            Game.showUnitInfoModal();
        } else if (key === 'c' || key === 'C') {
            e.preventDefault();
            if (Game.inProductionMode) {
                Game.exitProductionMode();
            } else {
                Game.enterProductionMode();
            }
        } else if (key === 'x' || key === 'X') {
            e.preventDefault();
            Game.toggleInfoPanel();
        } else if (key === 'Escape') {
            e.preventDefault();
            Game.resetViewToCenter();
        }
    });
};

Game.touchZoom = function(factor, screenX, screenY) {
    if (!Game.zoomFrame) {
        Game.zoomFrame = requestAnimationFrame(() => {
            if (Game.pendingTouch) {
                Game.zoomAtScreenPoint(Game.pendingTouch.factor, Game.pendingTouch.sx, Game.pendingTouch.sy);
                Game.pendingTouch = null;
            }
            if (Game.pendingWheel) {
                Game.zoomAtScreenPoint(Game.pendingWheel.delta, Game.pendingWheel.sx, Game.pendingWheel.sy);
                Game.pendingWheel = null;
            }
            Game.zoomFrame = null;
        });
    }
    Game.pendingTouch = { factor, sx: screenX, sy: screenY };
};

Game.scheduleWheelZoom = function(delta, sx, sy) {
    if (!Game.zoomFrame) {
        Game.zoomFrame = requestAnimationFrame(() => {
            if (Game.pendingWheel) {
                Game.zoomAtScreenPoint(Game.pendingWheel.delta, Game.pendingWheel.sx, Game.pendingWheel.sy);
                Game.pendingWheel = null;
            }
            if (Game.pendingTouch) {
                Game.zoomAtScreenPoint(Game.pendingTouch.factor, Game.pendingTouch.sx, Game.pendingTouch.sy);
                Game.pendingTouch = null;
            }
            Game.zoomFrame = null;
        });
    }
    Game.pendingWheel = { delta, sx, sy };
};
