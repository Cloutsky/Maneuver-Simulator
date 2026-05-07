// faction.js
window.Game = window.Game || {};

Game.updateMountainControl = function() {
    let changed = true;
    while (changed) {
        changed = false;
        for (let r = 0; r < Game.mapData.height; r++) {
            for (let c = 0; c < Game.mapData.width; c++) {
                const tile = Game.mapData.tiles[r][c];
                if (tile.terrain !== 'mountain') continue;

                const counts = {};
                let totalNeighbors = 0;

                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr < 0 || nr >= Game.mapData.height || nc < 0 || nc >= Game.mapData.width) continue;

                        const neighbor = Game.mapData.tiles[nr][nc];
                        if (neighbor.terrain === 'sea') continue;

                        totalNeighbors++;
                        if (neighbor.owner) {
                            counts[neighbor.owner] = (counts[neighbor.owner] || 0) + 1;
                        }
                    }
                }

                if (totalNeighbors === 0) {
                    if (tile.owner !== null) {
                        tile.owner = null;
                        changed = true;
                    }
                    continue;
                }

                const half = totalNeighbors / 2;
                const qualifiedFactions = [];
                for (const [factionId, count] of Object.entries(counts)) {
                    if (count >= half) {
                        qualifiedFactions.push(factionId);
                    }
                }

                let newOwner = null;
                if (qualifiedFactions.length === 1) {
                    newOwner = qualifiedFactions[0];
                }

                if (tile.owner !== newOwner) {
                    tile.owner = newOwner;
                    changed = true;
                }
            }
        }
    }
};

Game.checkFactionElimination = function() {
    const factionStats = {};
    Game.mapData.factions.forEach(f => { factionStats[f.id] = { hasTerritory: false, hasUnit: false }; });

    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const tile = Game.mapData.tiles[r][c];
            if (tile.owner && factionStats[tile.owner]) factionStats[tile.owner].hasTerritory = true;
            if (tile.unit && tile.unit.owner && factionStats[tile.unit.owner]) factionStats[tile.unit.owner].hasUnit = true;
        }
    }

    const eliminatedIds = [];
    for (const [id, stats] of Object.entries(factionStats)) {
        if (!stats.hasTerritory && !stats.hasUnit) eliminatedIds.push(id);
    }

    if (eliminatedIds.length > 0) {
        const eliminatorId = Game.turnOrder[Game.currentTurnIndex];
        const eliminatorFaction = Game.mapData.factions.find(f => f.id === eliminatorId);
        const eliminatedNames = eliminatedIds.map(id => {
            const f = Game.mapData.factions.find(f => f.id === id);
            return f ? f.name : id;
        }).join('、');

        Game.mapData.events.push({
            round: Game.currentRound,
            time: new Date().toLocaleString(),
            description: `${eliminatorFaction ? eliminatorFaction.name : '未知势力'} 消灭了 ${eliminatedNames}`
        });

        const oldIndex = Game.currentTurnIndex;
        const wasLast = (oldIndex === Game.turnOrder.length - 1);

        Game.turnOrder = Game.turnOrder.filter(id => !eliminatedIds.includes(id));
        Game.mapData.factions = Game.mapData.factions.filter(f => !eliminatedIds.includes(f.id));

        if (eliminatedIds.includes(eliminatorId)) {
            if (Game.turnOrder.length === 0) {
                Game.initMapData();
                return;
            } else {
                Game.currentTurnIndex = 0;
            }
        }

        if (wasLast && Game.currentTurnIndex === 0 && Game.turnOrder.length > 0) {
            Game.currentRound++;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="text-align:center;">
                <h2 style="color:#d94f4f; margin-bottom:12px;">战败</h2>
                <p style="font-size:18px; color:#e3e9f2; margin:8px 0;">
                    ${eliminatorFaction ? eliminatorFaction.name : '未知势力'} 消灭了 ${eliminatedNames}
                </p>
                <button class="btn small" id="eliminationCloseBtn" style="margin-top:16px;">确定</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('eliminationCloseBtn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            Game.invalidateStatsCache();
            Game.drawMap();
            Game.saveGameState();
            Game.updateFloatingButtonsPosition();
        });
    }
};