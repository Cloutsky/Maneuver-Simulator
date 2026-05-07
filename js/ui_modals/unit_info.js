// ui_modals/unit_info.js
window.Game = window.Game || {};

Game.showUnitInfoModal = function() {
    if (!Game.selectedTile) return;
    const tile = Game.mapData.tiles[Game.selectedTile.row]?.[Game.selectedTile.col];
    if (!tile) return;
    const unit = tile.unit;
    const hasUnit = !!unit;
    const hasCity = tile.city && tile.owner === Game.turnOrder[Game.currentTurnIndex];
    if (!hasUnit && !hasCity) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let bodyHtml = '';
    let footerHtml = '';

    // Unit info section
    if (hasUnit) {
        const faction = Game.mapData.factions.find(f => f.id === unit.owner);
        const factionName = faction ? faction.name : '中立';
        const factionColor = faction ? faction.color : '#888';
        let attackPower = Game.DAMAGE;
        if (tile.terrain === 'sea') attackPower = Math.floor(attackPower / 2);
        const hp = unit.hp, maxHp = Game.HP_MAX;
        const isOwnUnit = (unit.owner === Game.turnOrder[Game.currentTurnIndex]);
        const hpClass = hp < 10 ? 'hp-low' : 'hp';

        bodyHtml += `
            <div class="modal-section-title">单位信息</div>
            <div class="modal-faction-name-row">
                <span class="modal-faction-dot" style="background:${factionColor};"></span>
                <span class="modal-faction-name">${factionName}</span>
            </div>
            <div class="modal-unit-stats">
                <div class="modal-unit-stat">
                    <span class="modal-unit-stat-label">血量</span>
                    <span class="modal-unit-stat-value ${hpClass}">${hp}</span>
                    <span class="modal-unit-stat-suffix">/ ${maxHp}</span>
                </div>
                <div class="modal-unit-stat">
                    <span class="modal-unit-stat-label">攻击力</span>
                    <span class="modal-unit-stat-value attack">${attackPower}</span>
                </div>
            </div>
        `;

        if (isOwnUnit) {
            footerHtml += `<button class="btn small danger" id="modalDeleteUnitBtn">删除单位</button>`;
        }
    }

    // City info section
    if (hasCity) {
        if (hasUnit) {
            bodyHtml += '<hr>';
        }
        bodyHtml += `
            <div class="modal-section-title">城市信息</div>
            <div class="modal-row">
                <label>城市名称</label>
                <input type="text" id="modalCityNameInput" value="${tile.cityName || ''}" placeholder="输入城市名">
            </div>
            <div class="modal-city-actions">
                <button class="btn small" id="modalSaveCityNameBtn">保存</button>
                <button class="btn small" id="modalClearCityNameBtn">清除</button>
            </div>
        `;
    }

    overlay.innerHTML = `
        <div class="game-modal-card">
            <div class="game-modal-header">
                <h4>📍 格子信息</h4>
                <button class="game-modal-close" id="modalInfoCloseBtn">✕</button>
            </div>
            <div class="game-modal-body">
                ${bodyHtml}
            </div>
            <div class="game-modal-footer">
                ${footerHtml}
                <button class="btn small" id="modalInfoCloseBtn2">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => {
        document.body.removeChild(overlay);
        Game.updateFloatingButtonsPosition();
    };

    document.getElementById('modalInfoCloseBtn').addEventListener('click', closeOverlay);
    document.getElementById('modalInfoCloseBtn2').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });

    // Delete unit handler
    if (hasUnit) {
        const deleteBtn = document.getElementById('modalDeleteUnitBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                closeOverlay();
                Game.deleteSelectedUnit();
            });
        }
    }

    // City name handlers
    if (hasCity) {
        const saveBtn = document.getElementById('modalSaveCityNameBtn');
        const clearBtn = document.getElementById('modalClearCityNameBtn');
        const input = document.getElementById('modalCityNameInput');
        
        saveBtn.addEventListener('click', () => {
            const newName = input.value.trim();
            tile.cityName = newName;
            Game.drawMap();
            Game.saveGameState();
            closeOverlay();
        });
        clearBtn.addEventListener('click', () => {
            tile.cityName = '';
            Game.drawMap();
            Game.saveGameState();
            closeOverlay();
        });
    }
};
