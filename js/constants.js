// constants.js
window.Game = window.Game || {};

Game.HP_MAX = 30;
Game.DAMAGE = 30;
Game.BASE_CELL_SIZE = 48;
Game.MAX_SCALE = 3.0;
Game.DETAIL_VISIBLE_SCALE_THRESHOLD = 900;
Game.SAVE_KEY = 'wargame_save';
Game.SETTINGS_KEY = 'wargame_settings';
Game.ABOUT_TEXT = "作者:Cloutsky\n游戏目前处于开发阶段，欢迎反馈游戏bug或反馈任何你想说的建议！\n特别鸣谢DeepSeek V4模型对本项目的大力帮助\n\n教程关卡正在制作中...想快速搞懂游戏玩法可以阅读游戏目录中的新手教程.docx文档！";

// 设置默认值
Game.SHOW_CITY_NAMES = true;
Game.TERRITORY_OPACITY = '60';

// 从 localStorage 加载设置
Game.loadSettings = function() {
    try {
        var raw = localStorage.getItem(Game.SETTINGS_KEY);
        if (raw) {
            var settings = JSON.parse(raw);
            if (typeof settings.showCityNames === 'boolean') Game.SHOW_CITY_NAMES = settings.showCityNames;
            if (typeof settings.territoryOpacity === 'string') Game.TERRITORY_OPACITY = settings.territoryOpacity;
        }
    } catch (e) {
        // 忽略
    }
};

// 保存设置到 localStorage
Game.saveSettings = function() {
    try {
        var settings = {
            showCityNames: Game.SHOW_CITY_NAMES,
            territoryOpacity: Game.TERRITORY_OPACITY
        };
        localStorage.setItem(Game.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        // 忽略
    }
};

// 初始化加载设置
Game.loadSettings();

Game.DEFAULT_MAP = (() => {
    const w = 30, h = 20;
    const factions = [
        { id: "red", name: "红军", color: "#d94f4f", camp: "联盟" },
        { id: "blue", name: "蓝军", color: "#4f9ad9", camp: "联盟" },
        { id: "gold", name: "黄军", color: "#e5b13b", camp: "帝国" }
    ];
    const tiles = [];
    for (let r = 0; r < h; r++) {
        const row = [];
        for (let c = 0; c < w; c++) {
            const isEdge = (r === 0 || r === h-1 || c === 0 || c === w-1);
            const isMountain = (
                (r === 4 && c === 9) || (r === 9 && c === 8) ||
                (r === 9 && c === 20) || (r === 15 && c === 19) ||
                 (r === 15 && c === 25)
            );
            let terrain = 'land';
            if (isEdge) terrain = 'sea';
            if (isMountain) terrain = 'mountain';
            let owner = null;
            if (terrain === 'land') {
                if (r < 9 && c < 9) owner = 'red';
                else if (r >= 10 && c >= 20) owner = 'blue';
                else if (r >= 5 && r <= 14 && c >= 9 && c <= 19) owner = 'gold';
            }
            let city = false;
            let cityName = '';
            if ((r === 5 && c === 5)) { city = true; cityName = null; }
            else if ((r === 12 && c === 20)) { city = true; cityName = null; }
            else if ((r === 12 && c === 11)) { city = true; cityName = null; }
            else if ((r === 7 && c === 17)) { city = true; cityName = null; }
            row.push({ terrain, owner, city, cityName, unit: null });
        }
        tiles.push(row);
    }
    tiles[5][5].unit = { owner: 'red', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[7][7].unit = { owner: 'red', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[8][10].unit = { owner: 'gold', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[12][20].unit = { owner: 'blue', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[5][11].unit = { owner: 'gold', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[6][9].unit = { owner: 'gold', hp: Game.HP_MAX, hasMoved: false, hasAttacked: false };
    return { title: '测试地图', width: w, height: h, tiles, factions, surfaceType: 'default', events: [] };
})();

Game.surfaceColors = {
    default: '#3a6b4f',
    ice: '#a8d8ea',
    sand: '#e8d5a3',
    grass: '#97da80',
    empty: '#ffffff'
};

Game.mapData = JSON.parse(JSON.stringify(Game.DEFAULT_MAP));
Game.currentTurnIndex = 0;
Game.currentRound = 1;
Game.turnOrder = Game.mapData.factions.map(f => f.id);
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
Game.offscreenCanvas = null;
Game.offscreenCtx = null;
Game.animationFrame = null;
Game.zoomFrame = null;
Game.pendingWheel = null;
Game.pendingTouch = null;
Game.uiHidden = false;
Game.selectionStartTime = 0;
Game.invaded = false;
Game.produced = false;
Game.aided = false;
Game.WORLD_WIDTH = 0;
Game.WORLD_HEIGHT = 0;
Game.populationCap = 16;
Game.currentPopulation = 0;
Game.canvas = null;
Game.ctx = null;
Game._cityCountsCache = null;
Game._unitCountsCache = null;
Game._cacheValid = true;
Game._isDragging = false;
Game._moveRangeCache = [];
Game._lastSelectionCacheKey = '';
Game._lastDrawTimestamp = 0;
Game._dragRAF = null;

Game.updateWorldSize = function() {
    Game.WORLD_WIDTH = Game.mapData.width * Game.BASE_CELL_SIZE;
    Game.WORLD_HEIGHT = Game.mapData.height * Game.BASE_CELL_SIZE;
};

Game.getDetailVisibleScale = function() {
    return Game.canvas && Game.canvas.width < 900 ? 0.75 : 1.0;
};

Game.isLargeScreen = function() {
    return window.innerWidth >= 900;
};

// 控制台命令：切换地表样式
// 用法: setSurface('ice') / setSurface('sand') / setSurface('grass') / setSurface('empty') / setSurface('default')
window.setSurface = function(type) {
    if (!Game.surfaceColors[type]) {
        console.log('未知地表类型: ' + type + '。可选: default, ice, sand, grass, empty');
        console.log('用法: setSurface("类型")');
        return;
    }
    Game.mapData.surfaceType = type;
    Game.buildOffscreenMap();
    Game.drawMap();
    Game.saveGameState();
    console.log('地表已切换为: ' + type + ' (' + Game.surfaceColors[type] + ')');
};

// 控制台命令：列出所有可用地表类型
window.listSurfaces = function() {
    console.table(Object.entries(Game.surfaceColors).map(function(entry) {
        return { '命令': 'setSurface("' + entry[0] + '")', '名称': entry[0], '颜色': entry[1] };
    }));
};
