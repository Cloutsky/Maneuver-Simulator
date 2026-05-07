// ui_modals/surrender.js
window.Game = window.Game || {};

Game.performSurrender = function(targetId) {
    const curId = Game.turnOrder[Game.currentTurnIndex];
    const curFaction = Game.mapData.factions.find(f => f.id === curId);
    const targetFaction = Game.mapData.factions.find(f => f.id === targetId);
    if (!curFaction || !targetFaction) return;

    const curName = curFaction.name;
    const targetName = targetFaction.name;

    const isAlly = Game.areFactionsAllied(curId, targetId);

    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.owner === curId) tile.owner = targetId;
            if (tile.unit && tile.unit.owner === curId) tile.unit.owner = targetId;
        }
    }

    const oldIndex = Game.currentTurnIndex;
    const wasLast = (oldIndex === Game.turnOrder.length - 1);

    Game.mapData.factions = Game.mapData.factions.filter(f => f.id !== curId);
    Game.turnOrder = Game.turnOrder.filter(id => id !== curId);

    if (Game.turnOrder.length === 0) {
        Game.initMapData();
        return;
    }
    if (Game.currentTurnIndex >= Game.turnOrder.length) {
        Game.currentTurnIndex = 0;
    }

    Game.updateMountainControl();

    const desc = isAlly
        ? `${curName} 与 ${targetName} 合并`
        : `${curName} 向 ${targetName} 投降了`;

    Game.mapData.events.push({
        round: Game.currentRound,
        time: new Date().toLocaleString(),
        description: desc
    });

    if (wasLast && Game.currentTurnIndex === 0) {
        Game.currentRound++;
    }

    Game.invaded = false;
    Game.produced = false;
    Game.aided = false;
    Game.invalidateStatsCache();
    Game.recalcProductionLimits();
    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.lastCommand = null;
    Game.updateUndoButtonVisibility();
    if (Game.inProductionMode) Game.exitProductionMode();

    Game.buildOffscreenMap();
    Game.drawMap();
    Game.renderFactionLegend();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();

    alert(desc);
};