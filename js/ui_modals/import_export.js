// ui_modals/import_export.js
window.Game = window.Game || {};

Game.showExportDialog = function() {
    const now = new Date();
    const timeStr = now.toISOString().slice(0,10).replace(/-/g,'');
    const defaultName = `${Game.mapData.title || '未命名地图'}_${timeStr}.json`;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="game-modal-card">
            <div class="game-modal-header">
                <h4>💾 保存地图</h4>
                <button class="game-modal-close" id="modalCancelSaveBtn">✕</button>
            </div>
            <div class="game-modal-body">
                <div class="modal-row">
                    <label>文件名</label>
                    <input type="text" id="modalFileName" value="${defaultName}">
                </div>
            </div>
            <div class="game-modal-footer">
                <button class="btn small" id="modalCancelSaveBtn2">取消</button>
                <button class="btn small" id="modalConfirmSaveBtn">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const closeOverlay = () => {
        document.body.removeChild(overlay);
        Game.updateFloatingButtonsPosition();
    };
    
    document.getElementById('modalCancelSaveBtn').addEventListener('click', closeOverlay);
    document.getElementById('modalCancelSaveBtn2').addEventListener('click', closeOverlay);
    document.getElementById('modalConfirmSaveBtn').addEventListener('click', () => {
        let fileName = document.getElementById('modalFileName').value.trim();
        if (!fileName.endsWith('.json')) fileName += '.json';
        const jsonStr = JSON.stringify(Game.mapData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        document.body.removeChild(overlay);
        Game.saveGameState();
        Game.updateFloatingButtonsPosition();
    });
    
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
};

// Game.showImportDialog 已移除，统一使用 MainMenu.openMapSelectPanel('game')
