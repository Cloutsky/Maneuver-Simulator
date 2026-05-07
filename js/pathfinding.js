// pathfinding.js
window.Game = window.Game || {};

Game.lastMoveParents = null;

Game.collectPathCells = function(r, c, parents, sr, sc) {
    const set = new Set();
    const key = `${r},${c}`;
    set.add(key);
    if (r === sr && c === sc) return set;
    const stack = [{ row: r, col: c }];
    const visited = new Set();
    visited.add(key);
    while (stack.length > 0) {
        const { row, col } = stack.pop();
        const cellParents = parents[row]?.[col];
        if (!cellParents || cellParents.length === 0) continue;
        for (const p of cellParents) {
            const pKey = `${p.row},${p.col}`;
            set.add(pKey);
            if (!visited.has(pKey)) {
                visited.add(pKey);
                stack.push({ row: p.row, col: p.col });
            }
        }
    }
    return set;
};

Game.getOccupationOwner = function(startRow, startCol) {
    const cur = Game.turnOrder[Game.currentTurnIndex];
    const startTile = Game.mapData.tiles[startRow][startCol];
    if (startTile.owner && startTile.owner !== cur && Game.areFactionsAllied(cur, startTile.owner)) {
        return startTile.owner;
    }
    return cur;
};

Game.calculateMoveRange = function(startRow, startCol) {
    const cur = Game.turnOrder[Game.currentTurnIndex];
    const unit = Game.mapData.tiles[startRow][startCol].unit;
    if (!unit || unit.owner !== cur || unit.hasMoved || unit.hasAttacked) return [];

    const occupationOwner = Game.getOccupationOwner(startRow, startCol);
    const h = Game.mapData.height, w = Game.mapData.width;
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const startTile = Game.mapData.tiles[startRow][startCol];
    const startTerrain = startTile.terrain;
    const startOnLand = Game.isLandTerrain(startTerrain);
    const startOwner = startTile.owner || cur;

    const state = Array(h).fill().map(() => Array(w).fill(null));
    const parents = Array(h).fill().map(() => Array(w).fill(null));
    const queue = [{ row: startRow, col: startCol, steps: 0 }];
    state[startRow][startCol] = { dist: 0, parents: null };

    const amphibiousTargets = [];

    if (startOnLand && Game.hasTerrainIn3x3(startRow, startCol, t => t === 'sea')) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = startRow + dr, nc = startCol + dc;
                if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
                const tile = Game.mapData.tiles[nr][nc];
                if (tile.terrain !== 'sea') continue;
                if (tile.unit) continue;
                amphibiousTargets.push({ row: nr, col: nc, isInvasion: false, isAid: false });
                if (!parents[nr][nc]) parents[nr][nc] = [];
                parents[nr][nc].push({ row: startRow, col: startCol });
                if (!state[nr][nc]) {
                    state[nr][nc] = { dist: 1, parents: [{ row: startRow, col: startCol }] };
                }
            }
        }
    } else if (!startOnLand && Game.hasTerrainIn3x3(startRow, startCol, t => t === 'land')) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = startRow + dr, nc = startCol + dc;
                if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
                const tile = Game.mapData.tiles[nr][nc];
                if (tile.terrain !== 'land') continue;
                if (tile.unit && !Game.areFactionsAllied(cur, tile.unit.owner)) continue;
                const isInvasion = (tile.owner && !Game.areFactionsAllied(occupationOwner, tile.owner)) ||
                                   (tile.city && !Game.areFactionsAllied(occupationOwner, tile.owner));
                const isAid = false;
                amphibiousTargets.push({ row: nr, col: nc, isInvasion: isInvasion, isAid: isAid });
                if (!parents[nr][nc]) parents[nr][nc] = [];
                parents[nr][nc].push({ row: startRow, col: startCol });
                if (!state[nr][nc]) {
                    state[nr][nc] = { dist: 1, parents: [{ row: startRow, col: startCol }] };
                }
            }
        }
    }

    while (queue.length > 0) {
        const { row, col, steps } = queue.shift();
        if (steps >= 3) continue;
        const curTerrain = Game.mapData.tiles[row][col].terrain;
        const curIsLand = Game.isLandTerrain(curTerrain);
        for (const [dr, dc] of dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
            const cheb = Math.max(Math.abs(nr - startRow), Math.abs(nc - startCol));
            if (cheb > 2) continue;
            if (cheb === 2 && Math.abs(nr - startRow) + Math.abs(nc - startCol) === 4) continue;
            const tile = Game.mapData.tiles[nr][nc];
            if (tile.terrain === 'mountain') continue;
            if (tile.unit && !Game.areFactionsAllied(cur, tile.unit.owner)) continue;
            const nextIsLand = Game.isLandTerrain(tile.terrain);
            if (curIsLand !== nextIsLand) continue;
            const enemyCity = (tile.city && tile.owner &&
                               !Game.areFactionsAllied(occupationOwner, tile.owner));
            const nd = steps + 1;
            if (!state[nr][nc]) {
                state[nr][nc] = { dist: nd, parents: [{ row, col }] };
                parents[nr][nc] = [{ row, col }];
                if (!enemyCity) {
                    queue.push({ row: nr, col: nc, steps: nd });
                }
            } else if (state[nr][nc].dist === nd) {
                state[nr][nc].parents.push({ row, col });
                if (!parents[nr][nc]) parents[nr][nc] = [];
                parents[nr][nc].push({ row, col });
            }
        }
    }

    Game.lastMoveParents = parents;
    let reachable = [...amphibiousTargets];

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            if (!state[r][c]) continue;
            if (r === startRow && c === startCol) continue;
            if (amphibiousTargets.some(t => t.row === r && t.col === c)) continue;

            const tile = Game.mapData.tiles[r][c];
            if (tile.unit && Game.areFactionsAllied(cur, tile.unit.owner)) continue;

            const pathSet = Game.collectPathCells(r, c, parents, startRow, startCol);
            let isInvasion = false;
            let isAid = false;

            for (const pos of pathSet) {
                const [pr, pc] = pos.split(',').map(Number);
                const pt = Game.mapData.tiles[pr][pc];
                if (pt.terrain === 'land' && !pt.unit && !pt.city) {
                    if (pt.owner && !Game.areFactionsAllied(occupationOwner, pt.owner)) {
                        isInvasion = true;
                        break;
                    } else if (!pt.owner) {
                        isInvasion = true;
                        break;
                    }
                }
                if (pr === r && pc === c && pt.city && pt.owner &&
                    !Game.areFactionsAllied(occupationOwner, pt.owner)) {
                    isInvasion = true;
                    break;
                }
            }

            if (!isInvasion && tile.owner && tile.owner !== cur && Game.areFactionsAllied(cur, tile.owner)) {
                const endOwner = tile.owner;
                if (endOwner !== startOwner) {
                    isAid = true;
                }
            }

            reachable.push({ row: r, col: c, isInvasion, isAid });
        }
    }

    if (Game.invaded || Game.produced) {
        reachable = reachable.filter(m => !m.isAid);
    }
    if (Game.aided || Game.produced) {
        reachable = reachable.filter(m => !m.isInvasion);
    }

    return reachable;
};

