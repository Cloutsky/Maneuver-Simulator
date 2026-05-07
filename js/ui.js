// ui.js
window.Game = window.Game || {};

Game.ui = {
    zoomDisplay: document.getElementById('zoomDisplay'),
    coordDisplay: document.getElementById('coordDisplay'),
    factionLegendDiv: document.getElementById('factionLegendContainer'),
    infoPanel: document.getElementById('infoPanel'),
    toggleUIBtn: document.getElementById('toggleUIBtn'),
    jsonSummary: document.getElementById('jsonSummary'),
    fileInput: document.getElementById('fileInput'),
    floatingControls: document.getElementById('floatingControls'),
    roundDisplay: document.getElementById('roundDisplay'),
    endTurnBtn: document.getElementById('endTurnBtn'),
    undoBtn: document.getElementById('undoBtn'),
    prodBtn: document.getElementById('prodBtn'),
    prodBar: document.getElementById('prodBar'),
    prodDisplay: document.getElementById('prodDisplay'),
    popBar: document.getElementById('popBar'),
    popDisplay: document.getElementById('popDisplay'),
    statusBar: document.getElementById('statusBar'),
    statusHint: document.getElementById('statusHint'),
    toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
    infoBtn: document.getElementById('infoBtn'),
    eventLogBtn: document.getElementById('eventLogBtn'),
    manageFactionBtn: document.getElementById('manageFactionBtn'),
    campManageBtn: document.getElementById('campManageBtn'),
    cessCancelBtn: document.getElementById('cessCancelBtn'),
    cessConfirmBtn: document.getElementById('cessConfirmBtn')
};

Game.updateStats = function() {
    Game.ui.zoomDisplay.textContent = Math.round(Game.view.scale * 100) + '%';
    let coordText = '--, --';
    if (Game.selectedTile) {
        coordText = `${Game.selectedTile.col}, ${Game.selectedTile.row}`;
    }
    Game.ui.coordDisplay.textContent = coordText;
    Game.ui.roundDisplay.textContent = `第${Game.currentRound}轮`;

    const totalCities = Game.mapData.tiles.flat().filter(t => t.city).length;
    const totalUnits = Game.mapData.tiles.flat().filter(t => t.unit).length;
    Game.ui.jsonSummary.textContent = `地图:${Game.mapData.width}x${Game.mapData.height} 势力${Game.mapData.factions.length} 单位${totalUnits} 城市${totalCities}`;

    Game.updateProductionDisplay();
    Game.checkInfoBarsFit();
};

Game.renderFactionLegend = function() {
    const cityCounts = Game.countCitiesByFaction();
    const unitCounts = Game.countUnitsByFaction();
    const curId = Game.turnOrder[Game.currentTurnIndex];
    const showTroops = Game.isLargeScreen();
    let html = '';
    Game.turnOrder.forEach(factionId => {
        const f = Game.mapData.factions.find(f => f.id === factionId);
        if (!f) return;
        const cityCount = cityCounts[f.id] || 0;
        const unitCount = unitCounts[f.id] || 0;
        const activeClass = (factionId === curId) ? 'active-turn' : '';
        let stats = showTroops ? `兵力${unitCount} · 城市${cityCount}` : `城市${cityCount}`;
        const campText = f.camp ? ` <small style="font-size:0.8em; opacity:0.8;">-${f.camp}</small>` : '';
        html += `<div class="faction-badge ${activeClass}" style="border-left-color: ${f.color};">
            <span style="display:inline-block;width:16px;height:16px;background:${f.color};border-radius:4px;"></span>
            <span class="faction-name">${f.name}${campText}</span>
            <span style="opacity:0.9;font-size:12px;margin-left:4px;">${stats}</span>
        </div>`;
    });
    Game.ui.factionLegendDiv.innerHTML = html;
};

Game.updateProductionDisplay = function() {
    Game.ui.prodBar.style.display = '';
    Game.ui.prodDisplay.textContent = `${Game.productionLimit - Game.productionUsed}/${Game.productionLimit}`;
    Game.ui.popDisplay.textContent = `${Game.currentPopulation || 0}/${Game.populationCap || 0}`;
    let hint = '';
    if (Game.produced) {
        hint = '本回合已生产';
    } else if (Game.invaded) {
        hint = '本回合已入侵';
    } else if (Game.aided) {
        hint = '本回合已援助';
    }
    Game.ui.statusHint.textContent = hint || '本回合未行动';
};

Game.updateProductionButtonVisibility = function() {
    if (Game.inProductionMode) {
        Game.ui.prodBtn.classList.remove('hidden');
        Game.updateFloatingButtonsPosition();
        return;
    }
    if (Game.invaded || Game.aided) {
        Game.ui.prodBtn.classList.add('hidden');
        return;
    }
    if (Game.selectedTile && !Game.inProductionMode && Game.productionLimit > Game.productionUsed) {
        const tile = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col];
        if (tile && tile.city && tile.owner === Game.turnOrder[Game.currentTurnIndex]) {
            Game.ui.prodBtn.classList.remove('hidden');
            Game.updateFloatingButtonsPosition();
            return;
        }
    }
    Game.ui.prodBtn.classList.add('hidden');
};

