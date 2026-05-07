// editor_render.js
window.Editor = window.Editor || {};

Editor.renderEditor = function(timestamp = 0) {
    const canvas = Editor.canvas;
    const ctx = Editor.ctx;
    canvas.width = Editor.wrapper.clientWidth;
    canvas.height = Editor.wrapper.clientHeight;
    if (canvas.width === 0 || canvas.height === 0) return;

    Editor.clearSelectionIfGridHidden();

    let blinkValue = 0.15;
    if (Editor.selectedTile && Editor.isGridVisible()) {
        if (!Editor.selectionStartTime) Editor.selectionStartTime = timestamp;
        const period = 1500;
        const elapsed = timestamp - Editor.selectionStartTime;
        blinkValue = 0.15 + 0.2 * Math.sin(2 * Math.PI * ((elapsed % period) / period + 0.25));
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(Editor.view.offsetX, Editor.view.offsetY);
    ctx.scale(Editor.view.scale, Editor.view.scale);

    const cell = Editor.BASE_CELL_SIZE;
    const visible = Editor.getVisibleTileRange();
    const worldW = Editor.getWorldWidth(), worldH = Editor.getWorldHeight();

    // 地形底色 (使用地表颜色表)
    const surfaceType = Editor.mapData.surfaceType || 'default';
    const landColor = (Editor.surfaceColors && Editor.surfaceColors[surfaceType]) ? Editor.surfaceColors[surfaceType] : '#3a6b4f';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (tile.terrain === 'land' || tile.terrain === 'mountain') {
                ctx.fillStyle = landColor;
            } else {
                ctx.fillStyle = '#2a6090';
            }
            ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }

    // 势力半透明覆盖
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (!tile.owner) continue;
            const faction = Editor.mapData.factions.find(f => f.id === tile.owner);
            if (!faction) continue;
            ctx.fillStyle = faction.color + '80';
            ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }

    // 城市 (菱形)
    const citySize = cell / 1.4;
    ctx.save();
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (!tile.city) continue;
            const x = c * cell + cell/2, y = r * cell + cell/2;
            let cityColor = '#888888';
            if (tile.owner) {
                const faction = Editor.mapData.factions.find(f => f.id === tile.owner);
                if (faction) cityColor = faction.color;
            }
            ctx.translate(x, y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = cityColor;
            ctx.beginPath(); ctx.rect(-citySize/2, -citySize/2, citySize, citySize); ctx.fill();
            ctx.setTransform(1,0,0,1,0,0);
            ctx.translate(Editor.view.offsetX, Editor.view.offsetY); ctx.scale(Editor.view.scale, Editor.view.scale);
        }
    }
    ctx.restore();

    // 山地三角形
    Editor.drawMountains(ctx, visible);

    // 城市名
    Editor.drawCityNames(ctx, visible);

    // 单位
    Editor.drawUnits(ctx, visible);

    // 矩形预览
    if (Editor.paintMode === 'rect' && Editor.rectStart && Editor.rectEnd) {
        const [c1, r1] = [Math.min(Editor.rectStart.col, Editor.rectEnd.col), Math.min(Editor.rectStart.row, Editor.rectEnd.row)];
        const [c2, r2] = [Math.max(Editor.rectStart.col, Editor.rectEnd.col), Math.max(Editor.rectStart.row, Editor.rectEnd.row)];
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(c1 * cell, r1 * cell, (c2 - c1 + 1) * cell, (r2 - r1 + 1) * cell);
    }

    // 选中闪烁
    if (Editor.selectedTile && Editor.isGridVisible()) {
        const { row, col } = Editor.selectedTile;
        ctx.fillStyle = `rgba(255, 255, 255, ${blinkValue})`;
        ctx.fillRect(col * cell, row * cell, cell, cell);
    }

    // 网格
    if (Editor.isGridVisible()) {
        ctx.beginPath();
        ctx.strokeStyle = '#4a5c74';
        ctx.lineWidth = 1 / Editor.view.scale;
        for (let i = 0; i <= Editor.mapData.width; i++) { ctx.moveTo(i*cell,0); ctx.lineTo(i*cell,worldH); }
        for (let i = 0; i <= Editor.mapData.height; i++) { ctx.moveTo(0,i*cell); ctx.lineTo(worldW,i*cell); }
        ctx.stroke();
    }
    ctx.strokeStyle = '#a1b7d4';
    ctx.lineWidth = 2.5 / Editor.view.scale;
    ctx.strokeRect(0, 0, worldW, worldH);
    ctx.restore();

    Editor.updateUI();
    if ((Editor.selectedTile && Editor.isGridVisible()) || (Editor.paintMode === 'rect' && Editor.rectStart && Editor.rectEnd)) {
        Editor.animationFrame = requestAnimationFrame(Editor.renderEditor);
    } else {
        Editor.animationFrame = null;
    }
};

