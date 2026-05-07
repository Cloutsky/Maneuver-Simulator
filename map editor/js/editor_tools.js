// editor_tools.js
window.Editor = window.Editor || {};

// 编辑/移动模式
Editor.setEditMode = function(mode) {
    Editor.editMode = mode;
    Editor.ui.modeEditBtn.classList.toggle('active', mode === 'edit');
    Editor.ui.modeMoveBtn.classList.toggle('active', mode === 'move');
    Editor.canvas.style.cursor = mode === 'move' ? 'grab' : 'crosshair';
    if (mode === 'move') { Editor.mouseCoords = null; }
    Editor.clearSelectionIfGridHidden();
    if (mode === 'edit') Editor.selectedTile = null;
    Editor.updateEditUnitButton();
    Editor.updateEditCityButton();
    Editor.renderEditor();
};

// 笔刷/矩形模式
Editor.setPaintMode = function(mode) {
    Editor.paintMode = mode;
    Editor.ui.brushModeBtn.classList.toggle('active', mode === 'brush');
    Editor.ui.rectModeBtn.classList.toggle('active', mode === 'rect');
    Editor.ui.brushSizeContainer.style.display = mode === 'brush' ? 'flex' : 'none';
    Editor.rectStart = null;
    Editor.rectEnd = null;
    Editor.renderEditor();
};

// 单格画笔应用
Editor.applyBrushAt = function(col, row) {
    if (col < 0 || col >= Editor.mapData.width || row < 0 || row >= Editor.mapData.height) return;
    const tile = Editor.mapData.tiles[row][col];
    switch (Editor.currentBrush) {
        case 'terrainLand': tile.terrain = 'land'; break;
        case 'terrainSea': tile.terrain = 'sea'; tile.owner = null; tile.city = false; tile.unit = null; break;
        case 'terrainMountain': tile.terrain = 'mountain'; tile.unit = null; break;
        case 'city': if (tile.terrain === 'land') tile.city = true; break;
        case 'eraseCity': tile.city = false; break;
        case 'unit':
            if (tile.terrain === 'land') {
                const owner = tile.owner || (Editor.mapData.factions[0]?.id || null);
                tile.unit = { owner, hp: Editor.HP_MAX, hasMoved: false, hasAttacked: false };
            }
            break;
        case 'eraseUnit': tile.unit = null; break;
        case 'eraseOwner': tile.owner = null; break;
        default:
            if (Editor.currentBrush.startsWith('faction:')) {
                const fid = Editor.currentBrush.split(':')[1];
                if (tile.terrain === 'land' || tile.terrain === 'mountain') {
                    tile.owner = fid;
                    if (tile.unit) tile.unit.owner = fid;
                }
            }
    }
};

// 矩形画笔
Editor.applyBrushRect = function(startCol, startRow, endCol, endRow) {
    const c1 = Math.min(startCol, endCol), c2 = Math.max(startCol, endCol);
    const r1 = Math.min(startRow, endRow), r2 = Math.max(startRow, endRow);
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            Editor.applyBrushAt(c, r);
        }
    }
    Editor.rectStart = null;
    Editor.rectEnd = null;
    Editor.renderEditor();
    Editor.saveState();
};

// 移动模式下点击格子
Editor.handleTileClick = function(col, row) {
    if (Editor.editMode !== 'move') return;
    if (!Editor.isGridVisible()) {
        Editor.selectedTile = null;
        Editor.renderEditor();
        return;
    }
    if (Editor.selectedTile && Editor.selectedTile.col === col && Editor.selectedTile.row === row) {
        Editor.selectedTile = null;
        Editor.selectionStartTime = 0;
        if (Editor.animationFrame) { cancelAnimationFrame(Editor.animationFrame); Editor.animationFrame = null; }
    } else {
        Editor.selectedTile = { col, row };
        Editor.selectionStartTime = 0;
        if (Editor.animationFrame) cancelAnimationFrame(Editor.animationFrame);
        Editor.animationFrame = requestAnimationFrame(Editor.renderEditor);
    }
    Editor.renderEditor();
    Editor.saveState();
};

// 全屏切换
Editor.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
};

Editor.updateFullscreenButton = function() {
    Editor.ui.toggleFullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
};
