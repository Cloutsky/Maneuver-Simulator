// render_utils.js
window.Game = window.Game || {};

Game.drawUnits = function(ctx, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const showHP = opts.showUnitHP !== undefined ? opts.showUnitHP : true;
    const outerColorOverride = opts.outerColor || null;
    const visible = opts.visible || Game.getVisibleTileRange();
    const cur = opts.cur || Game.turnOrder[Game.currentTurnIndex];
    const gv = opts.gridVisible !== undefined ? opts.gridVisible : Game.isGridVisible();

    const curFaction = Game.mapData.factions.find(f => f.id === cur);
    const curCamp = curFaction ? curFaction.camp : '';

    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (!tile.unit) continue;
            const unit = tile.unit;
            const x = c * cell + cell/2, y = r * cell + cell/2;
            let oc, or, ir;
            if (gv) {
                if (outerColorOverride) {
                    oc = outerColorOverride;
                } else {
                    const unitFaction = Game.mapData.factions.find(f => f.id === unit.owner);
                    const unitCamp = unitFaction ? unitFaction.camp : '';
                    const isAlly = (curCamp && unitCamp && curCamp === unitCamp);
                    const isOwn = unit.owner === cur;
                    oc = (isOwn || isAlly) ? '#4caf50' : '#f44336';
                }
                or = cell * 0.4; ir = or * 0.7;
            } else {
                oc = outerColorOverride || '#fff'; or = cell * 0.3; ir = cell * 0.25;
            }
            ctx.beginPath(); ctx.arc(x, y, or, 0, 2*Math.PI); ctx.fillStyle = oc; ctx.fill();
            if (gv && showHP) {
                const lost = 1 - unit.hp / Game.HP_MAX;
                if (lost > 0.001) {
                    const sa = -Math.PI/2, ea = sa + 2*Math.PI*lost;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, or, sa, ea); ctx.fillStyle = '#000'; ctx.fill();
                }
            }
            const f = Game.mapData.factions.find(f => f.id === unit.owner);
            ctx.beginPath(); ctx.arc(x, y, ir, 0, 2*Math.PI); ctx.fillStyle = f ? f.color : '#888'; ctx.fill();
        }
    }
    ctx.restore();
};

Game.drawMoveRange = function(ctx, opts = {}) {
    if (Game.moveRange.length === 0) return;
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const rad = cell * 0.35;
    ctx.save();
    for (const { row, col, isInvasion, isAid } of Game.moveRange) {
        const x = col * cell + cell/2;
        const y = row * cell + cell/2;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 2 * Math.PI);
        if (isAid) {
            ctx.fillStyle = 'rgba(0, 200, 0, 0.5)';
        } else if (isInvasion) {
            ctx.fillStyle = 'rgba(255, 80, 80, 0.5)';
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        }
        ctx.fill();
    }
    ctx.restore();
};

Game.drawAttackTargets = function(ctx, opts = {}) {
    if (Game.attackTargets.length === 0) return;
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const half = cell * 0.35;
    ctx.save(); ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)'; ctx.lineWidth = 2.5 / (opts.scale || Game.view.scale);
    for (const { row, col } of Game.attackTargets) {
        const cx = col * cell + cell/2, cy = row * cell + cell/2;
        ctx.beginPath(); ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy + half);
        ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx - half, cy + half); ctx.stroke();
    }
    ctx.restore();
};

Game.drawGreenCross = function(ctx, candidates, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const half = cell * 0.3;
    ctx.save(); ctx.strokeStyle = 'rgba(0, 200, 0, 0.8)'; ctx.lineWidth = 3 / (opts.scale || Game.view.scale);
    for (const { row, col } of candidates) {
        const x = col * cell + cell/2, y = row * cell + cell/2;
        ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y);
        ctx.moveTo(x, y - half); ctx.lineTo(x, y + half); ctx.stroke();
    }
    ctx.restore();
};

Game.drawExtraSelection = function(ctx, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (const { row, col } of Game.extraSelectedUnits) ctx.fillRect(col * cell, row * cell, cell, cell);
};

