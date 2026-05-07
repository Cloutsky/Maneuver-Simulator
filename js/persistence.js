// persistence.js
window.Game = window.Game || {};

Game.saveGameState = function() {
    try {
        const state = {
            mapData: Game.mapData,
            turnOrder: Game.turnOrder,
            currentTurnIndex: Game.currentTurnIndex,
            currentRound: Game.currentRound,
            selectedTile: Game.selectedTile,
            view: Game.view,
            productionLimit: Game.productionLimit,
            productionUsed: Game.productionUsed,
            invaded: Game.invaded,
            produced: Game.produced,
            aided: Game.aided
        };
        localStorage.setItem(Game.SAVE_KEY, JSON.stringify(state));
    } catch(e) {}
};

Game.loadGameState = function() {
    try {
        const saved = localStorage.getItem(Game.SAVE_KEY);
        if (!saved) return false;
        const state = JSON.parse(saved);
        if (!state.mapData || !state.mapData.tiles || !state.mapData.factions) return false;
        if (!state.mapData.title) state.mapData.title = '未命名地图';
        if (!state.mapData.events) state.mapData.events = [];

        Game.mapData = state.mapData;
        for (let r = 0; r < Game.mapData.height; r++) {
            for (let c = 0; c < Game.mapData.width; c++) {
                const tile = Game.mapData.tiles[r][c];
                if (!['land', 'sea', 'mountain'].includes(tile.terrain)) {
                    tile.terrain = 'land';
                }
                if (tile.terrain === 'sea') {
                    tile.owner = null;
                }
            }
        }
        Game.turnOrder.length = 0;
        Game.turnOrder.push(...(state.turnOrder || Game.mapData.factions.map(f => f.id)));
        Game.currentTurnIndex = state.currentTurnIndex || 0;
        Game.currentRound = state.currentRound || 1;
        Game.selectedTile = state.selectedTile || null;

        Game.updateWorldSize();
        Game.buildOffscreenMap();
        Game.renderFactionLegend();
        Game.invalidateStatsCache();
        Game.recalcProductionLimits();
        if (state.productionUsed) Game.productionUsed = Math.min(state.productionUsed, Game.productionLimit);
        else Game.productionUsed = 0;
        Game.invaded = state.invaded || false;
        Game.produced = state.produced || false;
        Game.aided = state.aided || false;
        if (state.view) {
            Game.view.offsetX = state.view.offsetX || 0;
            Game.view.offsetY = state.view.offsetY || 0;
            Game.view.scale = state.view.scale || 1.0;
        }
        Game.updateProductionDisplay();
        Game.updateProductionButtonVisibility();
        Game.clearLastCommand();
        Game.updateMountainControl();
        return true;
    } catch(e) {
        return false;
    }
};

Game.clearLastCommand = function() {
    Game.lastCommand = null;
    Game.updateUndoButtonVisibility();
};