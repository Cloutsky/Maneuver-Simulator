// screenshot.js
window.Game = window.Game || {};

Game.exportFullMapScreenshot = function() {
    const map = Game.mapData;
    if (!map) return console.warn('没有地图数据');

    const scale = 2;
    const cell = Game.BASE_CELL_SIZE * scale;
    const w = map.width * cell;
    const h = map.height * cell;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 1. 地形底色
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const tile = map.tiles[r][c];
            if (tile.terrain === 'land' || tile.terrain === 'mountain') {
                const st = Game.mapData.surfaceType || 'default';
                ctx.fillStyle = (Game.surfaceColors && Game.surfaceColors[st]) ? Game.surfaceColors[st] : '#3a6b4f';
            } else {
                ctx.fillStyle = '#2a6090';
            }
            ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }
    // 2. 势力半透明覆盖
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const tile = map.tiles[r][c];
            if (!tile.owner) continue;
            const faction = map.factions.find(f => f.id === tile.owner);
            if (!faction) continue;
            ctx.fillStyle = faction.color + Game.TERRITORY_OPACITY;
            ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }

    // 3. 城市（菱形）
    const citySize = cell / 1.4;
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const tile = map.tiles[r][c];
            if (!tile.city) continue;
            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2;
            let col = '#888';
            if (tile.owner) {
                const f = map.factions.find(f => f.id === tile.owner);
                if (f) col = f.color;
            }
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.rect(-citySize / 2, -citySize / 2, citySize, citySize);
            ctx.fill();
            ctx.restore();
        }
    }

    // 4. 山地三角形
    ctx.fillStyle = '#555';
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const tile = map.tiles[r][c];
            if (tile.terrain !== 'mountain') continue;
            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2;
            const s = cell * 0.35;
            ctx.beginPath();
            ctx.moveTo(x, y - s);
            ctx.lineTo(x + s, y + s);
            ctx.lineTo(x - s, y + s);
            ctx.closePath();
            ctx.fill();
        }
    }

    // 5. 单位（外圈白色，无血量扇形，内圈势力色）
    Game.drawUnits(ctx, {
        cell: cell,
        showUnitHP: false,
        outerColor: '#ffffff',
        visible: { startRow: 0, startCol: 0, endRow: map.height-1, endCol: map.width-1 },
        cur: Game.turnOrder[Game.currentTurnIndex],
        gridVisible: true
    });

    // 6. 城市名称
    Game.drawCityNames(ctx, {
        cell: cell,
        visible: { startRow: 0, startCol: 0, endRow: map.height-1, endCol: map.width-1 },
        force: true
    });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (map.title || '地图').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeTitle}_${timestamp}.png`;

    canvas.toBlob(blob => {
        if (!blob) return console.error('截图生成失败');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        console.log('全地图截图已下载：' + fileName);
    }, 'image/png');
};
