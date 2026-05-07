// editor_constants.js
window.Editor = window.Editor || {};

Editor.HP_MAX = 30;
Editor.SAVE_KEY = 'wargame_editor_save';
Editor.AUTOSAVE_KEY = 'wargame_editor_autosave';
Editor.BASE_CELL_SIZE = 48;
Editor.MIN_SCALE = 0.2;
Editor.MAX_SCALE = 4.0;

// 地表颜色表（与 Game.surfaceColors 一致）
Editor.surfaceColors = {
    default: '#3a6b4f',
    ice: '#a8d8ea',
    sand: '#e8d5a3',
    grass: '#7db56a',
    empty: '#ffffff'
};

Editor.DEFAULT_MAP = (() => {
    const w = 30, h = 20;
    const factions = [
        { id: "red", name: "红军", color: "#d94f4f", camp: "联盟" },
        { id: "blue", name: "蓝军", color: "#4f9ad9", camp: "联盟" },
        { id: "gold", name: "黄军", color: "#e5b13b", camp: "帝国" }
    ];
    const tiles = [];
    for (let r = 0; r < h; r++) {
        const row = [];
        for (let c = 0; c < w; c++) {
            const isEdge = (r === 0 || r === h-1 || c === 0 || c === w-1);
            let terrain = isEdge ? 'sea' : 'land';
            // 添加几个山地示例
            if ((r === 2 && c === 5) || (r === 3 && c === 6) || (r === 6 && c === 10) ||
                (r === 7 && c === 9) || (r === 12 && c === 3) || (r === 15 && c === 25)) {
                terrain = 'mountain';
            }
            let owner = null;
            if (terrain === 'land') {
                if (r < 10 && c < 10) owner = 'red';
                else if (r >= 10 && c >= 15) owner = 'blue';
                else if (r >= 5 && r <= 12 && c >= 8 && c <= 18) owner = 'gold';
            }
            const city = ( (r === 5 && c === 5) || (r === 12 && c === 20) || (r === 8 && c === 8) );
            let cityName = '';
            if (r === 5 && c === 5) cityName = '赤壁';
            else if (r === 12 && c === 20) cityName = '许昌';
            else if (r === 8 && c === 8) cityName = '成都';
            row.push({ terrain, owner, city, cityName, unit: null });
        }
        tiles.push(row);
    }
    tiles[5][5].unit = { owner: 'red', hp: Editor.HP_MAX, hasMoved: false, hasAttacked: false };
    tiles[5][6].unit = { owner: 'red', hp: 18, hasMoved: false, hasAttacked: false };
    tiles[12][20].unit = { owner: 'blue', hp: 22, hasMoved: false, hasAttacked: false };
    tiles[8][8].unit = { owner: 'gold', hp: 10, hasMoved: false, hasAttacked: false };
    return { title: '测试地图', width: w, height: h, tiles, factions, surfaceType: 'default', currentTurnFactionId: 'red' };
})();
