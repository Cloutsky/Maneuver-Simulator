// render.js
window.Game = window.Game || {};

Game.drawMap = function(timestamp) {
    if (typeof timestamp !== 'number' || timestamp <= 0) {
        timestamp = performance.now();
    }

    if (!Game.canvas || Game.canvas.width === 0 || Game.canvas.height === 0) return;
    const ctx = Game.ctx;
    if (!Game.offscreenCanvas) Game.buildOffscreenMap();
    Game.clearSelectionIfGridHidden();

    const cur = Game.turnOrder[Game.currentTurnIndex];

    // ---- Selection cache key: skip expensive BFS recomputation when nothing changed ----
    const mainUnit = Game.selectedTile ? Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col]?.unit : null;
    const hasExtra = Game.extraSelectedUnits.length > 0;
    const cacheKey = !Game.selectedTile ? '' :
        `${Game.selectedTile.row},${Game.selectedTile.col}|${Game.extraSelectedUnits.length}|${mainUnit ? (mainUnit.hasMoved?1:0) + '|' + (mainUnit.hasAttacked?1:0) : '|'}|${Game.invaded?1:0}|${Game.aided?1:0}|${Game.produced?1:0}`;
    
    if (Game._lastSelectionCacheKey !== cacheKey) {
        Game._lastSelectionCacheKey = cacheKey;
        Game._cacheValid = false;
    }

    if (Game.inProductionMode) {
        Game.moveRange = [];
        Game.attackTargets = [];
        Game._lastSelectionCacheKey = '';
        Game._cacheValid = false;
    } else if (!Game._cacheValid) {
        if (!hasExtra && Game.selectedTile && mainUnit && mainUnit.owner === cur && !mainUnit.hasAttacked) {
            if (!mainUnit.hasMoved) Game.moveRange = Game.calculateMoveRange(Game.selectedTile.row, Game.selectedTile.col);
            else Game.moveRange = [];
            Game.attackTargets = Game.getUnitAttackTargets(Game.selectedTile.row, Game.selectedTile.col);
        } else {
            Game.moveRange = [];
            Game.attackTargets = [];
        }
        Game._cacheValid = true;
    }
    // ---- End cache key logic ----

    let blinkValue = 0.15;
    if (Game.selectedTile && Game.isGridVisible() && !Game.inProductionMode) {
        if (!Game.selectionStartTime) Game.selectionStartTime = timestamp;
        const period = 1500;
        const elapsed = timestamp - Game.selectionStartTime;
        blinkValue = 0.15 + 0.2 * Math.sin(2 * Math.PI * ((elapsed % period) / period + 0.25));
    }

    ctx.clearRect(0, 0, Game.canvas.width, Game.canvas.height);
    ctx.save();
    ctx.translate(Game.view.offsetX, Game.view.offsetY);
    ctx.scale(Game.view.scale, Game.view.scale);

    const detailScale = Game.getDetailVisibleScale();
    ctx.imageSmoothingEnabled = (Game.view.scale < detailScale);
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(Game.offscreenCanvas, 0, 0, Game.WORLD_WIDTH, Game.WORLD_HEIGHT);

    const cell = Game.BASE_CELL_SIZE;
    const visible = Game.getVisibleTileRange();
    const citySize = cell / 1.4;

    ctx.save();
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (!tile.city) continue;
            const x = c * cell + cell/2, y = r * cell + cell/2;
            let col = '#888';
            if (tile.owner) { const f = Game.mapData.factions.find(f => f.id === tile.owner); if (f) col = f.color; }
            ctx.translate(x, y); ctx.rotate(Math.PI/4); ctx.fillStyle = col;
            ctx.beginPath(); ctx.rect(-citySize/2, -citySize/2, citySize, citySize); ctx.fill();
            ctx.setTransform(1,0,0,1,0,0); ctx.translate(Game.view.offsetX, Game.view.offsetY); ctx.scale(Game.view.scale, Game.view.scale);
        }
    }
    ctx.restore();

    Game.drawMountains(ctx);
    Game.drawMoveRange(ctx);
    Game.drawUnits(ctx);
    Game.drawAttackTargets(ctx);

    if (!Game.inProductionMode) {
        const ji = Game.getJointAttackInfo();
        const totalSelected = 1 + Game.extraSelectedUnits.length;
        if (totalSelected < 3) Game.drawGreenCross(ctx, ji.candidates);
        Game.drawExtraSelection(ctx);
        if (totalSelected >= 3 && ji.jointTargets.length > 0) Game.drawJointAttackMarker(ctx, ji.jointTargets);
    }

    Game.drawProductionCells(ctx);
    Game.drawExhaustedOverlay(ctx);
    Game.drawCessionSelection(ctx);

    if (Game.selectedTile && Game.isGridVisible() && !Game.inProductionMode) {
        ctx.fillStyle = `rgba(255, 255, 255, ${blinkValue})`;
        ctx.fillRect(Game.selectedTile.col * cell, Game.selectedTile.row * cell, cell, cell);
    }

    if (Game.view.scale >= detailScale) {
        ctx.beginPath(); ctx.strokeStyle = '#3a4559'; ctx.lineWidth = 1.2 / Game.view.scale;
        for (let c = visible.startCol; c <= visible.endCol+1; c++) { ctx.moveTo(c*cell, visible.startRow*cell); ctx.lineTo(c*cell, (visible.endRow+1)*cell); }
        for (let r = visible.startRow; r <= visible.endRow+1; r++) { ctx.moveTo(visible.startCol*cell, r*cell); ctx.lineTo((visible.endCol+1)*cell, r*cell); }
        ctx.stroke();
        ctx.strokeStyle = '#a1b7d4'; ctx.lineWidth = 2.5 / Game.view.scale;
        ctx.strokeRect(0, 0, Game.WORLD_WIDTH, Game.WORLD_HEIGHT);
        Game.drawCityNames(ctx);
    }

    ctx.restore();

    Game.updateStats();
    Game.renderFactionLegend();
    Game.updateProductionButtonVisibility();
    Game.updateInfoButtonVisibility();

    // Only schedule RAF for blink animation when NOT dragging
    if (Game.selectedTile && Game.isGridVisible() && !Game.inProductionMode && !Game._isDragging) {
        Game.animationFrame = requestAnimationFrame(Game.drawMap);
    } else {
        Game.animationFrame = null;
    }
};