Game.getUnitAttackTargets = function(row, col) {
    const cur = Game.turnOrder[Game.currentTurnIndex];
    const unit = Game.mapData.tiles[row]?.[col]?.unit;
    if (!unit || unit.owner !== cur || unit.hasAttacked) return [];

    const curFaction = Game.mapData.factions.find(f => f.id === cur);
    const curCamp = curFaction ? curFaction.camp : '';

    const targets = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            if (nr < 0 || nr >= Game.mapData.height || nc < 0 || nc >= Game.mapData.width) continue;
            const tile = Game.mapData.tiles[nr][nc];
            if (tile.unit && tile.unit.owner !== cur) {
                const targetFaction = Game.mapData.factions.find(f => f.id === tile.unit.owner);
                const targetCamp = targetFaction ? targetFaction.camp : '';
                if (curCamp && targetCamp && curCamp === targetCamp) continue;
                targets.push({ row: nr, col: nc });
            }
        }
    }
    return targets;
};

Game.getJointAttackInfo = function() {
    const cur = Game.turnOrder[Game.currentTurnIndex];
    if (!Game.selectedTile) return { candidates: [], jointTargets: [], currentSet: [] };
    const sr = Game.selectedTile.row, sc = Game.selectedTile.col;
    const mainUnit = Game.mapData.tiles[sr]?.[sc]?.unit;
    if (!mainUnit || mainUnit.owner !== cur || mainUnit.hasAttacked) {
        return { candidates: [], jointTargets: [], currentSet: [] };
    }
    const currentSet = [{row:sr, col:sc}, ...Game.extraSelectedUnits];
    const unitTargets = new Map();
    for (const u of currentSet) {
        const targets = Game.getUnitAttackTargets(u.row, u.col);
        unitTargets.set(`${u.row},${u.col}`, targets);
    }
    const enemyAttackers = new Map();
    for (const [unitKey, targets] of unitTargets) {
        for (const t of targets) {
            const key = `${t.row},${t.col}`;
            if (!enemyAttackers.has(key)) enemyAttackers.set(key, new Set());
            enemyAttackers.get(key).add(unitKey);
        }
    }
    const jointTargets = [];
    for (const [enemyKey, attackers] of enemyAttackers) {
        if (attackers.size >= currentSet.length) {
            const [r, c] = enemyKey.split(',').map(Number);
            jointTargets.push({ row: r, col: c });
        }
    }
    const candidateSet = new Set();
    if (jointTargets.length > 0 && currentSet.length < 3) {
        for (const enemy of jointTargets) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = enemy.row + dr, nc = enemy.col + dc;
                    if (nr < 0 || nr >= Game.mapData.height || nc < 0 || nc >= Game.mapData.width) continue;
                    const unit = Game.mapData.tiles[nr]?.[nc]?.unit;
                    if (!unit || unit.owner !== cur || unit.hasAttacked) continue;
                    if (currentSet.some(u => u.row === nr && u.col === nc)) continue;
                    const targets = Game.getUnitAttackTargets(nr, nc);
                    if (targets.some(t => t.row === enemy.row && t.col === enemy.col)) {
                        candidateSet.add(`${nr},${nc}`);
                    }
                }
            }
        }
    }
    const candidates = [...candidateSet].map(s => {
        const [r, c] = s.split(',').map(Number);
        return { row: r, col: c };
    });
    return { candidates, jointTargets, currentSet };
};

Game.calculateProductionCells = function(cityRow, cityCol) {
    const curFaction = Game.turnOrder[Game.currentTurnIndex];
    const cells = [];
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            const nr = cityRow + dr;
            const nc = cityCol + dc;
            if (nr < 0 || nr >= Game.mapData.height || nc < 0 || nc >= Game.mapData.width) continue;
            const tile = Game.mapData.tiles[nr][nc];
            if (tile.terrain === 'land' && tile.owner === curFaction && !tile.unit) {
                cells.push({ row: nr, col: nc });
            }
        }
    }
    return cells;
};