// map.js
window.Game = window.Game || {};

Game.initMapData = function() {
    Game.mapData = JSON.parse(JSON.stringify(Game.DEFAULT_MAP));
    if (!Game.mapData.events) Game.mapData.events = [];
    Game.mapData.factions.forEach(f => { if (f.camp === undefined) f.camp = ''; });
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            if (Game.mapData.tiles[r][c].cityName === undefined) {
                Game.mapData.tiles[r][c].cityName = '';
            }
        }
    }
    Game.turnOrder.length = 0;
    Game.turnOrder.push(...Game.mapData.factions.map(f => f.id));
    Game.currentTurnIndex = 0;
    Game.currentRound = 1;
    Game.productionLimit = 0;
    Game.productionUsed = 0;
    Game.view = { offsetX: 0, offsetY: 0, scale: 1.0 };
    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.lastCommand = null;
    Game.inProductionMode = false;
    Game.productionTargetCity = null;
    Game.productionCells = [];
    Game.invaded = false;
    Game.produced = false;
    Game.aided = false;
    Game.invalidateStatsCache();
    Game.recalcProductionLimits();
    Game.updateWorldSize();
    Game.buildOffscreenMap();
    Game.updateMountainControl();
};

Game.recalcProductionLimits = function() {
    const counts = Game.countCitiesByFaction();
    const curId = Game.turnOrder[Game.currentTurnIndex];
    Game.productionLimit = counts[curId] || 0;
    Game.productionUsed = 0;
    Game.populationCap = 16 + 8 * (counts[curId] || 0);
    Game.refreshCurrentPopulation();
};

Game.syncUnitTerritories = function() {
    // 只在中立格子上同步单位领土，避免覆盖敌方或盟友的已有归属
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.terrain === 'land' && tile.unit && tile.unit.owner) {
                if (tile.owner === null) {
                    tile.owner = tile.unit.owner;
                }
                // 不再自动覆盖任何非中立格子，允许单位停留在非己方领土上
            }
        }
    }
};

Game.countCitiesByFaction = function() {
    if (Game._cityCountsCache) return Game._cityCountsCache;
    const counts = {};
    Game.mapData.factions.forEach(f => { counts[f.id] = 0; });
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.city && tile.owner) {
                if (counts[tile.owner] !== undefined) counts[tile.owner]++;
            }
        }
    }
    Game._cityCountsCache = counts;
    return counts;
};

Game.countUnitsByFaction = function() {
    if (Game._unitCountsCache) return Game._unitCountsCache;
    const counts = {};
    Game.mapData.factions.forEach(f => { counts[f.id] = 0; });
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const unit = Game.mapData.tiles[r][c].unit;
            if (unit && unit.owner) {
                if (counts[unit.owner] !== undefined) counts[unit.owner]++;
            }
        }
    }
    Game._unitCountsCache = counts;
    return counts;
};

Game.invalidateStatsCache = function() {
    Game._cityCountsCache = null;
    Game._unitCountsCache = null;
};

Game.loadMapData = function(newData) {
    if (!newData || typeof newData !== 'object' ||
        typeof newData.width !== 'number' || typeof newData.height !== 'number' ||
        !Array.isArray(newData.tiles) || !Array.isArray(newData.factions)) {
        alert('地图数据不合法：缺少关键字段 (width, height, tiles, factions)');
        return;
    }
    if (!newData.title) newData.title = '未命名地图';
    if (!newData.events) newData.events = [];
    if (!newData.surfaceType) newData.surfaceType = 'default';
    if (newData.factions) {
        newData.factions.forEach(f => { if (f.camp === undefined) f.camp = ''; });
    }

    for (let r = 0; r < newData.height; r++) {
        for (let c = 0; c < newData.width; c++) {
            if (newData.tiles[r][c].city === undefined) newData.tiles[r][c].city = false;
            if (newData.tiles[r][c].cityName === undefined) newData.tiles[r][c].cityName = '';
            if (newData.tiles[r][c].unit === undefined) newData.tiles[r][c].unit = null;
            else if (newData.tiles[r][c].unit) {
                if (typeof newData.tiles[r][c].unit.hp !== 'number') newData.tiles[r][c].unit.hp = Game.HP_MAX;
                else newData.tiles[r][c].unit.hp = Math.min(newData.tiles[r][c].unit.hp, Game.HP_MAX);
            }
            if (!['land', 'sea', 'mountain'].includes(newData.tiles[r][c].terrain)) {
                newData.tiles[r][c].terrain = 'land';
            }
        }
    }
    Game.mapData = newData;

    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            if (Game.mapData.tiles[r][c].terrain === 'sea') {
                Game.mapData.tiles[r][c].owner = null;
            }
        }
    }

    Game.syncUnitTerritories();
    if (newData.turnOrder && newData.turnOrder.length === Game.mapData.factions.length) {
        Game.turnOrder.length = 0;
        Game.turnOrder.push(...newData.turnOrder);
    } else {
        Game.turnOrder.length = 0;
        Game.turnOrder.push(...Game.mapData.factions.map(f => f.id));
    }
    Game.currentTurnIndex = 0;
    Game.currentRound = 1;
    Game.invalidateStatsCache();
    Game.recalcProductionLimits();
    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.lastCommand = null;
    Game.inProductionMode = false;
    Game.productionTargetCity = null;
    Game.productionCells = [];
    Game.invaded = false;
    Game.produced = false;
    Game.aided = false;
    Game.updateWorldSize();
    Game.buildOffscreenMap();
    Game.renderFactionLegend();
    Game.updateMountainControl();
    Game.checkFactionElimination();
    Game.resetViewToCenter();
    Game.refreshCurrentPopulation();
    Game.saveGameState();
};

Game.buildOffscreenMap = function() {
    Game.updateWorldSize();
    Game.offscreenCanvas = document.createElement('canvas');
    Game.offscreenCanvas.width = Game.WORLD_WIDTH;
    Game.offscreenCanvas.height = Game.WORLD_HEIGHT;
    Game.offscreenCtx = Game.offscreenCanvas.getContext('2d');
    const cell = Game.BASE_CELL_SIZE;
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.terrain === 'land' || tile.terrain === 'mountain') {
                const st = Game.mapData.surfaceType || 'default';
                Game.offscreenCtx.fillStyle = (Game.surfaceColors && Game.surfaceColors[st]) ? Game.surfaceColors[st] : '#3a6b4f';
            } else {
                Game.offscreenCtx.fillStyle = '#2a6090';
            }
            Game.offscreenCtx.fillRect(c * cell, r * cell, cell, cell);
        }
    }
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (!tile.owner) continue;
            const faction = Game.mapData.factions.find(f => f.id === tile.owner);
            if (!faction) continue;
            Game.offscreenCtx.fillStyle = faction.color + Game.TERRITORY_OPACITY;
            Game.offscreenCtx.fillRect(c * cell, r * cell, cell, cell);
        }
    }
};

Game.refreshCurrentPopulation = function() {
    const curId = Game.turnOrder[Game.currentTurnIndex];
    let pop = 0;
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const unit = Game.mapData.tiles[r][c].unit;
            if (unit && unit.owner === curId) pop++;
        }
    }
    Game.currentPopulation = pop;
};
