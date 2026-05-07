// gameLogic.js
window.Game = window.Game || {};

Game.endTurn = function() {
    const curId = Game.turnOrder[Game.currentTurnIndex];
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const unit = Game.mapData.tiles[r][c].unit;
            if (unit && unit.owner === curId) {
                unit.hasMoved = false;
                unit.hasAttacked = false;
            }
        }
    }
    Game.currentTurnIndex = (Game.currentTurnIndex + 1) % Game.turnOrder.length;
    if (Game.currentTurnIndex === 0) Game.currentRound++;
    Game.invaded = false;
    Game.produced = false;
    Game.aided = false;
    Game.recalcProductionLimits();
    Game.exitProductionMode();
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.extraSelectedUnits = [];
    Game.clearLastCommand();
    Game._lastSelectionCacheKey = '';
    Game._cacheValid = false;
    Game.updateMountainControl();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};

Game.handleTileClick = function(col, row) {
    if (Game.cessionMode) {
        Game.toggleCessionTile(row, col);
        return;
    }
    if (!Game.isGridVisible()) {
        Game.selectedTile = null;
        Game.extraSelectedUnits = [];
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.drawMap();
        return;
    }
    if (Game.inProductionMode) {
        const cell = Game.productionCells.find(p => p.col === col && p.row === row);
        if (cell) {
            Game.produceUnit(row, col);
            return;
        } else {
            Game.exitProductionMode();
        }
    }

    const cur = Game.turnOrder[Game.currentTurnIndex];
    const ji = Game.getJointAttackInfo();

    if (ji.jointTargets.length > 0 && ji.currentSet.length >= 3) {
        if (ji.jointTargets.some(p => p.col === col && p.row === row)) {
            Game.jointAttack(row, col);
            return;
        }
    }
    if (ji.candidates.some(p => p.col === col && p.row === row) && !Game.extraSelectedUnits.some(p => p.col === col && p.row === row)) {
        if (ji.currentSet.length < 3 && Game.selectedTile) {
            Game.extraSelectedUnits.push({ row, col });
            Game.drawMap(); Game.saveGameState(); return;
        }
    }
    if (Game.extraSelectedUnits.some(p => p.col === col && p.row === row)) {
        Game.extraSelectedUnits = Game.extraSelectedUnits.filter(p => !(p.col === col && p.row === row));
        Game.drawMap(); Game.saveGameState(); return;
    }
    if (Game.selectedTile && Game.selectedTile.col === col && Game.selectedTile.row === row) {
        Game.selectedTile = null;
        Game.extraSelectedUnits = [];
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.selectionStartTime = 0;
        if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
        Game._lastSelectionCacheKey = '';
        Game._cacheValid = false;
        Game.drawMap(); Game.saveGameState(); return;
    }
    if (Game.extraSelectedUnits.length > 0) {
        Game.extraSelectedUnits = [];
        Game.selectedTile = { col, row };
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.selectionStartTime = 0;
        Game._lastSelectionCacheKey = '';
        Game._cacheValid = false;
        const unit = Game.mapData.tiles[row]?.[col]?.unit;
        if (unit && unit.owner === cur) {
            if (!unit.hasMoved && !unit.hasAttacked) Game.moveRange = Game.calculateMoveRange(row, col);
            if (!unit.hasAttacked) Game.attackTargets = Game.getUnitAttackTargets(row, col);
        }
        if (Game.animationFrame) cancelAnimationFrame(Game.animationFrame);
        Game.animationFrame = requestAnimationFrame(Game.drawMap);
        Game.drawMap();
        Game.saveGameState();
        return;
    }
    
    const clickedUnit = Game.mapData.tiles[row]?.[col]?.unit;
    if (clickedUnit && clickedUnit.owner === cur && !(Game.selectedTile && Game.selectedTile.col === col && Game.selectedTile.row === row)) {
        Game.selectedTile = { col, row };
        Game.extraSelectedUnits = [];
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.selectionStartTime = 0;
        Game._lastSelectionCacheKey = '';
        Game._cacheValid = false;
        if (!clickedUnit.hasMoved && !clickedUnit.hasAttacked) Game.moveRange = Game.calculateMoveRange(row, col);
        if (!clickedUnit.hasAttacked) Game.attackTargets = Game.getUnitAttackTargets(row, col);
        if (Game.animationFrame) cancelAnimationFrame(Game.animationFrame);
        Game.animationFrame = requestAnimationFrame(Game.drawMap);
        Game.drawMap();
        Game.saveGameState();
        return;
    }

    if (Game.selectedTile) {
        const selUnit = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col]?.unit;
        if (selUnit && selUnit.owner === cur && !selUnit.hasAttacked && Game.attackTargets.some(p => p.col === col && p.row === row)) {
            Game.attackUnit(Game.selectedTile.row, Game.selectedTile.col, row, col);
            return;
        }
        if (selUnit && selUnit.owner === cur && !selUnit.hasMoved && !selUnit.hasAttacked) {
            const targetMove = Game.moveRange.find(p => p.col === col && p.row === row);
            if (targetMove) {
                Game.moveUnit(Game.selectedTile.row, Game.selectedTile.col, row, col);
                return;
            }
        }
    }
    Game.selectedTile = { col, row };
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    Game._lastSelectionCacheKey = '';
    Game._cacheValid = false;
    const unit = Game.mapData.tiles[row]?.[col]?.unit;
    if (unit && unit.owner === cur) {
        if (!unit.hasMoved && !unit.hasAttacked) Game.moveRange = Game.calculateMoveRange(row, col);
        if (!unit.hasAttacked) Game.attackTargets = Game.getUnitAttackTargets(row, col);
    }
    if (Game.animationFrame) cancelAnimationFrame(Game.animationFrame);
    Game.animationFrame = requestAnimationFrame(Game.drawMap);
    Game.drawMap();
    Game.saveGameState();
};
