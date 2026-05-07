// editor_main.js
window.Editor = window.Editor || {};

// 全局状态变量 (由 editor_constants.js 初始化后覆盖)
Editor.mapData = null;
Editor.turnOrder = [];
Editor.currentTurnFactionId = null;
Editor.autosaveEnabled = true;
Editor.view = { offsetX: 0, offsetY: 0, scale: 1.0 };
Editor.selectedFactionId = null;
Editor.selectedTile = null;
Editor.selectionStartTime = 0;
Editor.animationFrame = null;
Editor.zoomFrame = null;
Editor.pendingWheel = null;
Editor.isDragging = false;
Editor.lastMouseX = 0;
Editor.lastMouseY = 0;
Editor.isPanning = false;
Editor.lastTouchDist = 0;
Editor.lastTouchCenter = { x: 0, y: 0 };
Editor.touchStartCoord = null;
Editor.isTap = false;
Editor.touchMoved = false;
Editor.mouseCoords = null;
Editor.paintMode = 'brush';
Editor.rectStart = null;
Editor.rectEnd = null;
Editor.currentBrush = 'terrainLand';
Editor.brushSize = 1;
Editor.editMode = 'edit';

// UI引用缓存 (由 initUIReferences 填充)
Editor.ui = {};

// 初始化状态与UI引用
Editor.initState = function() {
    const mapData = JSON.parse(JSON.stringify(Editor.DEFAULT_MAP));
    Editor.mapData = mapData;
    Editor.turnOrder = mapData.factions.map(f => f.id);
    Editor.currentTurnFactionId = mapData.currentTurnFactionId || mapData.factions[0]?.id || null;
    Editor.canvas = document.getElementById('editorCanvas');
    Editor.ctx = Editor.canvas.getContext('2d');
    Editor.wrapper = document.querySelector('.canvas-wrapper');

    // 填充UI引用
    Editor.ui = {
        coordInfo: document.getElementById('coordInfo'),
        mapInfo: document.getElementById('mapInfo'),
        zoomInfo: document.getElementById('zoomInfo'),
        factionBrushContainer: document.getElementById('factionBrushContainer'),
        brushSizeInput: document.getElementById('brushSize'),
        brushSizeValue: document.getElementById('brushSizeValue'),
        modeEditBtn: document.getElementById('modeEditBtn'),
        modeMoveBtn: document.getElementById('modeMoveBtn'),
        currentFactionLabel: document.getElementById('currentFactionLabel'),
        currentTurnFactionLabel: document.getElementById('currentTurnFactionLabel'),
        manageFactionBtn: document.getElementById('manageFactionBtn'),
        editUnitBtn: document.getElementById('editUnitBtn'),
        editCityBtn: document.getElementById('editCityBtn'),
        surfaceTypeSelect: document.getElementById('surfaceTypeSelect'),
        brushSizeContainer: document.getElementById('brushSizeContainer'),
        brushModeBtn: document.getElementById('brushModeBtn'),
        rectModeBtn: document.getElementById('rectModeBtn'),
        toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
        autosaveCheckbox: document.getElementById('autosaveCheckbox'),
        exportJsonBtn: document.getElementById('exportJsonBtn'),
        importJsonBtn: document.getElementById('importJsonBtn'),
        importFileInput: document.getElementById('importFileInput'),
        resizeMapBtn: document.getElementById('resizeMapBtn'),
        resetViewBtn: document.getElementById('resetViewBtn'),
        clearMapBtn: document.getElementById('clearMapBtn'),
        fillLandBtn: document.getElementById('fillLandBtn'),
        addFactionBtn: document.getElementById('addFactionBtn'),
        editTurnOrderBtn: document.getElementById('editTurnOrderBtn'),
        staticBrushGroup: document.getElementById('staticBrushGroup'),
        mapTitleInput: document.getElementById('mapTitleInput')
    };

    // 初始化标题输入框
    Editor.ui.mapTitleInput.value = Editor.mapData.title || '测试地图';
    Editor.ui.mapTitleInput.addEventListener('input', () => {
        Editor.mapData.title = Editor.ui.mapTitleInput.value.trim() || '测试地图';
    });

    const observer = new ResizeObserver(() => {
        const cvs = Editor.canvas;
        if (cvs.width !== Editor.wrapper.clientWidth || cvs.height !== Editor.wrapper.clientHeight) {
            Editor.renderEditor();
        }
    });
    observer.observe(Editor.wrapper);
};

// 辅助函数
Editor.getWorldWidth = function() { return Editor.mapData.width * Editor.BASE_CELL_SIZE; };
Editor.getWorldHeight = function() { return Editor.mapData.height * Editor.BASE_CELL_SIZE; };
Editor.screenToWorld = function(sx, sy) { return { x: (sx - Editor.view.offsetX) / Editor.view.scale, y: (sy - Editor.view.offsetY) / Editor.view.scale }; };

