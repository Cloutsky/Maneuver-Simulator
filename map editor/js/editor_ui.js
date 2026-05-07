// editor_ui.js
window.Editor = window.Editor || {};

Editor.initUIEvents = function() {
    // 模式与画笔切换
    Editor.ui.modeEditBtn.addEventListener('click', () => Editor.setEditMode('edit'));
    Editor.ui.modeMoveBtn.addEventListener('click', () => Editor.setEditMode('move'));
    Editor.ui.brushModeBtn.addEventListener('click', () => Editor.setPaintMode('brush'));
    Editor.ui.rectModeBtn.addEventListener('click', () => Editor.setPaintMode('rect'));

    // 画笔大小
    Editor.ui.brushSizeInput.addEventListener('input', e => {
        Editor.brushSize = parseInt(e.target.value);
        Editor.ui.brushSizeValue.textContent = Editor.brushSize;
    });

    // 地表选择
    Editor.ui.surfaceTypeSelect.addEventListener('change', () => {
        Editor.mapData.surfaceType = Editor.ui.surfaceTypeSelect.value;
        Editor.renderEditor();
        Editor.saveState();
    });

    // 地图设置
    Editor.ui.resetViewBtn.addEventListener('click', () => Editor.resetView());
    Editor.ui.toggleFullscreenBtn.addEventListener('click', () => Editor.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => Editor.updateFullscreenButton());
    Editor.updateFullscreenButton();

    Editor.ui.resizeMapBtn.addEventListener('click', () => {
        const newW = parseInt(document.getElementById('mapWidth').value);
        const newH = parseInt(document.getElementById('mapHeight').value);
        if (newW > 0 && newH > 0) {
            const newTiles = Array(newH).fill().map((_, r) => Array(newW).fill().map((_, c) => {
                if (r < Editor.mapData.height && c < Editor.mapData.width) return Editor.mapData.tiles[r][c];
                return { terrain: 'sea', owner: null, city: false, unit: null };
            }));
            Editor.mapData.width = newW;
            Editor.mapData.height = newH;
            Editor.mapData.tiles = newTiles;
            Editor.selectedTile = null;
            Editor.resetView();
            Editor.saveState();
        }
    });

    Editor.ui.clearMapBtn.addEventListener('click', () => {
        for (let r = 0; r < Editor.mapData.height; r++)
            for (let c = 0; c < Editor.mapData.width; c++)
                Editor.mapData.tiles[r][c] = { terrain: 'sea', owner: null, city: false, unit: null };
        Editor.selectedTile = null;
        Editor.renderEditor();
        Editor.saveState();
    });

    Editor.ui.fillLandBtn.addEventListener('click', () => {
        for (let r = 0; r < Editor.mapData.height; r++)
            for (let c = 0; c < Editor.mapData.width; c++)
                Editor.mapData.tiles[r][c].terrain = 'land';
        Editor.renderEditor();
        Editor.saveState();
    });

    // 势力管理
    Editor.ui.addFactionBtn.addEventListener('click', () => {
        const newId = 'faction_' + Date.now();
        Editor.mapData.factions.push({ id: newId, name: '新势力', color: '#aa88ff' });
        Editor.turnOrder.push(newId);
        if (!Editor.currentTurnFactionId) Editor.currentTurnFactionId = newId;
        Editor.mapData.currentTurnFactionId = Editor.currentTurnFactionId;
        Editor.renderFactionUI();
        Editor.renderEditor();
        Editor.saveState();
    });

    Editor.ui.editTurnOrderBtn.addEventListener('click', () => Editor.showTurnOrderModal());
    Editor.ui.manageFactionBtn.addEventListener('click', () => Editor.showManageModal());
    Editor.ui.editUnitBtn.addEventListener('click', () => Editor.showEditUnitModal());
    Editor.ui.editCityBtn.addEventListener('click', () => Editor.showEditCityModal());

    // 文件操作
    Editor.ui.exportJsonBtn.addEventListener('click', () => {
        const json = JSON.stringify(Editor.exportMapData(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        const safeTitle = (Editor.mapData.title || 'map').replace(/[\\/:*?"<>|]/g, '_');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}.json`;
        a.click();
    });

    Editor.ui.importJsonBtn.addEventListener('click', () => Editor.ui.importFileInput.click());
    Editor.ui.importFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try { Editor.importMapData(JSON.parse(ev.target.result)); }
            catch(ex) { alert('无效的地图JSON文件'); }
            Editor.ui.importFileInput.value = '';
        };
        reader.readAsText(file);
    });

    // 自动保存开关
    Editor.ui.autosaveCheckbox.addEventListener('change', () => {
        Editor.autosaveEnabled = Editor.ui.autosaveCheckbox.checked;
        Editor.saveAutosaveSetting();
        if (!Editor.autosaveEnabled) try { localStorage.removeItem(Editor.SAVE_KEY); } catch(e) {}
    });

    // 画笔委托事件
    Editor.ui.factionBrushContainer.addEventListener('click', e => {
        const btn = e.target.closest('.brush-btn');
        if (!btn) return;
        Editor.currentBrush = btn.dataset.brush;
        Editor.selectedFactionId = Editor.currentBrush.startsWith('faction:') ? Editor.currentBrush.split(':')[1] : null;
        Editor.updateManageButtonState();
        Editor.renderFactionUI();
    });
    Editor.ui.staticBrushGroup.addEventListener('click', e => {
        const btn = e.target.closest('.brush-btn');
        if (!btn) return;
        Editor.currentBrush = btn.dataset.brush;
        Editor.selectedFactionId = Editor.currentBrush.startsWith('faction:') ? Editor.currentBrush.split(':')[1] : null;
        Editor.updateManageButtonState();
        Editor.renderFactionUI();
    });
};

// 渲染势力画笔按钮
Editor.renderFactionUI = function() {
    let html = '';
    Editor.mapData.factions.forEach(f => {
        const activeClass = (Editor.currentBrush === `faction:${f.id}`) ? 'active' : '';
        html += `<button class="btn brush-btn ${activeClass}" data-brush="faction:${f.id}" style="background:${f.color}40; border-left:4px solid ${f.color};">${f.name}</button>`;
    });
    Editor.ui.factionBrushContainer.innerHTML = html;
    Editor.updateCurrentFactionLabel();
    Editor.highlightActiveBrush();
};

Editor.updateCurrentFactionLabel = function() {
    const fac = Editor.mapData.factions.find(f => f.id === Editor.selectedFactionId);
    Editor.ui.currentFactionLabel.textContent = fac ? fac.name : '无';
};

Editor.highlightActiveBrush = function() {
    document.querySelectorAll('.brush-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.brush === Editor.currentBrush) btn.classList.add('active');
    });
};