Game.updateInfoButtonVisibility = function() {
    if (Game.inProductionMode) {
        Game.ui.infoBtn.classList.add('hidden');
        return;
    }
    if (Game.selectedTile) {
        const tile = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col];
        if (tile) {
            const hasUnit = !!tile.unit;
            const hasOwnCity = tile.city && tile.owner === Game.turnOrder[Game.currentTurnIndex];
            if (hasUnit || hasOwnCity) {
                Game.ui.infoBtn.classList.remove('hidden');
                Game.updateFloatingButtonsPosition();
                return;
            }
        }
    }
    Game.ui.infoBtn.classList.add('hidden');
};

Game.deleteSelectedUnit = function() {
    if (!Game.selectedTile) return;
    const tile = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col];
    if (!tile || !tile.unit) return;
    const unitData = { ...tile.unit };

    tile.unit = null;

    Game.lastCommand = {
        type: 'deleteUnit',
        row: Game.selectedTile.row,
        col: Game.selectedTile.col,
        unitData: unitData
    };
    Game.updateUndoButtonVisibility();

    Game.refreshCurrentPopulation();

    Game.selectedTile = null;
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.animationFrame) {
        cancelAnimationFrame(Game.animationFrame);
        Game.animationFrame = null;
    }

    Game.invalidateStatsCache();
    Game.buildOffscreenMap();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};

Game.updateFloatingButtonsPosition = function() {
    const panelHeight = Game.ui.infoPanel.offsetHeight;
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;

    let prodBottom = 20, infoBottom = 20, endBottom = 20, undoBottom = 88;
    if (!Game.uiHidden) {
        if (isLandscape) {
            prodBottom = 20;
            infoBottom = 20;
            endBottom = 20;
            undoBottom = 88;
        } else {
            prodBottom = panelHeight + 20;
            infoBottom = panelHeight + 20;
            endBottom = panelHeight + 20;
            undoBottom = panelHeight + 88;
        }
    }

    Game.ui.prodBtn.style.bottom = prodBottom + 'px';
    Game.ui.endTurnBtn.style.bottom = endBottom + 'px';
    Game.ui.undoBtn.style.bottom = undoBottom + 'px';
    Game.ui.infoBtn.style.bottom = infoBottom + 'px';

    const prodVisible = !Game.ui.prodBtn.classList.contains('hidden');
    const infoVisible = !Game.ui.infoBtn.classList.contains('hidden');
    const btnWidth = 56;
    const gap = 12;

    if (prodVisible && infoVisible) {
        const totalWidth = btnWidth * 2 + gap;
        let center;
        if (isLandscape && !Game.uiHidden) {
            center = (window.innerWidth - 320) / 2;
        } else {
            center = window.innerWidth / 2;
        }
        Game.ui.infoBtn.style.left = (center - totalWidth/2 + btnWidth/2) + 'px';
        Game.ui.prodBtn.style.left = (center + totalWidth/2 - btnWidth/2) + 'px';
        Game.ui.infoBtn.style.transform = 'translateX(-50%)';
        Game.ui.prodBtn.style.transform = 'translateX(-50%)';
    } else if (prodVisible) {
        let left = '50%';
        if (isLandscape && !Game.uiHidden) {
            left = ((window.innerWidth - 320) / 2) + 'px';
        }
        Game.ui.prodBtn.style.left = left;
        Game.ui.prodBtn.style.transform = 'translateX(-50%)';
    } else if (infoVisible) {
        let left = '50%';
        if (isLandscape && !Game.uiHidden) {
            left = ((window.innerWidth - 320) / 2) + 'px';
        }
        Game.ui.infoBtn.style.left = left;
        Game.ui.infoBtn.style.transform = 'translateX(-50%)';
    }

    if (Game.uiHidden) {
        Game.ui.floatingControls.style.bottom = '';
        Game.ui.floatingControls.style.left = '';
        Game.ui.floatingControls.style.right = '20px';
        Game.ui.floatingControls.style.left = 'auto';
    } else {
        if (isLandscape) {
            Game.ui.floatingControls.style.bottom = '20px';
            Game.ui.floatingControls.style.right = 'auto';
            Game.ui.floatingControls.style.left = `calc(100% - 340px - 20px)`;
        } else {
            Game.ui.floatingControls.style.bottom = (panelHeight + 20) + 'px';
            Game.ui.floatingControls.style.right = '20px';
            Game.ui.floatingControls.style.left = 'auto';
        }
    }
};

Game.toggleInfoPanel = function(force) {
    Game.uiHidden = force !== undefined ? force : !Game.uiHidden;
    Game.ui.infoPanel.classList.toggle('hidden', Game.uiHidden);
    Game.ui.toggleUIBtn.classList.toggle('hide-ui', Game.uiHidden);
    setTimeout(Game.updateFloatingButtonsPosition, 50);
};

Game.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
};

Game.updateFullscreenButton = function() {
    Game.ui.toggleFullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
};

