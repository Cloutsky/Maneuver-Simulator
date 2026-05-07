// editor_input.js
window.Editor = window.Editor || {};

Editor.initInputEvents = function() {
    const canvas = Editor.canvas;
    canvas.addEventListener('mousedown', Editor.onPointerDown);
    window.addEventListener('mousemove', Editor.onPointerMove);
    window.addEventListener('mouseup', Editor.onPointerUp);
    canvas.addEventListener('wheel', Editor.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('touchstart', Editor.onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', Editor.onPointerMove, { passive: false });
    canvas.addEventListener('touchend', Editor.onPointerUp);
    canvas.addEventListener('touchcancel', Editor.onPointerUp);
};

Editor.getEventCoords = function(e) {
    const rect = Editor.canvas.getBoundingClientRect();
    const scaleX = Editor.canvas.width / rect.width;
    const scaleY = Editor.canvas.height / rect.height;
    let cx, cy;
    if (e.touches) {
        if (e.touches.length === 0) return null;
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
    } else {
        cx = e.clientX;
        cy = e.clientY;
    }
    const screenX = (cx - rect.left) * scaleX;
    const screenY = (cy - rect.top) * scaleY;
    const world = Editor.screenToWorld(screenX, screenY);
    const col = Math.floor(world.x / Editor.BASE_CELL_SIZE);
    const row = Math.floor(world.y / Editor.BASE_CELL_SIZE);
    return { col, row, screenX, screenY };
};

Editor.getTouchDistance = function(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
};

Editor.getTouchCenter = function(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
};

Editor.getCanvasCoordsFromTouchCenter = function(center) {
    const rect = Editor.canvas.getBoundingClientRect();
    return {
        x: (center.x - rect.left) * (Editor.canvas.width / rect.width),
        y: (center.y - rect.top) * (Editor.canvas.height / rect.height)
    };
};

Editor.onPointerDown = function(e) {
    e.preventDefault();
    if (e.touches && e.touches.length === 2) {
        Editor.isPanning = true;
        Editor.isDragging = true;
        Editor.lastTouchDist = Editor.getTouchDistance(e.touches);
        Editor.lastTouchCenter = Editor.getTouchCenter(e.touches);
        Editor.canvas.style.cursor = 'grabbing';
        Editor.touchMoved = true;
        Editor.isTap = false;
        return;
    }
    const coords = Editor.getEventCoords(e);
    if (!coords) return;
    if (Editor.editMode === 'move' || e.button === 1 || e.button === 2) {
        Editor.isPanning = true;
        Editor.isDragging = true;
        Editor.lastMouseX = coords.screenX;
        Editor.lastMouseY = coords.screenY;
        Editor.canvas.style.cursor = 'grabbing';
        if (e.touches) {
            Editor.touchStartCoord = { x: coords.screenX, y: coords.screenY };
            Editor.isTap = true;
            Editor.touchMoved = false;
        }
    } else {
        if (Editor.paintMode === 'rect') {
            Editor.rectStart = { col: coords.col, row: coords.row };
            Editor.rectEnd = null;
            Editor.isPanning = false;
            Editor.isDragging = true;
        } else {
            Editor.isPanning = false;
            Editor.isDragging = true;
            Editor.applyBrushAt(coords.col, coords.row);
            Editor.renderEditor();
            if (!e.touches) Editor.mouseCoords = { col: coords.col, row: coords.row };
        }
    }
};

Editor.onPointerMove = function(e) {
    e.preventDefault();
    if (e.touches && e.touches.length === 2) {
        const dist = Editor.getTouchDistance(e.touches);
        const center = Editor.getTouchCenter(e.touches);
        const canvasCenter = Editor.getCanvasCoordsFromTouchCenter(center);
        if (Editor.lastTouchDist > 0) Editor.touchZoom(dist / Editor.lastTouchDist, canvasCenter.x, canvasCenter.y);
        Editor.lastTouchDist = dist;
        Editor.lastTouchCenter = center;
        Editor.touchMoved = true;
        Editor.isTap = false;
        return;
    }
    const coords = Editor.getEventCoords(e);
    if (!coords) return;
    if (Editor.editMode === 'edit' && !e.touches) {
        Editor.mouseCoords = { col: coords.col, row: coords.row };
    } else if (Editor.editMode === 'edit' && e.touches && Editor.isDragging && Editor.paintMode === 'brush') {
        Editor.mouseCoords = { col: coords.col, row: coords.row };
    }

    if (Editor.isDragging) {
        if (Editor.isPanning) {
            const dx = coords.screenX - Editor.lastMouseX;
            const dy = coords.screenY - Editor.lastMouseY;
            Editor.view.offsetX += dx;
            Editor.view.offsetY += dy;
            Editor.lastMouseX = coords.screenX;
            Editor.lastMouseY = coords.screenY;
            Editor.clampOffset();
            Editor.renderEditor();
            if (e.touches && Editor.touchStartCoord &&
                Math.hypot(coords.screenX - Editor.touchStartCoord.x, coords.screenY - Editor.touchStartCoord.y) > 10) {
                Editor.isTap = false;
                Editor.touchMoved = true;
            }
        } else {
            if (Editor.paintMode === 'rect') {
                Editor.rectEnd = { col: coords.col, row: coords.row };
                Editor.renderEditor();
            } else {
                Editor.applyBrushAt(coords.col, coords.row);
                Editor.renderEditor();
            }
        }
    }
};

Editor.onPointerUp = function(e) {
    e.preventDefault();
    if (Editor.editMode === 'edit' && Editor.paintMode === 'rect' && Editor.rectStart && Editor.rectEnd) {
        Editor.applyBrushRect(Editor.rectStart.col, Editor.rectStart.row, Editor.rectEnd.col, Editor.rectEnd.row);
        Editor.rectStart = null;
        Editor.rectEnd = null;
    }
    if (Editor.editMode === 'edit') {
        Editor.mouseCoords = null;
        if (Editor.paintMode === 'brush') Editor.saveState();
    }
    if (e.touches && e.touches.length < 2) {
        if (Editor.isPanning && Editor.isTap && !Editor.touchMoved && Editor.touchStartCoord) {
            const world = Editor.screenToWorld(Editor.touchStartCoord.x, Editor.touchStartCoord.y);
            const col = Math.floor(world.x / Editor.BASE_CELL_SIZE);
            const row = Math.floor(world.y / Editor.BASE_CELL_SIZE);
            if (row >= 0 && row < Editor.mapData.height && col >= 0 && col < Editor.mapData.width) {
                Editor.handleTileClick(col, row);
            }
        }
    } else if (!e.touches) {
        if (Editor.isDragging && Editor.isPanning) {
            const coords = Editor.getEventCoords(e);
            if (coords && Math.abs(coords.screenX - Editor.lastMouseX) < 5 && Math.abs(coords.screenY - Editor.lastMouseY) < 5) {
                Editor.handleTileClick(coords.col, coords.row);
            }
        }
    }
    Editor.isDragging = false;
    Editor.isPanning = false;
    Editor.canvas.style.cursor = Editor.editMode === 'move' ? 'grab' : 'crosshair';
    Editor.touchStartCoord = null;
    Editor.isTap = false;
    Editor.touchMoved = false;
};

Editor.onWheel = function(e) {
    e.preventDefault();
    const rect = Editor.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (Editor.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (Editor.canvas.height / rect.height);
    const delta = -Math.sign(e.deltaY) * 0.1;
    Editor.scheduleWheelZoom(1 + delta, sx, sy);
};