// 势力管理弹窗
Editor.showManageModal = function() {
    if (!Editor.selectedFactionId) return;
    const faction = Editor.mapData.factions.find(f => f.id === Editor.selectedFactionId);
    if (!faction) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <h4>管理势力：${faction.name}</h4>
            <div class="modal-row"><label>名称</label><input type="text" id="modalFactionName" value="${faction.name}"></div>
            <div class="modal-row"><label>颜色</label><input type="color" id="modalFactionColor" value="${faction.color}" style="height:40px;"></div>
            <div class="modal-row"><label>阵营</label><input type="text" id="modalFactionCamp" value="${faction.camp || ''}" placeholder="留空或输入阵营名"></div>
            <div class="modal-row" style="flex-direction:row;align-items:center;gap:10px;">
                <label>设为当前回合势力</label><input type="checkbox" id="modalSetTurn" ${faction.id === Editor.currentTurnFactionId ? 'checked' : ''}>
            </div>
            <div class="modal-actions">
                <button class="btn small danger" id="modalDeleteBtn">删除势力</button>
                <button class="btn small" id="modalCancelBtn">取消</button>
                <button class="btn small" id="modalSaveBtn">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const nameInput = document.getElementById('modalFactionName');
    const colorInput = document.getElementById('modalFactionColor');
    const setTurnCheck = document.getElementById('modalSetTurn');
    document.getElementById('modalCancelBtn').addEventListener('click', () => document.body.removeChild(overlay));
    document.getElementById('modalSaveBtn').addEventListener('click', () => {
        faction.name = nameInput.value.trim() || '未命名';
        faction.color = colorInput.value;
        faction.camp = (document.getElementById('modalFactionCamp').value || '').trim();
        if (setTurnCheck.checked) Editor.currentTurnFactionId = faction.id;
        else if (Editor.currentTurnFactionId === faction.id) Editor.currentTurnFactionId = Editor.mapData.factions[0]?.id || null;
        Editor.mapData.currentTurnFactionId = Editor.currentTurnFactionId;
        Editor.renderFactionUI();
        Editor.renderEditor();
        Editor.saveState();
        document.body.removeChild(overlay);
    });
    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
        if (Editor.mapData.factions.length <= 1) { alert('至少保留一个势力'); return; }
        const idToDelete = faction.id;
        Editor.mapData.factions = Editor.mapData.factions.filter(f => f.id !== idToDelete);
        Editor.turnOrder = Editor.turnOrder.filter(id => id !== idToDelete);
        if (Editor.currentTurnFactionId === idToDelete) Editor.currentTurnFactionId = Editor.mapData.factions[0]?.id || null;
        Editor.mapData.currentTurnFactionId = Editor.currentTurnFactionId;
        for (let r=0; r<Editor.mapData.height; r++) for (let c=0; c<Editor.mapData.width; c++) {
            if (Editor.mapData.tiles[r][c].owner === idToDelete) Editor.mapData.tiles[r][c].owner = null;
            if (Editor.mapData.tiles[r][c].unit?.owner === idToDelete) Editor.mapData.tiles[r][c].unit = null;
        }
        if (Editor.selectedFactionId === idToDelete) {
            Editor.selectedFactionId = Editor.mapData.factions[0]?.id || null;
            Editor.currentBrush = Editor.selectedFactionId ? `faction:${Editor.selectedFactionId}` : 'terrainLand';
        }
        Editor.renderFactionUI();
        Editor.renderEditor();
        Editor.saveState();
        document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
};