Game.updateUndoButtonVisibility = function() {
    if (Game.lastCommand) {
        Game.ui.undoBtn.classList.remove('hidden');
    } else {
        Game.ui.undoBtn.classList.add('hidden');
    }
};

Game.checkInfoBarsFit = function() {
    const row = document.querySelector('.info-bars-row');
    if (!row) return;
    // 仅竖屏时适用
    if (window.matchMedia('(orientation: landscape)').matches) {
        row.classList.remove('all-fit');
        return;
    }
    // 检测一行是否能容纳所有子元素：比较自然宽度之和与容器宽度
    // 先移除 all-fit 获取自然布局宽度
    row.classList.remove('all-fit');
    // 强制换行以测量每个子元素自然宽度
    row.style.flexWrap = 'nowrap';
    let totalWidth = 0;
    const children = Array.from(row.children);
    children.forEach(el => {
        totalWidth += el.offsetWidth;
    });
    row.style.flexWrap = '';
    // 加上 gap（8px * (n-1)）
    const gapTotal = 8 * (children.length - 1);
    if (totalWidth + gapTotal <= row.offsetWidth) {
        row.classList.add('all-fit');
    } else {
        row.classList.remove('all-fit');
    }
};

Game.bindSettingsUI = function() {
    var showCityNamesCheckbox = document.getElementById('settingShowCityNames');
    var opacitySlider = document.getElementById('settingOpacity');
    var opacityValue = document.getElementById('settingOpacityValue');
    var exportBtn = document.getElementById('settingExportBtn');
    var exportRow = document.getElementById('settingExportRow');

    // 从 Game 变量同步到 UI 控件
    showCityNamesCheckbox.checked = Game.SHOW_CITY_NAMES;
    opacitySlider.value = parseInt(Game.TERRITORY_OPACITY, 16);
    opacityValue.textContent = Math.round(parseInt(Game.TERRITORY_OPACITY, 16) / 255 * 100) + '%';

    // 显示城市名
    showCityNamesCheckbox.addEventListener('change', function() {
        Game.SHOW_CITY_NAMES = showCityNamesCheckbox.checked;
        Game.saveSettings();
        Game.buildOffscreenMap();
        Game.drawMap();
    });

    // 不透明度滑块
    opacitySlider.addEventListener('input', function() {
        var val = parseInt(opacitySlider.value, 10);
        var hex = val.toString(16).padStart(2, '0');
        Game.TERRITORY_OPACITY = hex;
        opacityValue.textContent = Math.round(val / 255 * 100) + '%';
        Game.saveSettings();
        Game.buildOffscreenMap();
        Game.drawMap();
    });

    // 导出按钮
    exportBtn.addEventListener('click', function() {
        Game.exportFullMapScreenshot();
    });

    // 根据上下文显示/隐藏导出行
    Game.setSettingsExportVisible = function(visible) {
        if (exportRow) {
            exportRow.style.display = visible ? '' : 'none';
        }
    };
};

Game.initUIBindings = function() {
    document.getElementById('loadMapBtn').addEventListener('click', () => MainMenu.openMapSelectPanel('game'));
    document.getElementById('saveMapBtn').addEventListener('click', () => Game.showExportDialog());

    Game.ui.toggleUIBtn.addEventListener('click', () => Game.toggleInfoPanel());
    document.getElementById('resetViewBtn').addEventListener('click', () => Game.resetViewToCenter());
    Game.ui.endTurnBtn.addEventListener('click', () => Game.endTurn());
    Game.ui.undoBtn.addEventListener('click', () => Game.undoLastAction());
    Game.ui.prodBtn.addEventListener('click', () => {
        if (Game.inProductionMode) {
            Game.exitProductionMode();
        } else {
            Game.enterProductionMode();
        }
    });
    Game.ui.toggleFullscreenBtn.addEventListener('click', () => Game.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => Game.updateFullscreenButton());
    Game.updateFullscreenButton();

    Game.ui.infoBtn.addEventListener('click', () => {
        Game.showUnitInfoModal();
    });

    Game.ui.eventLogBtn.addEventListener('click', () => {
        Game.showEventLog();
    });

    Game.ui.manageFactionBtn.addEventListener('click', () => {
        Game.showManageFactionModal();
    });

    Game.ui.campManageBtn.addEventListener('click', () => {
        Game.showCampManageModal();
    });

    // 齿轮按钮 — 打开设置面板（与主菜单共享同一个面板）
    const roundGearBtn = document.getElementById('roundGearBtn');
    if (roundGearBtn) {
        roundGearBtn.addEventListener('click', () => {
            var panel = document.getElementById('settingsPanel');
            // 游戏内打开设置：显示导出行
            Game.setSettingsExportVisible(true);
            panel.classList.add('visible');
        });
    }

    Game.ui.cessCancelBtn.addEventListener('click', () => {
        Game.exitCessionMode();
    });
    Game.ui.cessConfirmBtn.addEventListener('click', () => {
        Game.confirmCession();
    });

    window.addEventListener('resize', () => {
        if (!Game.uiHidden) Game.updateFloatingButtonsPosition();
        Game.checkInfoBarsFit();
    });

    // 初始化设置绑定
    Game.bindSettingsUI();
};