Editor.clampOffset = function() {
    const worldW = Editor.getWorldWidth(), worldH = Editor.getWorldHeight();
    const screenW = worldW * Editor.view.scale, screenH = worldH * Editor.view.scale;
    const padding = 100;
    Editor.view.offsetX = Math.min(padding, Math.max(Editor.canvas.width - screenW - padding, Editor.view.offsetX));
    Editor.view.offsetY = Math.min(padding, Math.max(Editor.canvas.height - screenH - padding, Editor.view.offsetY));
};

Editor.resetView = function() {
    const worldW = Editor.getWorldWidth(), worldH = Editor.getWorldHeight();
    const scaleX = (Editor.canvas.width - 5) / worldW, scaleY = (Editor.canvas.height - 5) / worldH;
    Editor.view.scale = Math.min(Editor.MAX_SCALE, Math.max(Editor.MIN_SCALE, Math.min(scaleX, scaleY)));
    Editor.view.offsetX = (Editor.canvas.width - worldW * Editor.view.scale) / 2;
    Editor.view.offsetY = (Editor.canvas.height - worldH * Editor.view.scale) / 2;
    Editor.clampOffset();
    Editor.renderEditor();
};

Editor.zoomAtScreenPoint = function(delta, sx, sy) {
    const old = Editor.view.scale;
    let ns = old * delta;
    ns = Math.min(Editor.MAX_SCALE, Math.max(Editor.MIN_SCALE, ns));
    if (ns === old) return;
    const w = Editor.screenToWorld(sx, sy);
    Editor.view.scale = ns;
    Editor.view.offsetX = sx - w.x * ns;
    Editor.view.offsetY = sy - w.y * ns;
    Editor.clampOffset();
    Editor.renderEditor();
};

Editor.scheduleWheelZoom = function(delta, sx, sy) {
    if (!Editor.zoomFrame) {
        Editor.zoomFrame = requestAnimationFrame(() => {
            if (Editor.pendingWheel) {
                Editor.zoomAtScreenPoint(Editor.pendingWheel.delta, Editor.pendingWheel.sx, Editor.pendingWheel.sy);
                Editor.pendingWheel = null;
            }
            Editor.zoomFrame = null;
        });
    }
    Editor.pendingWheel = { delta, sx, sy };
};

Editor.touchZoom = function(factor, sx, sy) { Editor.zoomAtScreenPoint(factor, sx, sy); };

Editor.isGridVisible = function() { return Editor.view.scale >= (Editor.canvas.width < 900 ? 0.75 : 1.0); };

Editor.clearSelectionIfGridHidden = function() {
    if (!Editor.isGridVisible() && Editor.selectedTile !== null) {
        Editor.selectedTile = null;
        Editor.selectionStartTime = 0;
        if (Editor.animationFrame) { cancelAnimationFrame(Editor.animationFrame); Editor.animationFrame = null; }
        Editor.updateEditUnitButton();
        Editor.updateEditCityButton();
        Editor.renderEditor();
    }
};

Editor.getVisibleTileRange = function() {
    const tl = Editor.screenToWorld(0, 0), br = Editor.screenToWorld(Editor.canvas.width, Editor.canvas.height);
    return {
        startCol: Math.max(0, Math.floor(tl.x / Editor.BASE_CELL_SIZE)),
        startRow: Math.max(0, Math.floor(tl.y / Editor.BASE_CELL_SIZE)),
        endCol: Math.min(Editor.mapData.width-1, Math.ceil(br.x / Editor.BASE_CELL_SIZE)),
        endRow: Math.min(Editor.mapData.height-1, Math.ceil(br.y / Editor.BASE_CELL_SIZE))
    };
};

// 存档管理
Editor.loadAutosaveSetting = function() {
    try {
        const saved = localStorage.getItem(Editor.AUTOSAVE_KEY);
        if (saved !== null) Editor.autosaveEnabled = saved === 'true';
        Editor.ui.autosaveCheckbox.checked = Editor.autosaveEnabled;
    } catch(e) { Editor.autosaveEnabled = true; }
};

Editor.saveAutosaveSetting = function() {
    try { localStorage.setItem(Editor.AUTOSAVE_KEY, Editor.autosaveEnabled.toString()); } catch(e) {}
};

Editor.saveState = function() {
    if (!Editor.autosaveEnabled) return;
    try {
        const state = {
            mapData: Editor.mapData,
            turnOrder: Editor.turnOrder,
            currentTurnFactionId: Editor.currentTurnFactionId,
            view: Editor.view,
            selectedTile: Editor.selectedTile,
            currentBrush: Editor.currentBrush,
            selectedFactionId: Editor.selectedFactionId
        };
        localStorage.setItem(Editor.SAVE_KEY, JSON.stringify(state));
    } catch(e) {}
};

