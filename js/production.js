// production.js
window.Game = window.Game || {};

Game.enterProductionMode = function() {
    if (!Game.selectedTile) return;
    const tile = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col];
    if (!tile || !tile.city || tile.owner !== Game.turnOrder[Game.currentTurnIndex]) return;
    Game.productionTargetCity = { row: Game.selectedTile.row, col: Game.selectedTile.col };
    Game.inProductionMode = true;
    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.productionCells = Game.calculateProductionCells(Game.productionTargetCity.row, Game.productionTargetCity.col);
    Game.updateProductionButtonVisibility();
    Game.drawMap();
    Game.updateFloatingButtonsPosition();
};

Game.exitProductionMode = function() {
    const city = Game.productionTargetCity;
    Game.inProductionMode = false;
    Game.productionTargetCity = null;
    Game.productionCells = [];
    Game.selectedTile = city ? { col: city.col, row: city.row } : null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game._lastSelectionCacheKey = '';
    Game._cacheValid = false;
    Game.updateProductionButtonVisibility();
    Game.drawMap();
    Game.updateFloatingButtonsPosition();
};

Game.produceUnit = function(row, col) {
    if (Game.productionUsed >= Game.productionLimit || Game.invaded || Game.aided) return;
    if (Game.currentPopulation >= Game.populationCap) return;

    const curId = Game.turnOrder[Game.currentTurnIndex];
    const tile = Game.mapData.tiles[row][col];
    if (tile.unit) return;
    tile.unit = { owner: curId, hp: Game.HP_MAX, hasMoved: true, hasAttacked: true };
    Game.productionUsed++;
    Game.currentPopulation++;
    Game.produced = true;
    Game.lastCommand = { type: 'produce', row, col };
    Game.updateUndoButtonVisibility();
    Game.productionCells = Game.calculateProductionCells(Game.productionTargetCity.row, Game.productionTargetCity.col);
    if (Game.productionUsed >= Game.productionLimit || Game.productionCells.length === 0 || Game.currentPopulation >= Game.populationCap) {
        Game.exitProductionMode();
    }
    Game.invalidateStatsCache();
    Game.buildOffscreenMap();
    Game._lastSelectionCacheKey = '';
    Game._cacheValid = false;
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};
