// combat.js
window.Game = window.Game || {};

Game.attackUnit = function(ar, ac, dr, dc) {
    const at = Game.mapData.tiles[ar][ac];
    const dt = Game.mapData.tiles[dr][dc];
    if (!at.unit || !dt.unit) return;

    if (Game.areFactionsAllied(at.unit.owner, dt.unit.owner)) return;

    let attackerDamage = Game.DAMAGE;
    let defenderDamage = Game.DAMAGE;

    if (Game.isSea(ar, ac)) {
        attackerDamage = Math.floor(attackerDamage / 2);
    }
    if (Game.isSea(dr, dc)) {
        defenderDamage = Math.floor(defenderDamage / 2);
    }

    const aoH = at.unit.hp, doH = dt.unit.hp;
    const defenderOwner = dt.unit.owner;

    dt.unit.hp -= attackerDamage;
    at.unit.hp -= defenderDamage;
    at.unit.hasAttacked = true;

    const ad = at.unit.hp <= 0, dd = dt.unit.hp <= 0;
    if (ad) at.unit = null;
    if (dd) dt.unit = null;

    Game.lastCommand = {
        type: 'attack',
        attackerRow: ar, attackerCol: ac,
        defenderRow: dr, defenderCol: dc,
        attackerOldHP: aoH, defenderOldHP: doH,
        attackerDead: ad, defenderDead: dd,
        attackerDamage, defenderDamage,
        defenderOwner
    };
    Game.updateUndoButtonVisibility();
    if (!ad) {
        Game.selectedTile = { col: ac, row: ar };
    } else {
        Game.selectedTile = null;
    }
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
    Game.invalidateStatsCache();
    Game.updateMountainControl();
    Game.buildOffscreenMap();
    Game.refreshCurrentPopulation();
    Game.checkFactionElimination();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};

Game.jointAttack = function(tr, tc) {
    const cur = Game.turnOrder[Game.currentTurnIndex];
    const units = [Game.selectedTile, ...Game.extraSelectedUnits];
    const tt = Game.mapData.tiles[tr][tc];
    if (!tt.unit || units.some(u => !Game.mapData.tiles[u.row]?.[u.col]?.unit || Game.mapData.tiles[u.row][u.col].unit.owner !== cur)) return;

    for (const u of units) {
        const attackerUnit = Game.mapData.tiles[u.row][u.col].unit;
        if (attackerUnit && Game.areFactionsAllied(attackerUnit.owner, tt.unit.owner)) return;
    }

    let seaCount = 0;
    for (const u of units) {
        if (Game.isSea(u.row, u.col)) seaCount++;
    }
    const finalDamage = Math.floor(Game.DAMAGE * (6 - seaCount) / 6);

    const atStates = units.map(u => {
        const un = Game.mapData.tiles[u.row][u.col].unit;
        return { row: u.row, col: u.col, hp: un.hp };
    });
    const doH = tt.unit.hp;
    const defenderOwner = tt.unit.owner;

    tt.unit.hp -= finalDamage;
    if (tt.unit.hp <= 0) tt.unit = null;
    units.forEach(u => {
        const un = Game.mapData.tiles[u.row][u.col].unit;
        if (un) un.hasAttacked = true;
    });
    const dd = !tt.unit;

    Game.lastCommand = {
        type: 'jointAttack',
        attackerStates: atStates,
        targetRow: tr, targetCol: tc,
        defenderOldHP: doH,
        defenderDead: dd,
        finalDamage,
        defenderOwner
    };
    Game.updateUndoButtonVisibility();
    Game.selectedTile = { col: units[0].col, row: units[0].row };
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
    Game.invalidateStatsCache();
    Game.updateMountainControl();
    Game.buildOffscreenMap();
    Game.refreshCurrentPopulation();
    Game.checkFactionElimination();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};