Editor.drawUnits = function(ctx, visible) {
    const cell = Editor.BASE_CELL_SIZE;
    const gridVisible = Editor.isGridVisible();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (!tile.unit) continue;
            const unit = tile.unit;
            const x = c * cell + cell/2, y = r * cell + cell/2;
            let outerColor, outerRadius, innerRadius;
            if (gridVisible) {
                outerColor = '#4caf50';
                outerRadius = cell * 0.4;
                innerRadius = outerRadius * 0.7;
            } else {
                outerColor = '#ffffff';
                outerRadius = cell * 0.3;
                innerRadius = cell * 0.25;
            }
            ctx.beginPath(); ctx.arc(x, y, outerRadius, 0, 2*Math.PI); ctx.fillStyle = outerColor; ctx.fill();
            const faction = Editor.mapData.factions.find(f => f.id === unit.owner);
            const innerColor = faction ? faction.color : '#888';
            ctx.beginPath(); ctx.arc(x, y, innerRadius, 0, 2*Math.PI); ctx.fillStyle = innerColor; ctx.fill();
        }
    }
    ctx.restore();
};

Editor.drawMountains = function(ctx, visible) {
    const cell = Editor.BASE_CELL_SIZE;
    ctx.save();
    ctx.fillStyle = '#555';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (tile.terrain !== 'mountain') continue;
            const x = c * cell + cell/2;
            const y = r * cell + cell/2;
            const s = cell * 0.35;
            ctx.beginPath();
            ctx.moveTo(x, y - s);
            ctx.lineTo(x + s, y + s);
            ctx.lineTo(x - s, y + s);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
};

Editor.drawCityNames = function(ctx, visible) {
    const cell = Editor.BASE_CELL_SIZE;
    const gridVisible = Editor.isGridVisible();
    if (!gridVisible) return;
    ctx.save();
    ctx.font = `${Math.max(10, cell * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Editor.mapData.tiles[r][c];
            if (!tile.city || !tile.cityName) continue;
            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2 + cell * 0.32;
            ctx.strokeText(tile.cityName, x, y);
            ctx.fillText(tile.cityName, x, y);
        }
    }
    ctx.restore();
};

Editor.updateUI = function() {
    Editor.ui.mapInfo.textContent = `${Editor.mapData.width} x ${Editor.mapData.height}`;
    Editor.ui.zoomInfo.textContent = Math.round(Editor.view.scale * 100) + '%';
    if (Editor.editMode === 'move') {
        Editor.ui.coordInfo.textContent = Editor.selectedTile ? `${Editor.selectedTile.col}, ${Editor.selectedTile.row}` : '--, --';
    } else {
        Editor.ui.coordInfo.textContent = Editor.mouseCoords ? `${Editor.mouseCoords.col}, ${Editor.mouseCoords.row}` : '--, --';
    }
    const ct = Editor.mapData.factions.find(f => f.id === Editor.currentTurnFactionId);
    Editor.ui.currentTurnFactionLabel.innerHTML = ct ? `当前回合: <span style="color:${ct.color}">${ct.name}</span>` : '';
    Editor.updateEditUnitButton();
    Editor.updateEditCityButton();
};
