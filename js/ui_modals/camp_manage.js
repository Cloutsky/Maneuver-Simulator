// ui_modals/camp_manage.js
window.Game = window.Game || {};

Game.showCampManageModal = function() {
    const factions = Game.mapData.factions;
    // Collect all unique camp tags
    const camps = new Map();
    factions.forEach(f => {
        const camp = f.camp || '';
        if (!camps.has(camp)) camps.set(camp, []);
        camps.get(camp).push(f);
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let campListHtml = '';
    camps.forEach((members, campName) => {
        const displayName = campName || '（无阵营）';
        campListHtml += `
            <div class="modal-row">
                <label class="modal-section-title">${displayName}</label>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${members.map(f => {
                        const isLeader = f.id === members[0].id && members.length > 1;
                        const statusClass = isLeader ? 'leader' : (members.length > 1 ? 'member' : '');
                        return `<span class="modal-status ${statusClass}" style="border-left:3px solid ${f.color};">${f.name}${isLeader ? ' ★' : ''}</span>`;
                    }).join('')}
                </div>
            </div>
        `;
    });

    let factionOptionsHtml = factions.map(f =>
        `<option value="${f.id}">${f.name}</option>`
    ).join('');

    overlay.innerHTML = `
        <div class="game-modal-card">
            <div class="game-modal-header">
                <h4>🏕️ 阵营管理</h4>
                <button class="game-modal-close" id="modalCampCloseBtn">✕</button>
            </div>
            <div class="game-modal-body">
                ${campListHtml}
                <hr>
                <div class="modal-section-title">添加势力到阵营</div>
                <div class="modal-row-inline">
                    <select id="modalCampFactionSelect">${factionOptionsHtml}</select>
                    <select id="modalCampSelect">
                        <option value="">-- 新阵营 --</option>
                        ${Array.from(camps.keys()).filter(c => c !== '').map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-row">
                    <input type="text" id="modalNewCampName" placeholder="输入新阵营名（可选）">
                </div>
                <button class="btn btn-full" id="modalAddToCampBtn">添加到阵营</button>
                <hr>
                <div class="modal-section-title">移除势力阵营</div>
                <div class="modal-row-inline">
                    <select id="modalRemoveFactionSelect">${factionOptionsHtml}</select>
                </div>
                <button class="btn btn-full danger" id="modalRemoveCampBtn">从阵营移除</button>
            </div>
            <div class="game-modal-footer">
                <button class="btn small" id="modalCampCancelBtn">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => {
        document.body.removeChild(overlay);
        Game.updateFloatingButtonsPosition();
        Game.drawMap();
    };

    document.getElementById('modalCampCloseBtn').addEventListener('click', closeOverlay);
    document.getElementById('modalCampCancelBtn').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });

    document.getElementById('modalAddToCampBtn').addEventListener('click', () => {
        const factionId = document.getElementById('modalCampFactionSelect').value;
        let targetCamp = document.getElementById('modalCampSelect').value;
        const newCampName = document.getElementById('modalNewCampName').value.trim();
        if (newCampName) targetCamp = newCampName;
        if (!factionId) return;
        const faction = factions.find(f => f.id === factionId);
        if (faction) {
            faction.camp = targetCamp;
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${faction.name} 加入了阵营 ${targetCamp || '（无）'}`
            });
        }
        Game.renderFactionLegend();
        Game.drawMap();
        Game.saveGameState();
        closeOverlay();
        setTimeout(() => Game.showCampManageModal(), 50);
    });

    document.getElementById('modalRemoveCampBtn').addEventListener('click', () => {
        const factionId = document.getElementById('modalRemoveFactionSelect').value;
        if (!factionId) return;
        const faction = factions.find(f => f.id === factionId);
        if (faction) {
            const oldCamp = faction.camp || '（无）';
            faction.camp = '';
            Game.mapData.events.push({
                round: Game.currentRound,
                time: new Date().toLocaleString(),
                description: `${faction.name} 离开了阵营 ${oldCamp}`
            });
        }
        Game.renderFactionLegend();
        Game.drawMap();
        Game.saveGameState();
        closeOverlay();
        setTimeout(() => Game.showCampManageModal(), 50);
    });
};
