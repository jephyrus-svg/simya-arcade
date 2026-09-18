window.Game = window.Game || {};

Game.Path = {
  key: function (x, y) {
    return x + "," + y;
  },

  manhattan: function (a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  },

  inBounds: function (map, x, y) {
    return x >= 0 && y >= 0 && x < map.cols && y < map.rows;
  },

  terrain: function (map, x, y) {
    if (!this.inBounds(map, x, y)) return null;
    return Game.TERRAIN[map.tiles[y][x]] || null;
  },

  stepCost: function (map, x, y, unit) {
    const t = this.terrain(map, x, y);
    if (!t) return Infinity;
    if (t.wall) return Infinity;
    if (unit.fly) return 1;
    if (t.flyOnly) return Infinity;
    if (t.cavalryBlock && unit.cavalry) return Infinity;
    if (unit.cavalry && map.tiles[y][x] === "F") return 4;
    return t.cost;
  },

  occupiers: function (units) {
    const stop = {};
    const enemy = {};
    units.forEach(function (u) {
      if (u.hp <= 0) return;
      const k = u.x + "," + u.y;
      stop[k] = u;
      if (u.team === "enemy") enemy[k] = u;
    });
    return { stop: stop, enemy: enemy };
  },

  moveRange: function (state, unit) {
    const map = state.map;
    const stop = {};
    const blocked = {};
    state.units.forEach(function (u) {
      if (u.hp <= 0 || u.id === unit.id) return;
      const k = u.x + "," + u.y;
      stop[k] = u;
      if (u.team !== unit.team) blocked[k] = u;
    });

    const best = {};
    const origin = this.key(unit.x, unit.y);
    best[origin] = 0;
    const q = [{ x: unit.x, y: unit.y, c: 0 }];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    while (q.length) {
      q.sort(function (a, b) {
        return a.c - b.c;
      });
      const cur = q.shift();
      const ck = this.key(cur.x, cur.y);
      if (cur.c !== best[ck]) continue;
      for (let i = 0; i < dirs.length; i++) {
        const nx = cur.x + dirs[i][0];
        const ny = cur.y + dirs[i][1];
        const nk = this.key(nx, ny);
        if (blocked[nk]) continue;
        const step = this.stepCost(map, nx, ny, unit);
        if (!isFinite(step)) continue;
        const nc = cur.c + step;
        if (nc > unit.mov) continue;
        if (best[nk] !== undefined && best[nk] <= nc) continue;
        best[nk] = nc;
        q.push({ x: nx, y: ny, c: nc });
      }
    }

    const tiles = [];
    Object.keys(best).forEach(function (k) {
      if (stop[k]) return;
      const parts = k.split(",");
      tiles.push({ x: +parts[0], y: +parts[1], c: best[k] });
    });
    return tiles;
  },

  canStop: function (tiles, x, y) {
    return tiles.some(function (t) {
      return t.x === x && t.y === y;
    });
  },

  inAttackRange: function (unit, from, to) {
    const d = this.manhattan(from, to);
    const minR = unit.minRng || 1;
    return d >= minR && d <= unit.rng;
  },

  attackTargets: function (state, unit, from) {
    return state.units.filter(function (u) {
      if (u.hp <= 0 || u.team === unit.team) return false;
      return Game.Path.inAttackRange(unit, from, u);
    });
  },

  threatenFromMoves: function (state, unit, moveTiles) {
    const seen = {};
    const tiles = [];
    moveTiles.forEach(function (m) {
      state.units.forEach(function (u) {
        if (u.hp <= 0 || u.team === unit.team) return;
        if (!Game.Path.inAttackRange(unit, m, u)) return;
        const k = u.x + "," + u.y;
        if (seen[k]) return;
        seen[k] = true;
        tiles.push({ x: u.x, y: u.y, target: u });
      });
    });
    return tiles;
  },

  healTargets: function (state, unit, from) {
    if (!unit.healRng) return [];
    return state.units.filter(function (u) {
      if (u.hp <= 0 || u.team !== unit.team) return false;
      if (u.hp >= u.maxHp) return false;
      return Game.Path.manhattan(from, u) <= unit.healRng;
    });
  },
};
