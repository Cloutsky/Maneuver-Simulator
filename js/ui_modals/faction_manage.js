// ui_modals/faction_manage.js
window.Game = window.Game || {};

Game.showManageFactionModal = function() {
    const curId = Game.turnOrder[Game.currentTurnIndex];
    const faction = Game.mapData.factions.find(f => f.id === curId);
    if (!faction) {
        alert("当前没有势力可管理。");
        return;
    }

    const oldName = faction.name;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="game-modal-card">
            <div class="game-modal-header">
                <h4>⚙️ 管理势力：${faction.name}</h4>
                <button class="game-modal-close" id="modalFactionCloseBtn">✕</button>
            </div>
            <div class="game-modal-body">
                <div class="modal-row">
                    <label>势力名称</label>
                    <input type="text" id="modalFactionName" value="${faction.name}">
                </div>
                <div class="modal-row">
                    <label>势力颜色</label>
                    <input type="color" id="modalFactionColor" value="${faction.color}">
                </div>
            </div>
            <div class="game-modal-footer split">
                <div class="footer-group">
                    <button class="btn small danger" id="modalSurrenderBtn">投降</button>
                    <button class="btn small" id="modalCessionBtn">割让</button>
                </div>
                <div class="footer-group">
                    <button class="btn small" id="modalFactionCancelBtn">取消</button>
                    <button class="btn small" id="modalFactionSaveBtn">保存</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = document.getElementById('modalFactionName');
    const colorInput = document.getElementById('modalFactionColor');

    const closeOverlay = () => {
        document.body.removeChild(overlay);
        Game.updateFloatingButtonsPosition();
    };

    const saveChanges = () => {
        const newName = nameInput.value.trim() || faction.name;
        const newColor = colorInput.value;

        if (newName !== oldName) {
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${oldName} 现在被称为 ${newName}`
            });
            faction.name = newName;
        }
        faction.color = newColor;

        Game.renderFactionLegend();
        Game.buildOffscreenMap();
        Game.drawMap();
        Game.saveGameState();
        closeOverlay();
    };

    document.getElementById('modalFactionCloseBtn').addEventListener('click', closeOverlay);
    document.getElementById('modalFactionCancelBtn').addEventListener('click', closeOverlay);
    document.getElementById('modalFactionSaveBtn').addEventListener('click', saveChanges);

    document.getElementById('modalSurrenderBtn').addEventListener('click', () => {
        const otherFactions = Game.mapData.factions.filter(f => f.id !== curId);
        if (otherFactions.length === 0) {
            alert("没有其他势力可以投降。");
            return;
        }

        let optionsHtml = '';
        otherFactions.forEach(f => {
            optionsHtml += `<option value="${f.id}">${f.name}</option>`;
        });

        overlay.querySelector('.game-modal-card').innerHTML = `
            <div class="game-modal-header">
                <h4>选择投降对象</h4>
                <button class="game-modal-close" id="modalSurrenderBackBtn">✕</button>
            </div>
            <div class="game-modal-body">
                <div class="modal-row">
                    <label>投降给</label>
                    <select id="modalSurrenderTarget">${optionsHtml}</select>
                </div>
                <p class="modal-warning">⚠️ 警告：本操作会删除当前势力</p>
            </div>
            <div class="game-modal-footer right">
                <button class="btn small" id="modalSurrenderCancelBtn">取消</button>
                <button class="btn small danger" id="modalSurrenderConfirmBtn">确定</button>
            </div>
        `;

        document.getElementById('modalSurrenderBackBtn').addEventListener('click', closeOverlay);
        document.getElementById('modalSurrenderCancelBtn').addEventListener('click', () => {
            closeOverlay();
            Game.showManageFactionModal();
        });
        document.getElementById('modalSurrenderConfirmBtn').addEventListener('click', () => {
            const targetId = document.getElementById('modalSurrenderTarget').value;
            closeOverlay();
            Game.performSurrender(targetId);
        });
    });

    document.getElementById('modalCessionBtn').addEventListener('click', () => {
        const otherFactions = Game.mapData.factions.filter(f => f.id !== curId);

        let optionsHtml = '';
        otherFactions.forEach(f => {
            optionsHtml += `<option value="${f.id}">${f.name}</option>`;
        });

        overlay.querySelector('.game-modal-card').innerHTML = `
            <div class="game-modal-header">
                <h4>选择割让对象</h4>
                <button class="game-modal-close" id="modalCessionBackBtn">✕</button>
            </div>
            <div class="game-modal-body">
                <div class="modal-row">
                    <label>割让给</label>
                    <select id="modalCessionTarget">
                        <option value="" disabled selected>-- 请选择势力 --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="modal-row">
                    <button class="btn" id="modalCreateNewFactionBtn">新建势力</button>
                </div>
            </div>
            <div class="game-modal-footer right">
                <button class="btn small" id="modalCessionCancelBtn">取消</button>
                <button class="btn small" id="modalCessionConfirmBtn">确定</button>
            </div>
        `;

        document.getElementById('modalCessionBackBtn').addEventListener('click', closeOverlay);
        document.getElementById('modalCessionCancelBtn').addEventListener('click', () => {
            closeOverlay();
            Game.showManageFactionModal();
        });

        document.getElementById('modalCessionConfirmBtn').addEventListener('click', () => {
            const select = document.getElementById('modalCessionTarget');
            if (!select.value) {
                alert("请先选择一个势力或新建势力。");
                return;
            }
            const targetId = select.value;
            const targetFaction = Game.mapData.factions.find(f => f.id === targetId);
            if (!targetFaction) {
                alert("目标势力不存在。");
                return;
            }
            closeOverlay();
            Game.enterCessionMode(targetId, targetFaction.name, false);
        });

        document.getElementById('modalCreateNewFactionBtn').addEventListener('click', () => {
            overlay.querySelector('.game-modal-card').innerHTML = `
                <div class="game-modal-header">
                    <h4>新建势力信息</h4>
                    <button class="game-modal-close" id="modalNewFactionBackBtn">✕</button>
                </div>
                <div class="game-modal-body">
                    <div class="modal-row">
                        <label>势力名称</label>
                        <input type="text" id="modalNewFactionName" placeholder="新势力">
                    </div>
                    <div class="modal-row">
                        <label>势力颜色</label>
                        <input type="color" id="modalNewFactionColor" value="#aa88ff">
                    </div>
                </div>
                <div class="game-modal-footer right">
                    <button class="btn small" id="modalBackToCessionBtn">返回</button>
                    <button class="btn small" id="modalCreateFactionContinueBtn">继续选择领地</button>
                </div>
            `;

            document.getElementById('modalNewFactionBackBtn').addEventListener('click', closeOverlay);
            document.getElementById('modalBackToCessionBtn').addEventListener('click', () => {
                closeOverlay();
                Game.showManageFactionModal();
            });

            document.getElementById('modalCreateFactionContinueBtn').addEventListener('click', () => {
                const newName = document.getElementById('modalNewFactionName').value.trim() || '新势力';
                const newColor = document.getElementById('modalNewFactionColor').value;
                closeOverlay();
                Game.enterCessionMode('', newName, true, newName, newColor);
            });
        });
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });
};
