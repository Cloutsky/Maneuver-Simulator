// main.js
(function() {
    var resizeObserver = null;

    window.addEventListener('DOMContentLoaded', function () {
        var canvas = document.getElementById('warCanvas');
        Game.canvas = canvas;
        Game.ctx = canvas.getContext('2d');
        var wrapper = document.querySelector('.canvas-wrapper');

        function resizeCanvas() {
            var rect = wrapper.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            var centerWorld = null;
            if (canvas.width > 0) {
                centerWorld = Game.screenToWorld(canvas.width / 2, canvas.height / 2);
            }
            canvas.width = rect.width;
            canvas.height = rect.height;
            if (centerWorld) {
                var newCenter = Game.worldToScreen(centerWorld.x, centerWorld.y);
                Game.view.offsetX += canvas.width / 2 - newCenter.x;
                Game.view.offsetY += canvas.height / 2 - newCenter.y;
                var minScale = Game.getFitScale();
                if (Game.view.scale < minScale) Game.view.scale = minScale;
                Game.clampOffset();
                Game.clearSelectionIfGridHidden();
                Game.drawMap();
            } else {
                Game.resetViewToCenter();
            }
        }

        resizeObserver = new ResizeObserver(function () { resizeCanvas(); });
        resizeObserver.observe(wrapper);

        // 文件选择监听器（菜单和游戏中均需注册）
        Game.ui.fileInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var jsonData = JSON.parse(ev.target.result);
                    if (MainMenu && MainMenu.pendingLocalFile) {
                        MainMenu.handleLocalFileLoad(jsonData);
                    } else {
                        // 游戏内加载：校验后再调 loadMapData（loadMapData 内部也会二次校验）
                        if (!jsonData || typeof jsonData !== 'object' ||
                            typeof jsonData.width !== 'number' || typeof jsonData.height !== 'number' ||
                            !Array.isArray(jsonData.tiles) || !Array.isArray(jsonData.factions)) {
                            alert('该文件不是有效的游戏地图');
                        } else {
                            Game.loadMapData(jsonData);
                        }
                    }
                } catch (ex) { alert('无效的地图JSON文件：' + ex.message); }
                Game.ui.fileInput.value = '';
            };
            reader.onerror = function () {
                alert('读取文件失败');
                Game.ui.fileInput.value = '';
            };
            reader.readAsText(file);
        });

        // 先初始化主菜单，不启动游戏
        MainMenu.init();
    });

    // 由主菜单调用：地图已通过 loadMapData 预加载，只需初始化 UI 并渲染
    Game.startFromMenuWithMap = function () {
        var wrapper = document.querySelector('.canvas-wrapper');
        var canvas = Game.canvas;
        var loadingOverlay = document.getElementById('loadingOverlay');

        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }

        Game.currentTurnIndex = 0;
        Game.currentRound = 1;
        Game.turnOrder = Game.mapData.factions.map(function (f) { return f.id; });
        Game.productionLimit = 0;
        Game.productionUsed = 0;
        Game.selectedTile = null;
        Game.extraSelectedUnits = [];
        Game.moveRange = [];
        Game.attackTargets = [];
        Game.lastCommand = null;
        Game.inProductionMode = false;
        Game.invaded = false;
        Game.produced = false;
        Game.aided = false;

        Game.updateWorldSize();
        Game.buildOffscreenMap();
        Game.renderFactionLegend();
        Game.recalcProductionLimits();
        Game.updateMountainControl();
        Game.invalidateStatsCache();
        Game.initEvents();
        Game.initUIBindings();

        var rect = wrapper.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        Game.resetViewToCenter();
        Game.updateFloatingButtonsPosition();
        Game.drawMap();

        setTimeout(function () {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 500);
    };

    // 由主菜单调用：loadSave = true 继续游戏，false 新游戏
    Game.startFromMenu = function (loadSave) {
        var wrapper = document.querySelector('.canvas-wrapper');
        var canvas = Game.canvas;
        var loadingOverlay = document.getElementById('loadingOverlay');

        // 显示加载遮罩
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }

        if (loadSave) {
            // 继续游戏：加载存档
            Game.loadGameState();
        } else {
            // 新游戏：重置为默认地图
            Game.mapData = JSON.parse(JSON.stringify(Game.DEFAULT_MAP));
            Game.currentTurnIndex = 0;
            Game.currentRound = 1;
            Game.turnOrder = Game.mapData.factions.map(function (f) { return f.id; });
            Game.productionLimit = 0;
            Game.productionUsed = 0;
            Game.selectedTile = null;
            Game.extraSelectedUnits = [];
            Game.moveRange = [];
            Game.attackTargets = [];
            Game.lastCommand = null;
            Game.inProductionMode = false;
            Game.invaded = false;
            Game.produced = false;
            Game.aided = false;
            Game.updateWorldSize();
            Game.buildOffscreenMap();
            Game.renderFactionLegend();
            Game.recalcProductionLimits();
            Game.updateMountainControl();
            Game.invalidateStatsCache();
        }

        Game.initEvents();
        Game.initUIBindings();

        // 确保 resizeObserver 还在监听（如果 wrapper 换了也 OK）
        if (!resizeObserver) {
            resizeObserver = new ResizeObserver(function () {
                var rect = wrapper.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                var centerWorld = null;
                if (canvas.width > 0) {
                    centerWorld = Game.screenToWorld(canvas.width / 2, canvas.height / 2);
                }
                canvas.width = rect.width;
                canvas.height = rect.height;
                if (centerWorld) {
                    var newCenter = Game.worldToScreen(centerWorld.x, centerWorld.y);
                    Game.view.offsetX += canvas.width / 2 - newCenter.x;
                    Game.view.offsetY += canvas.height / 2 - newCenter.y;
                    var minScale = Game.getFitScale();
                    if (Game.view.scale < minScale) Game.view.scale = minScale;
                    Game.clampOffset();
                    Game.clearSelectionIfGridHidden();
                    Game.drawMap();
                } else {
                    Game.resetViewToCenter();
                }
            });
            resizeObserver.observe(wrapper);
        }

        // 先完成 Canvas 尺寸同步与地图渲染，再用 1s 过渡遮罩保护
        var rect = wrapper.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        Game.resetViewToCenter();
        Game.updateFloatingButtonsPosition();
        Game.drawMap();

        // 0.5s 后淡出加载遮罩
        setTimeout(function () {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 500);
    };
})();