Game.moveUnit = function(fr, fc, tr, tc) {
    const tf = Game.mapData.tiles[fr][fc];
    const tt = Game.mapData.tiles[tr][tc];
    if (!tf.unit || tt.unit) return;
    const cur = Game.turnOrder[Game.currentTurnIndex];

    const moveTarget = Game.moveRange.find(m => m.row === tr && m.col === tc);
    if (!moveTarget) return;
    const { isInvasion, isAid } = moveTarget;

    if (isInvasion && Game.aided) return;
    if (isAid && (Game.invaded || Game.produced)) return;

    const occupationOwner = Game.getOccupationOwner(fr, fc);
    const mountainSnapshot = [];
    for (let r = 0; r < Game.mapData.height; r++) {
        for (let c = 0; c < Game.mapData.width; c++) {
            const t = Game.mapData.tiles[r][c];
            if (t.terrain === 'mountain') {
                mountainSnapshot.push({ row: r, col: c, owner: t.owner });
            }
        }
    }

    const parents = Game.lastMoveParents;
    let pathSet;
    if (parents) {
        pathSet = Game.collectPathCells(tr, tc, parents, fr, fc);
    } else {
        const minR = Math.min(fr, tr), maxR = Math.max(fr, tr);
        const minC = Math.min(fc, tc), maxC = Math.max(fc, tc);
        pathSet = new Set();
        for (let r = minR; r <= maxR; r++)
            for (let c = minC; c <= maxC; c++)
                pathSet.add(`${r},${c}`);
        pathSet.add(`${fr},${fc}`);
    }

    const affectedTiles = [];
    let didInvasion = false;

    if (isInvasion) {
        for (const key of pathSet) {
            const [r, c] = key.split(',').map(Number);
            if (r === fr && c === fc) continue;
            const tile = Game.mapData.tiles[r][c];
            if (tile.terrain === 'land' && !tile.unit && !tile.city) {
                if (tile.owner && Game.areFactionsAllied(occupationOwner, tile.owner)) continue;
                if (tile.owner !== occupationOwner) {
                    affectedTiles.push({ row: r, col: c, prevOwner: tile.owner });
                    tile.owner = occupationOwner;
                    didInvasion = true;
                }
            }
        }
        if (tt.city && tt.owner && !Game.areFactionsAllied(occupationOwner, tt.owner)) {
            affectedTiles.push({ row: tr, col: tc, prevOwner: tt.owner });
            tt.owner = occupationOwner;
            didInvasion = true;
        }
    }

    tt.unit = tf.unit;
    tf.unit = null;
    tt.unit.hasMoved = true;

    Game.syncUnitTerritories();
    if (didInvasion) Game.invaded = true;
    if (isAid) Game.aided = true;

    Game.updateMountainControl();

    Game.lastCommand = {
        type: 'move',
        fromRow: fr, fromCol: fc,
        toRow: tr, toCol: tc,
        affectedTiles,
        wasInvasion: didInvasion,
        wasAid: isAid,
        mountainSnapshot,
        occupationOwner
    };
    Game.updateUndoButtonVisibility();
    Game.selectedTile = { col: tc, row: tr };
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
    Game.invalidateStatsCache();
    Game.buildOffscreenMap();
    Game.refreshCurrentPopulation();
    Game.checkFactionElimination();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};

