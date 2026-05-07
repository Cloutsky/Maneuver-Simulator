// viewport.js
window.Game = window.Game || {};

Game.screenToWorld = function(sx, sy) {
    return { x: (sx - Game.view.offsetX) / Game.view.scale, y: (sy - Game.view.offsetY) / Game.view.scale };
};

Game.worldToScreen = function(wx, wy) {
    return { x: wx * Game.view.scale + Game.view.offsetX, y: wy * Game.view.scale + Game.view.offsetY };
};

Game.getFitScale = function() {
    if (!Game.canvas || !Game.canvas.width) return 1.0;
    return Math.min(Game.canvas.width / Game.WORLD_WIDTH, Game.canvas.height / Game.WORLD_HEIGHT);
};

Game.clampOffset = function() {
    const sw = Game.WORLD_WIDTH * Game.view.scale;
    const sh = Game.WORLD_HEIGHT * Game.view.scale;

    if (sw <= Game.canvas.width) {
        Game.view.offsetX = (Game.canvas.width - sw) / 2;
    } else {
        Game.view.offsetX = Math.min(0, Math.max(Game.canvas.width - sw, Game.view.offsetX));
    }
    if (sh <= Game.canvas.height) {
        Game.view.offsetY = (Game.canvas.height - sh) / 2;
    } else {
        Game.view.offsetY = Math.min(0, Math.max(Game.canvas.height - sh, Game.view.offsetY));
    }
};

Game.resetViewToCenter = function() {
    const fit = Game.getFitScale();
    Game.view.scale = Math.min(Game.MAX_SCALE, fit);
    Game.view.offsetX = (Game.canvas.width - Game.WORLD_WIDTH * Game.view.scale) / 2;
    Game.view.offsetY = (Game.canvas.height - Game.WORLD_HEIGHT * Game.view.scale) / 2;
    Game.clampOffset();
    Game.drawMap();
};

Game.zoomAtScreenPoint = function(delta, sx, sy) {
    const old = Game.view.scale;
    let ns = old * delta;
    ns = Math.min(Game.MAX_SCALE, Math.max(Game.getFitScale(), ns));
    if (ns === old) return;
    const wp = Game.screenToWorld(sx, sy);
    Game.view.scale = ns;
    Game.view.offsetX = sx - wp.x * Game.view.scale;
    Game.view.offsetY = sy - wp.y * Game.view.scale;
    Game.clampOffset();
    Game.clearSelectionIfGridHidden();
    Game.drawMap();
};

Game.isGridVisible = function() {
    return Game.view.scale >= Game.getDetailVisibleScale();
};