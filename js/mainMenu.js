// mainMenu.js
(function() {
    var MainMenu = {};

    MainMenu.menuEl = null;
    MainMenu.continueBtn = null;
    MainMenu.continueHint = null;
    MainMenu.submenuEl = null;
    MainMenu.settingsPanel = null;
    MainMenu.aboutPanel = null;
    MainMenu.mapSelectPanel = null;
    MainMenu.officialListEl = null;
    MainMenu.officialArrow = null;
    MainMenu._officialScrollTimer = null;
    MainMenu._mapSelectMode = 'menu';  // 'menu' 或 'game'

    MainMenu.init = function () {
        MainMenu.menuEl = document.getElementById('mainMenu');
        MainMenu.continueBtn = document.getElementById('btnContinue');
        MainMenu.continueHint = document.getElementById('continueHint');
        MainMenu.submenuEl = document.getElementById('newGameSubmenu');
        MainMenu.settingsPanel = document.getElementById('settingsPanel');
        MainMenu.aboutPanel = document.getElementById('aboutPanel');
        MainMenu.mapSelectPanel = document.getElementById('mapSelectPanel');
        MainMenu.officialListEl = document.getElementById('mapOfficialList');
        MainMenu.officialArrow = document.getElementById('mapSelectOfficial').querySelector('.btn-arrow');

        // 防止地图选择面板内的点击冒泡到 document 关闭"新游戏"子菜单
        MainMenu.mapSelectPanel.querySelector('.menu-panel-card').addEventListener('click', function (e) {
            e.stopPropagation();
        });

        // 辅助函数：折叠官方地图列表（同时隐藏滚动条）
        MainMenu.closeOfficialList = function () {
            if (MainMenu.officialListEl.classList.contains('open')) {
                MainMenu.officialListEl.style.overflow = 'hidden';
                MainMenu.officialListEl.classList.remove('open');
                MainMenu.officialArrow.classList.remove('open');
                clearTimeout(MainMenu._officialScrollTimer);
            }
        };

        // 统一关闭地图选择面板（不触发后续操作）
        MainMenu.closeMapSelectPanel = function () {
            MainMenu.closeOfficialList();
            MainMenu.mapSelectPanel.classList.remove('visible');
        };

        // 回调：选图后的共同处理
        MainMenu._onMapSelected = function () {
            MainMenu.closeMapSelectPanel();
            if (MainMenu._mapSelectMode === 'menu') {
                // 从主菜单选图：启动游戏
                MainMenu.launchGame();
            } else {
                // 游戏内选图：地图已加载，触发重绘
                Game.drawMap();
                Game.updateFloatingButtonsPosition();
                Game.invalidateStatsCache();
            }
        };

        // 检查是否有存档
        var raw = null;
        try { raw = localStorage.getItem(Game.SAVE_KEY); } catch (e) {}
        if (raw) {
            try {
                var saveData = JSON.parse(raw);
                if (saveData && saveData.mapData && saveData.mapData.title) {
                    MainMenu.continueBtn.style.display = 'flex';
                    MainMenu.continueBtn.title = saveData.mapData.title;
                    MainMenu.continueHint.textContent = saveData.mapData.title;
                }
            } catch (e) {
                // 存档损坏，不显示继续
            }
        }

        // --- 继续游戏 ---
        MainMenu.continueBtn.addEventListener('click', function () {
            MainMenu.startGame(true);
        });

        // --- 新游戏（展开/收起子菜单）---
        var btnNewGame = document.getElementById('btnNewGame');
        var btnArrow = btnNewGame.querySelector('.btn-arrow');
        btnNewGame.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = MainMenu.submenuEl.classList.contains('open');
            if (isOpen) {
                MainMenu.submenuEl.classList.remove('open');
                btnArrow.classList.remove('open');
            } else {
                MainMenu.submenuEl.classList.add('open');
                btnArrow.classList.add('open');
            }
        });

        // 点击子菜单以外区域关闭子菜单
        document.addEventListener('click', function () {
            if (MainMenu.submenuEl.classList.contains('open')) {
                MainMenu.submenuEl.classList.remove('open');
                btnArrow.classList.remove('open');
            }
        });
        MainMenu.submenuEl.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        // --- 自由模式 → 打开地图选择面板 ---
        document.getElementById('btnFreeMode').addEventListener('click', function (e) {
            e.stopPropagation();
            MainMenu.openMapSelectPanel('menu');
        });

        // --- 游戏设置 ---
        document.getElementById('btnSettings').addEventListener('click', function () {
            // 主菜单打开设置：隐藏导出地图按钮
            if (typeof Game.setSettingsExportVisible === 'function') {
                Game.setSettingsExportVisible(false);
            }
            MainMenu.settingsPanel.classList.add('visible');
        });
        document.getElementById('btnSettingsClose').addEventListener('click', function () {
            MainMenu.settingsPanel.classList.remove('visible');
        });
        MainMenu.settingsPanel.addEventListener('click', function (e) {
            if (e.target === MainMenu.settingsPanel) {
                MainMenu.settingsPanel.classList.remove('visible');
            }
        });

        // --- 地图编辑器 ---
        document.getElementById('btnMapEditor').addEventListener('click', function () {
            window.location.href = 'map editor/map_editor.html';
        });

        // --- 关于 ---
        document.getElementById('btnAbout').addEventListener('click', function () {
            var content = document.getElementById('aboutContent');
            content.textContent = Game.ABOUT_TEXT || '暂无信息';
            MainMenu.aboutPanel.classList.add('visible');
        });
        document.getElementById('btnAboutClose').addEventListener('click', function () {
            MainMenu.aboutPanel.classList.remove('visible');
        });
        MainMenu.aboutPanel.addEventListener('click', function (e) {
            if (e.target === MainMenu.aboutPanel) {
                MainMenu.aboutPanel.classList.remove('visible');
            }
        });

        // --- 地图选择面板（统一事件绑定，由 openMapSelectPanel 触发显示）---
        document.getElementById('btnMapSelectClose').addEventListener('click', function () {
            MainMenu.closeMapSelectPanel();
        });
        MainMenu.mapSelectPanel.addEventListener('click', function (e) {
            if (e.target === MainMenu.mapSelectPanel) {
                MainMenu.closeMapSelectPanel();
            }
        });

        // 测试地图
        document.getElementById('mapSelectTestMap').addEventListener('click', function () {
            var defaultMap = JSON.parse(JSON.stringify(Game.DEFAULT_MAP));
            defaultMap.title = '测试地图';
            Game.loadMapData(defaultMap);
            MainMenu._onMapSelected();
        });

        // 官方地图 展开/收起
        var mapSelectOfficial = document.getElementById('mapSelectOfficial');
        mapSelectOfficial.addEventListener('click', function () {
            var isOpen = MainMenu.officialListEl.classList.contains('open');
            if (isOpen) {
                // 折叠：立即隐藏滚动条
                MainMenu.officialListEl.style.overflow = 'hidden';
                MainMenu.officialListEl.classList.remove('open');
                MainMenu.officialArrow.classList.remove('open');
                clearTimeout(MainMenu._officialScrollTimer);
            } else {
                // 延迟填充列表
                MainMenu.populateOfficialMapList(MainMenu.officialListEl);
                MainMenu.officialListEl.classList.add('open');
                MainMenu.officialArrow.classList.add('open');
                // 清除折叠时设置的内联 overflow:hidden，让 CSS overflow-y:auto 生效
                MainMenu.officialListEl.style.overflow = '';
                clearTimeout(MainMenu._officialScrollTimer);
            }
        });

        // 打开本地文件（等待用户选择文件并校验后载入）
        document.getElementById('mapSelectLocal').addEventListener('click', function () {
            MainMenu.pendingLocalFile = true;
            // 不关闭面板，让用户看到文件选择对话框
            Game.ui.fileInput.click();
        });

        // --- 键盘关闭面板 ---
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (MainMenu.aboutPanel.classList.contains('visible')) {
                    MainMenu.aboutPanel.classList.remove('visible');
                } else if (MainMenu.settingsPanel.classList.contains('visible')) {
                    MainMenu.settingsPanel.classList.remove('visible');
                } else if (MainMenu.mapSelectPanel.classList.contains('visible')) {
                    MainMenu.closeMapSelectPanel();
                }
            }
        });
    };

    // ========== 统一打开地图选择面板 ==========
    // mode: 'menu'（新游戏选图） 或 'game'（游戏内更换地图）
    MainMenu.openMapSelectPanel = function (mode) {
        MainMenu._mapSelectMode = mode || 'menu';
        // 重置官方列表展开状态，避免上次打开的状态残留
        MainMenu.closeOfficialList();
        // 允许重复填充（下次打开时重新加载官方列表）
        if (MainMenu.officialListEl) {
            MainMenu.officialListEl.dataset.loaded = '0';
        }
        MainMenu.mapSelectPanel.classList.add('visible');
    };

    MainMenu.populateOfficialMapList = function (container) {
        if (container.dataset.loaded === '1') return;
        container.dataset.loaded = '1';
        container.innerHTML = '';
        var mapList = window.OFFICIAL_MAP_LIST;
        if (!Array.isArray(mapList) || mapList.length === 0) {
            container.innerHTML = '<span style="color:#5a6b7c;font-size:12px;padding:4px 0;">暂无官方地图</span>';
            return;
        }
        mapList.forEach(function (mapInfo, index) {
            var btn = document.createElement('button');
            btn.className = 'menu-select-btn';
            btn.style.fontSize = '13px';
            btn.style.padding = '10px 16px';
            btn.innerHTML = '<span class="btn-icon">▹</span><span class="btn-text">' + (mapInfo.name || ('地图 ' + (index + 1))) + '</span>';
            btn.addEventListener('click', function () {
                Game.loadMapData(JSON.parse(JSON.stringify(mapInfo.data)));
                MainMenu._onMapSelected();
            });
            container.appendChild(btn);
        });
    };

    // 主菜单触发的本地文件校验+加载入口
    MainMenu.pendingLocalFile = false;
    MainMenu.handleLocalFileLoad = function (jsonData) {
        MainMenu.pendingLocalFile = false;
        // 校验地图数据合法性
        if (!jsonData || typeof jsonData !== 'object' ||
            !jsonData.width || !jsonData.height ||
            !Array.isArray(jsonData.tiles) ||
            !Array.isArray(jsonData.factions)) {
            alert('该文件不是有效的游戏地图');
            return;
        }
        if (!jsonData.title) jsonData.title = '未命名地图';
        Game.loadMapData(JSON.parse(JSON.stringify(jsonData)));
        MainMenu._onMapSelected();
    };

    MainMenu.launchGame = function () {
        MainMenu.menuEl.classList.add('hidden');
        setTimeout(function () {
            Game.startFromMenuWithMap();
        }, 500);
    };

    // loadSave: true=继续游戏, false=新游戏自由模式（直接默认图）
    MainMenu.startGame = function (loadSave) {
        MainMenu.menuEl.classList.add('hidden');

        // 延迟启动游戏，等菜单动画完成
        setTimeout(function () {
            Game.startFromMenu(loadSave);
        }, 500);
    };

    window.MainMenu = MainMenu;
})();