Game.drawJointAttackMarker = function(ctx, targets, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const half = cell * 0.35;
    ctx.save(); ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; ctx.lineWidth = 3.5 / (opts.scale || Game.view.scale);
    for (const { row, col } of targets) {
        const cx = col * cell + cell/2, cy = row * cell + cell/2;
        ctx.beginPath(); ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy + half);
        ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx - half, cy + half); ctx.stroke();
    }
    ctx.restore();
};

Game.drawProductionCells = function(ctx, opts = {}) {
    if (!Game.inProductionMode || Game.productionCells.length === 0) return;
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const half = cell * 0.3;
    ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3 / (opts.scale || Game.view.scale);
    for (const { row, col } of Game.productionCells) {
        const x = col * cell + cell/2, y = row * cell + cell/2;
        ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y);
        ctx.moveTo(x, y - half); ctx.lineTo(x, y + half); ctx.stroke();
    }
    ctx.restore();
};

Game.drawExhaustedOverlay = function(ctx, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const visible = opts.visible || Game.getVisibleTileRange();
    const cur = opts.cur || Game.turnOrder[Game.currentTurnIndex];
    ctx.save(); ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; const rad = cell * 0.3;
    for (let r = visible.startRow; r <= visible.endRow; r++)
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const unit = Game.mapData.tiles[r][c]?.unit;
            if (!unit || unit.owner !== cur) continue;
            if (unit.hasAttacked || (unit.hasMoved && !unit.hasAttacked && Game.getUnitAttackTargets(r, c).length === 0)) {
                ctx.beginPath(); ctx.arc(c*cell+cell/2, r*cell+cell/2, rad, 0, 2*Math.PI); ctx.fill();
            }
        }
    ctx.restore();
};

Game.drawMountains = function(ctx, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const visible = opts.visible || Game.getVisibleTileRange();
    ctx.save();
    ctx.fillStyle = '#555';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.terrain !== 'mountain') continue;
            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2;
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

Game.drawCityNames = function(ctx, opts = {}) {
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    const visible = opts.visible || Game.getVisibleTileRange();
    if (!Game.isGridVisible() && !opts.force) return;
    if (!Game.SHOW_CITY_NAMES && !opts.force) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let r = visible.startRow; r <= visible.endRow; r++) {
        for (let c = visible.startCol; c <= visible.endCol; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (!tile.city || !tile.cityName) continue;
            const name = tile.cityName;
            const baseSize = cell * 0.3;
            const extraChars = Math.max(0, name.length - 2);
            const fontSize = Math.max(cell * 0.14, baseSize - cell * 0.03 * extraChars);
            ctx.font = `bold ${Math.round(fontSize)}px "SimHei", "Microsoft YaHei", "黑体", sans-serif`;
            const x = c * cell + cell / 2;
            const y = (r + 1) * cell - fontSize / 2;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = Math.max(2, fontSize * 0.18);
            ctx.strokeText(name, x, y);
            ctx.fillStyle = '#fff';
            ctx.fillText(name, x, y);
        }
    }
    ctx.restore();
};

Game.drawCessionSelection = function(ctx, opts = {}) {
    if (!Game.cessionMode || Game.cessionSelectedTiles.length === 0) return;
    const cell = opts.cell || Game.BASE_CELL_SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
    for (const { row, col } of Game.cessionSelectedTiles) {
        ctx.fillRect(col * cell, row * cell, cell, cell);
    }
    ctx.restore();
};

Game.clearSelectionIfGridHidden = function() {
    if (!Game.isGridVisible() && Game.selectedTile) {
        Game.selectedTile = null;
        Game.extraSelectedUnits = [];
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.selectionStartTime = 0;
        if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
        Game.drawMap();
    }
};

Game.getVisibleTileRange = function() {
    const tl = Game.screenToWorld(0, 0);
    const br = Game.screenToWorld(Game.canvas.width, Game.canvas.height);
    return {
        startCol: Math.max(0, Math.floor(tl.x / Game.BASE_CELL_SIZE)),
        startRow: Math.max(0, Math.floor(tl.y / Game.BASE_CELL_SIZE)),
        endCol: Math.min(Game.mapData.width-1, Math.ceil(br.x / Game.BASE_CELL_SIZE)),
        endRow: Math.min(Game.mapData.height-1, Math.ceil(br.y / Game.BASE_CELL_SIZE))
    };
};