// 编辑城市名称弹窗
Editor.showEditCityModal = function() {
    if (!Editor.selectedTile) return;
    const tile = Editor.mapData.tiles[Editor.selectedTile.row]?.[Editor.selectedTile.col];
    if (!tile || !tile.city) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content">
            <h4>编辑城市名称 (${Editor.selectedTile.col}, ${Editor.selectedTile.row})</h4>
            <div class="modal-row"><label>城市名</label><input type="text" id="modalCityNameInput" value="${tile.cityName || ''}" placeholder="输入城市名称"></div>
            <div class="modal-actions"><button class="btn small" id="modalCityCancelBtn">取消</button><button class="btn small" id="modalCitySaveBtn">保存</button></div>
        </div>
    `;
    document.body.appendChild(overlay);
    const nameInput = document.getElementById('modalCityNameInput');
    document.getElementById('modalCityCancelBtn').addEventListener('click', () => document.body.removeChild(overlay));
    document.getElementById('modalCitySaveBtn').addEventListener('click', () => {
        tile.cityName = nameInput.value.trim();
        Editor.renderEditor();
        Editor.saveState();
        document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
    nameInput.focus();
    nameInput.select();
};

// 阵营顺序弹窗
Editor.showTurnOrderModal = function() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let listHtml = '';
    Editor.turnOrder.forEach((fId, idx) => {
        const f = Editor.mapData.factions.find(f => f.id === fId);
        if (!f) return;
        listHtml += `<div class="faction-item" style="margin-bottom:4px;">
            <div class="faction-color-badge" style="background:${f.color};"></div>
            <span class="faction-name-display">${idx+1}. ${f.name}</span>
            <div class="sort-controls">
                <button class="sort-btn" data-turn-up="${fId}" ${idx===0?'disabled':''}>↑</button>
                <button class="sort-btn" data-turn-down="${fId}" ${idx===Editor.turnOrder.length-1?'disabled':''}>↓</button>
            </div>
        </div>`;
    });
    overlay.innerHTML = `<div class="modal-content" style="min-width:320px;"><h4>编辑阵营轮替顺序</h4><div style="max-height:300px; overflow-y:auto;">${listHtml}</div><div class="modal-actions" style="margin-top:16px;"><button class="btn small" id="modalTurnCloseBtn">关闭</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-turn-up]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.turnUp;
            const index = Editor.turnOrder.indexOf(id);
            if (index > 0) {
                [Editor.turnOrder[index], Editor.turnOrder[index-1]] = [Editor.turnOrder[index-1], Editor.turnOrder[index]];
                document.body.removeChild(overlay);
                Editor.showTurnOrderModal();
                Editor.saveState();
            }
        });
    });
    overlay.querySelectorAll('[data-turn-down]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.turnDown;
            const index = Editor.turnOrder.indexOf(id);
            if (index < Editor.turnOrder.length-1) {
                [Editor.turnOrder[index], Editor.turnOrder[index+1]] = [Editor.turnOrder[index+1], Editor.turnOrder[index]];
                document.body.removeChild(overlay);
                Editor.showTurnOrderModal();
                Editor.saveState();
            }
        });
    });
    overlay.querySelector('#modalTurnCloseBtn').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
};

// 编辑单位弹窗
Editor.showEditUnitModal = function() {
    if (!Editor.selectedTile || !Editor.mapData.tiles[Editor.selectedTile.row]?.[Editor.selectedTile.col]?.unit) return;
    const unit = Editor.mapData.tiles[Editor.selectedTile.row][Editor.selectedTile.col].unit;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let factionOptions = Editor.mapData.factions.map(f => `<option value="${f.id}" ${unit.owner===f.id?'selected':''}>${f.name}</option>`).join('');
    overlay.innerHTML = `
        <div class="modal-content">
            <h4>编辑单位 (${Editor.selectedTile.col}, ${Editor.selectedTile.row})</h4>
            <div class="modal-row"><label>所属势力</label><select id="modalUnitOwner">${factionOptions}</select></div>
            <div class="modal-row"><label>血量 (1-${Editor.HP_MAX})</label><input type="range" id="modalUnitHp" value="${unit.hp}" min="1" max="${Editor.HP_MAX}" style="width:100%;"><span id="modalUnitHpValue" style="text-align:center;font-weight:bold;">${unit.hp}</span></div>
            <div class="modal-actions"><button class="btn small" id="modalUnitCancelBtn">取消</button><button class="btn small" id="modalUnitSaveBtn">保存</button></div>
        </div>
    `;
    document.body.appendChild(overlay);
    const hpRange = document.getElementById('modalUnitHp');
    const hpValue = document.getElementById('modalUnitHpValue');
    hpRange.addEventListener('input', () => { hpValue.textContent = hpRange.value; });
    document.getElementById('modalUnitCancelBtn').addEventListener('click', () => document.body.removeChild(overlay));
    document.getElementById('modalUnitSaveBtn').addEventListener('click', () => {
        unit.owner = document.getElementById('modalUnitOwner').value;
        unit.hp = parseInt(hpRange.value);
        Editor.renderEditor();
        Editor.saveState();
        document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
};
