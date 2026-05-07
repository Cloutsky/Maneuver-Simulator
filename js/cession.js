// cession.js
window.Game = window.Game || {};

Game.cessionMode = false;
Game.cessionTarget = null;
Game.cessionTargetName = null;
Game.cessionIsNewFaction = false;
Game.cessionNewFactionName = '';
Game.cessionNewFactionColor = '';
Game.cessionSelectedTiles = [];

Game.enterCessionMode = function(targetId, targetName, isNew, newName, newColor) {
    if (Game.cessionMode) return;

    const curId = Game.turnOrder[Game.currentTurnIndex];
    if (!isNew && curId === targetId) {
        alert("不能割让给自己！");
        return;
    }

    Game.cessionMode = true;
    Game.cessionTarget = targetId;
    Game.cessionTargetName = targetName;
    Game.cessionIsNewFaction = !!isNew;
    if (isNew) {
        Game.cessionNewFactionName = newName || '新势力';
        Game.cessionNewFactionColor = newColor || '#aa88ff';
    }
    Game.cessionSelectedTiles = [];

    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.inProductionMode) Game.exitProductionMode();

    Game.ui.undoBtn.classList.add('hidden');
    Game.ui.endTurnBtn.classList.add('hidden');
    Game.ui.cessCancelBtn.classList.remove('hidden');
    Game.ui.cessConfirmBtn.classList.remove('hidden');

    Game.drawMap();
    Game.updateFloatingButtonsPosition();
};

Game.exitCessionMode = function() {
    Game.cessionMode = false;
    Game.cessionTarget = null;
    Game.cessionTargetName = null;
    Game.cessionIsNewFaction = false;
    Game.cessionNewFactionName = '';
    Game.cessionNewFactionColor = '';
    Game.cessionSelectedTiles = [];

    Game.ui.undoBtn.classList.add('hidden');
    Game.ui.endTurnBtn.classList.remove('hidden');
    Game.ui.cessCancelBtn.classList.add('hidden');
    Game.ui.cessConfirmBtn.classList.add('hidden');
    Game.updateUndoButtonVisibility();

    Game.drawMap();
    Game.updateFloatingButtonsPosition();
};

Game.toggleCessionTile = function(row, col) {
    if (!Game.cessionMode) return;

    const tile = Game.mapData.tiles[row]?.[col];
    if (!tile) return;

    const curId = Game.turnOrder[Game.currentTurnIndex];
    if (tile.owner !== curId && (!tile.unit || tile.unit.owner !== curId)) return;

    const index = Game.cessionSelectedTiles.findIndex(t => t.row === row && t.col === col);
    if (index >= 0) {
        Game.cessionSelectedTiles.splice(index, 1);
    } else {
        Game.cessionSelectedTiles.push({ row, col });
    }

    Game.drawMap();
};

Game.confirmCession = function() {
    if (!Game.cessionMode) return;

    if (Game.cessionSelectedTiles.length === 0) {
        Game.exitCessionMode();
        return;
    }

    const curId = Game.turnOrder[Game.currentTurnIndex];
    const curFaction = Game.mapData.factions.find(f => f.id === curId);
    const curName = curFaction ? curFaction.name : curId;

    let targetId = Game.cessionTarget;
    let targetName = Game.cessionTargetName;

    const isNew = Game.cessionIsNewFaction;

    if (isNew) {
        const newId = 'faction_' + Date.now();
        const newFaction = {
            id: newId,
            name: Game.cessionNewFactionName,
            color: Game.cessionNewFactionColor
        };
        Game.mapData.factions.push(newFaction);
        Game.turnOrder.push(newId);
        targetId = newId;
        targetName = newFaction.name;
    }

    for (const { row, col } of Game.cessionSelectedTiles) {
        const tile = Game.mapData.tiles[row][col];
        if (!tile) continue;
        if (tile.owner === curId) tile.owner = targetId;
        if (tile.unit && tile.unit.owner === curId) tile.unit.owner = targetId;
    }

    const isAlly = !isNew && Game.areFactionsAllied(curId, targetId);

    let hasAny = false;
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const t = Game.mapData.tiles[r][c];
            if (t.owner === curId || (t.unit && t.unit.owner === curId)) {
                hasAny = true;
                break;
            }
        }
        if (hasAny) break;
    }

    if (!hasAny) {
        if (isNew) {
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${curName} 变成了 ${targetName}`
            });
        } else if (isAlly) {
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${curName} 与 ${targetName} 合并`
            });
        } else {
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${curName} 向 ${targetName} 割让全部领土，势力覆灭`
            });
        }

        const oldIndex = Game.currentTurnIndex;
        const wasLast = (oldIndex === Game.turnOrder.length - 1);

        Game.mapData.factions = Game.mapData.factions.filter(f => f.id !== curId);
        Game.turnOrder = Game.turnOrder.filter(id => id !== curId);

        if (Game.turnOrder.length === 0) {
            Game.initMapData();
            Game.exitCessionMode();
            return;
        }
        if (Game.currentTurnIndex >= Game.turnOrder.length) {
            Game.currentTurnIndex = 0;
        }
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

        Game.updateMountainControl();
        Game.buildOffscreenMap();
        Game.renderFactionLegend();
        Game.drawMap();
        Game.saveGameState();

        alert(`${curName} 已向 ${targetName} 割让全部领土，势力覆灭。`);
    } else {
        if (isNew) {
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${targetName} 从 ${curName} 独立`
            });
        } else if (!isAlly) {
            let cityCount = 0;
            for (const { row, col } of Game.cessionSelectedTiles) {
                const tile = Game.mapData.tiles[row][col];
                if (tile && tile.city) cityCount++;
            }
            if (cityCount > 0) {
                Game.mapData.events.push({
                    round: Game.currentRound,
                    time: new Date().toLocaleString(),
                    description: `${curName} 向 ${targetName} 割让了 ${cityCount} 座城市`
                });
            } else {
                Game.mapData.events.push({
                    round: Game.currentRound,
                    time: new Date().toLocaleString(),
                    description: `${curName} 向 ${targetName} 割让了部分领土`
                });
            }
        }

        Game.updateMountainControl();
        Game.buildOffscreenMap();
        Game.invalidateStatsCache();
        Game.recalcProductionLimits();
        Game.renderFactionLegend();
        Game.drawMap();
        Game.saveGameState();
    }

    Game.exitCessionMode();
};