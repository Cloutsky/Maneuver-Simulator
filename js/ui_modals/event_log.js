// ui_modals/event_log.js
window.Game = window.Game || {};

Game.showEventLog = function() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    let listHtml = '';
    if (Game.mapData.events && Game.mapData.events.length > 0) {
        listHtml = '<ul class="event-list">';
        Game.mapData.events.forEach(ev => {
            listHtml += `<li><span class="event-round">第${ev.round}轮</span>${ev.description}</li>`;
        });
        listHtml += '</ul>';
    } else {
        listHtml = '<div class="event-empty">目前没有记录</div>';
    }

    overlay.innerHTML = `
        <div class="game-modal-card">
            <div class="game-modal-header">
                <h4>📜 本局事件记录</h4>
                <button class="game-modal-close" id="modalEventCloseBtn">✕</button>
            </div>
            <div class="game-modal-body">
                ${listHtml}
            </div>
            <div class="game-modal-footer"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => {
        document.body.removeChild(overlay);
        Game.updateFloatingButtonsPosition();
    };

    document.getElementById('modalEventCloseBtn').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });
};