Editor.loadState = function() {
    if (!Editor.autosaveEnabled) return false;
    try {
        const saved = localStorage.getItem(Editor.SAVE_KEY);
        if (!saved) return false;
        const state = JSON.parse(saved);
        if (!state.mapData || !state.mapData.tiles) return false;
        Editor.mapData = state.mapData;
        Editor.turnOrder = state.turnOrder || Editor.mapData.factions.map(f => f.id);
        Editor.currentTurnFactionId = state.currentTurnFactionId || Editor.mapData.factions[0]?.id || null;
        if (state.view) {
            Editor.view.offsetX = state.view.offsetX || 0;
            Editor.view.offsetY = state.view.offsetY || 0;
            Editor.view.scale = state.view.scale || 1.0;
        }
        Editor.selectedTile = state.selectedTile || null;
        Editor.currentBrush = state.currentBrush || 'terrainLand';
        Editor.selectedFactionId = state.selectedFactionId || null;
        // 更新标题输入框
        if (Editor.ui.mapTitleInput) Editor.ui.mapTitleInput.value = Editor.mapData.title || '测试地图';
        Editor.updateManageButtonState();
        Editor.updateEditUnitButton();
        Editor.renderFactionUI();
        return true;
    } catch(e) { return false; }
};

Editor.exportMapData = function() {
    const data = JSON.parse(JSON.stringify(Editor.mapData));
    data.turnOrder = Editor.turnOrder;
    data.currentTurnFactionId = Editor.currentTurnFactionId;
    return data;
};

Editor.importMapData = function(data) {
    for (let r=0; r<data.height; r++) for (let c=0; c<data.width; c++) {
        if (data.tiles[r][c].city === undefined) data.tiles[r][c].city = false;
        if (data.tiles[r][c].unit === undefined) data.tiles[r][c].unit = null;
        else if (data.tiles[r][c].unit && typeof data.tiles[r][c].unit.hp !== 'number') data.tiles[r][c].unit.hp = Editor.HP_MAX;
        // 确保地形有效
        if (!['land', 'sea', 'mountain'].includes(data.tiles[r][c].terrain)) {
            data.tiles[r][c].terrain = 'land';
        }
    }
    // 确保补全新字段
    if (!data.surfaceType) data.surfaceType = 'default';
    if (!data.factions) data.factions = [];
    data.factions.forEach(f => { if (f.camp === undefined) f.camp = ''; });
    for (let r=0; r<data.height; r++) for (let c=0; c<data.width; c++) {
        if (data.tiles[r][c].cityName === undefined) data.tiles[r][c].cityName = '';
    }
    Editor.mapData = data;
    Editor.turnOrder = data.turnOrder || Editor.mapData.factions.map(f => f.id);
    Editor.currentTurnFactionId = data.currentTurnFactionId || Editor.mapData.factions[0]?.id || null;
    Editor.selectedFactionId = Editor.mapData.factions[0]?.id || null;
    Editor.currentBrush = Editor.selectedFactionId ? `faction:${Editor.selectedFactionId}` : 'terrainLand';
    Editor.selectedTile = null;
    Editor.mouseCoords = null;
    // 更新标题输入框和地表选择
    if (Editor.ui.mapTitleInput) Editor.ui.mapTitleInput.value = Editor.mapData.title || '测试地图';
    if (Editor.ui.surfaceTypeSelect) Editor.ui.surfaceTypeSelect.value = Editor.mapData.surfaceType || 'default';
    Editor.renderFactionUI();
    Editor.resetView();
    Editor.updateManageButtonState();
    Editor.updateEditUnitButton();
    if (Editor.autosaveEnabled) Editor.saveState();
};

Editor.updateManageButtonState = function() { Editor.ui.manageFactionBtn.disabled = (Editor.selectedFactionId === null); };
Editor.updateEditUnitButton = function() {
    if (Editor.editMode === 'move' && Editor.selectedTile && Editor.mapData.tiles[Editor.selectedTile.row]?.[Editor.selectedTile.col]?.unit) {
        Editor.ui.editUnitBtn.disabled = false;
    } else {
        Editor.ui.editUnitBtn.disabled = true;
    }
};
Editor.updateEditCityButton = function() {
    if (Editor.editMode === 'move' && Editor.selectedTile && Editor.mapData.tiles[Editor.selectedTile.row]?.[Editor.selectedTile.col]?.city) {
        Editor.ui.editCityBtn.disabled = false;
    } else {
        Editor.ui.editCityBtn.disabled = true;
    }
};

// 启动入口
Editor.init = function() {
    Editor.initState();
    Editor.loadAutosaveSetting();
    if (!Editor.autosaveEnabled || !Editor.loadState()) {
        Editor.mapData = JSON.parse(JSON.stringify(Editor.DEFAULT_MAP));
        Editor.turnOrder = Editor.mapData.factions.map(f => f.id);
        Editor.currentTurnFactionId = Editor.mapData.currentTurnFactionId || Editor.mapData.factions[0]?.id || null;
        if (Editor.ui.mapTitleInput) Editor.ui.mapTitleInput.value = Editor.mapData.title || '测试地图';
        Editor.renderFactionUI();
        Editor.resetView();
    } else {
        Editor.resetView();
    }
    Editor.setEditMode('edit');
    Editor.setPaintMode('brush');
    Editor.updateFullscreenButton();
    Editor.initInputEvents();
    Editor.initUIEvents();
    setTimeout(() => {
        Editor.canvas.width = Editor.wrapper.clientWidth;
        Editor.canvas.height = Editor.wrapper.clientHeight;
        Editor.renderEditor();
    }, 10);
};

window.addEventListener('DOMContentLoaded', Editor.init);