Game.undoLastAction = function() {
    if (!Game.lastCommand) return;
    const cmd = Game.lastCommand;

    if (cmd.type === 'move') {
        if (cmd.affectedTiles) {
            for (const { row, col, prevOwner } of cmd.affectedTiles) {
                Game.mapData.tiles[row][col].owner = prevOwner;
            }
        }
        const tf = Game.mapData.tiles[cmd.fromRow]?.[cmd.fromCol];
        const tt = Game.mapData.tiles[cmd.toRow]?.[cmd.toCol];
        if (tt && tt.unit) {
            tf.unit = tt.unit;
            tt.unit = null;
            tf.unit.hasMoved = false;
        }
        if (cmd.mountainSnapshot) {
            for (const { row, col, owner } of cmd.mountainSnapshot) {
                if (Game.mapData.tiles[row][col].terrain === 'mountain') {
                    Game.mapData.tiles[row][col].owner = owner;
                }
            }
        } else {
            Game.updateMountainControl();
        }
        Game.syncUnitTerritories();
        if (cmd.wasInvasion) Game.invaded = false;
        if (cmd.wasAid) Game.aided = false;
        Game.selectedTile = { col: cmd.fromCol, row: cmd.fromRow };
        Game.refreshCurrentPopulation();
    } else if (cmd.type === 'attack') {
        const at = Game.mapData.tiles[cmd.attackerRow][cmd.attackerCol];
        const dt = Game.mapData.tiles[cmd.defenderRow][cmd.defenderCol];
        const aDmg = cmd.attackerDamage || Game.DAMAGE;
        const dDmg = cmd.defenderDamage || Game.DAMAGE;
        if (cmd.attackerDead) {
            at.unit = { owner: at.owner || Game.turnOrder[Game.currentTurnIndex], hp: cmd.attackerOldHP, hasMoved: false, hasAttacked: false };
        } else {
            if (at.unit) {
                at.unit.hp = Math.min(Game.HP_MAX, at.unit.hp + dDmg);
                at.unit.hasAttacked = false;
            }
        }
        if (cmd.defenderDead) {
            dt.unit = { owner: cmd.defenderOwner || null, hp: cmd.defenderOldHP, hasMoved: false, hasAttacked: false };
        } else {
            if (dt.unit) dt.unit.hp = Math.min(Game.HP_MAX, dt.unit.hp + aDmg);
        }
        Game.selectedTile = { col: cmd.attackerCol, row: cmd.attackerRow };
        Game.updateMountainControl();
        Game.refreshCurrentPopulation();
    } else if (cmd.type === 'jointAttack') {
        const tt = Game.mapData.tiles[cmd.targetRow][cmd.targetCol];
        const fDmg = cmd.finalDamage || Game.DAMAGE;
        if (cmd.defenderDead) {
            tt.unit = { owner: cmd.defenderOwner || null, hp: cmd.defenderOldHP, hasMoved: false, hasAttacked: false };
        } else {
            if (tt.unit) tt.unit.hp = Math.min(Game.HP_MAX, tt.unit.hp + fDmg);
        }
        cmd.attackerStates.forEach(s => {
            const un = Game.mapData.tiles[s.row][s.col]?.unit;
            if (un) {
                un.hp = s.hp;
                un.hasAttacked = false;
            }
        });
        const first = cmd.attackerStates[0];
        Game.selectedTile = { col: first.col, row: first.row };
        Game.updateMountainControl();
        Game.refreshCurrentPopulation();
    } else if (cmd.type === 'produce') {
        Game.mapData.tiles[cmd.row][cmd.col].unit = null;
        Game.productionUsed--;
        Game.produced = false;
        Game.refreshCurrentPopulation();
        if (Game.inProductionMode) {
            Game.productionCells = Game.calculateProductionCells(Game.productionTargetCity.row, Game.productionTargetCity.col);
        }
    } else if (cmd.type === 'deleteUnit') {
        Game.mapData.tiles[cmd.row][cmd.col].unit = cmd.unitData;
        Game.refreshCurrentPopulation();
    }

    Game.invalidateStatsCache();
    Game.clearLastCommand();
    Game.extraSelectedUnits = [];
    Game.moveRange = [];
    Game.attackTargets = [];
    Game.selectionStartTime = 0;
    if (Game.animationFrame) { cancelAnimationFrame(Game.animationFrame); Game.animationFrame = null; }
    Game._lastSelectionCacheKey = '';
    Game._cacheValid = false;
    Game.buildOffscreenMap();
    Game.checkFactionElimination();
    Game.drawMap();
    Game.saveGameState();
    Game.updateFloatingButtonsPosition();
};
