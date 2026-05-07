// utils.js
window.Game = window.Game || {};

Game.areFactionsAllied = function(factionIdA, factionIdB) {
    if (factionIdA === factionIdB) return true;
    const facA = Game.mapData.factions.find(f => f.id === factionIdA);
    const facB = Game.mapData.factions.find(f => f.id === factionIdB);
    if (!facA || !facB) return false;
    if (!facA.camp || !facB.camp) return false;
    return facA.camp === facB.camp;
};

Game.isSea = function(row, col) {
    return Game.mapData.tiles[row]?.[col]?.terrain === 'sea';
};

Game.isLandTerrain = function(terrain) {
    return terrain === 'land' || terrain === 'mountain';
};

Game.hasTerrainIn3x3 = function(row, col, checkFn) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= Game.mapData.height || nc < 0 || nc >= Game.mapData.width) continue;
            if (checkFn(Game.mapData.tiles[nr][nc].terrain)) return true;
        }
    }
    return false;
};