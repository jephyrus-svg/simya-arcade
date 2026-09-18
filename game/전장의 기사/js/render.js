window.Game = window.Game || {};

Game.Sprites = {};
Game.TIME = 0;

Game.loadSprites = function () {
  const names = [
    "warrior",
    "knight",
    "dragon",
    "mage",
    "healer",
    "slime",
    "goblin",
    "wolf",
    "spear",
    "archer",
    "boss",
  ];
  names.forEach(function (name) {
    const img = new Image();
    img.src = "assets/sprites/" + name + ".png?v=2";
    Game.Sprites[name] = img;
  });
};

Game.Render = {
  draw: function (state, canvas, ctx) {
    const T = Game.TILE;
    canvas.width = Game.COLS * T;
    canvas.height = Game.ROWS * T;
    ctx.imageSmoothingEnabled = false;
    Game.TIME += 1;

    this.drawTiles(state, ctx, T);
    this.drawOverlays(state, ctx, T);
    this.drawUnits(state, ctx, T);
    this.drawCursor(state, ctx, T);
    this.drawPopups(state, ctx, T);
    this.drawPhaseBanner(state, ctx, canvas);
  },

  hash: function (x, y) {
    return ((x * 73 + y * 149) >>> 0) % 6;
  },

  drawTiles: function (state, ctx, T) {
    const map = state.map;
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const ch = map.tiles[y][x];
        const t = Game.TERRAIN[ch];
        const px = x * T;
        const py = y * T;
        const alt = this.hash(x, y) > 2;
        ctx.fillStyle = alt ? t.fill2 : t.fill;
        ctx.fillRect(px, py, T, T);

        if (ch === "." || ch === "F") {
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px + 4 + (this.hash(x, y) % 8), py + 6, 3, 3);
          ctx.fillRect(px + 20, py + 28, 2, 2);
        }
        if (ch === "W") {
          ctx.fillStyle = "rgba(180,220,255,0.18)";
          const wiggle = Math.sin((Game.TIME + x * 8 + y * 5) / 18) * 3;
          ctx.fillRect(px + 8, py + 20 + wiggle, T - 16, 3);
        }
        if (ch === "F") {
          this.drawTree(ctx, px, py, T);
        }
        if (ch === "M") {
          ctx.fillStyle = "#c4b8a4";
          ctx.beginPath();
          ctx.moveTo(px + T / 2, py + 8);
          ctx.lineTo(px + T - 8, py + T - 10);
          ctx.lineTo(px + 8, py + T - 10);
          ctx.fill();
        }
        if (ch === "H") {
          ctx.strokeStyle = "#f0d48a";
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 8, py + 8, T - 16, T - 16);
        }
        if (ch === "=") {
          ctx.fillStyle = "#6a4e32";
          ctx.fillRect(px, py + 10, T, 3);
          ctx.fillRect(px, py + T - 13, T, 3);
        }
        if (ch === "#") {
          ctx.fillStyle = "#15121c";
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = "#3a3448";
          ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        }

        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      }
    }
  },

  drawTree: function (ctx, px, py, T) {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(px + T / 2 - 3, py + T - 16, 6, 12);
    ctx.fillStyle = "#1f5a28";
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2 - 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f7a38";
    ctx.beginPath();
    ctx.arc(px + T / 2 - 4, py + T / 2 - 6, 8, 0, Math.PI * 2);
    ctx.fill();
  },

  tileSet: function (tiles) {
    const s = {};
    tiles.forEach(function (t) {
      s[t.x + "," + t.y] = t;
    });
    return s;
  },

  drawOverlays: function (state, ctx, T) {
    const unit = Game.Battle.unitById(state, state.selectedId);
    if (!unit) return;

    if (state.mode === "move") {
      state.moveTiles.forEach(function (t) {
        ctx.fillStyle = "rgba(70,130,255,0.38)";
        ctx.fillRect(t.x * T, t.y * T, T, T);
        ctx.strokeStyle = "rgba(160,200,255,0.8)";
        ctx.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
      });
      Game.Path.threatenFromMoves(state, unit, state.moveTiles).forEach(function (t) {
        ctx.fillStyle = "rgba(220,50,50,0.32)";
        ctx.fillRect(t.x * T, t.y * T, T, T);
        ctx.strokeStyle = "rgba(255,160,160,0.85)";
        ctx.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
      });
    }

    const from = state.mode === "move" ? state.cursor : unit;
    if (state.mode === "attack" || state.mode === "command") {
      Game.Path.attackTargets(state, unit, unit).forEach(function (t) {
        if (state.mode === "command") return;
        ctx.fillStyle = "rgba(220,50,50,0.42)";
        ctx.fillRect(t.x * T, t.y * T, T, T);
        ctx.strokeStyle = "rgba(255,160,160,0.9)";
        ctx.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
      });
    }
    if (state.mode === "attack") {
      Game.Path.attackTargets(state, unit, unit).forEach(function (t) {
        ctx.fillStyle = "rgba(220,50,50,0.42)";
        ctx.fillRect(t.x * T, t.y * T, T, T);
      });
    }
    if (state.mode === "heal") {
      Game.Path.healTargets(state, unit, unit).forEach(function (t) {
        ctx.fillStyle = "rgba(50,200,110,0.42)";
        ctx.fillRect(t.x * T, t.y * T, T, T);
        ctx.strokeStyle = "rgba(160,255,190,0.9)";
        ctx.strokeRect(t.x * T + 1, t.y * T + 1, T - 2, T - 2);
      });
    }

    // keep from referenced for linters
    void from;
  },

  drawUnits: function (state, ctx, T) {
    const list = state.units.filter(function (u) {
      return u.hp > 0;
    });
    list.sort(function (a, b) {
      return a.y - b.y || (a.fly === b.fly ? a.x - b.x : a.fly ? 1 : -1);
    });
    const self = this;
    list.forEach(function (u) {
      const px = u.x * T;
      const py = u.y * T;
      const fly = !!u.fly;
      const bob = u.acted ? 0 : Math.sin(Game.TIME / (fly ? 9 : 12) + u.x) * (fly ? 3.5 : 1.5);
      const lift = fly ? 16 : 0;
      const img = Game.Sprites[u.sprite];
      const size = fly ? T + 8 : u.cavalry ? T + 2 : T - 4;
      if (fly) {
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(px + T / 2, py + T - 7, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, px + (T - size) / 2, py + 1 + bob - 8 - lift, size, size);
      } else {
        self.fallback(ctx, u, px, py + bob - lift, T);
      }
      if (u.acted) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(px, py, T, T);
      }
      const team = u.team === "player" ? "#4aa3ff" : "#e25b5b";
      ctx.fillStyle = team;
      ctx.fillRect(px + 6, py + T - 7, T - 12, 4);
      const ratio = u.hp / u.maxHp;
      ctx.fillStyle = ratio > 0.4 ? "#4cdb7a" : "#e6c14a";
      if (ratio < 0.25) ctx.fillStyle = "#e85d5d";
      ctx.fillRect(px + 6, py + T - 7, (T - 12) * ratio, 4);
    });
  },

  fallback: function (ctx, u, px, py, T) {
    ctx.fillStyle = u.team === "player" ? "#d7c07a" : "#c45c5c";
    ctx.fillRect(px + 10, py + 14, T - 20, T - 24);
    ctx.beginPath();
    ctx.fillStyle = "#f3d7b0";
    ctx.arc(px + T / 2, py + 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1423";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(u.name[0], px + T / 2, py + T / 2 + 4);
  },

  drawCursor: function (state, ctx, T) {
    const x = state.cursor.x * T;
    const y = state.cursor.y * T;
    const pulse = 1 + Math.sin(Game.TIME / 8) * 0.5;
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = 2 + pulse;
    ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
  },

  drawPopups: function (state, ctx, T) {
    ctx.font = "bold 14px 'Galmuri11', sans-serif";
    ctx.textAlign = "center";
    state.popups.forEach(function (p) {
      const a = 1 - p.life / 48;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x * T + T / 2, p.y * T + 12 - p.life * 0.6);
      ctx.globalAlpha = 1;
    });
    state.popups = state.popups.filter(function (p) {
      p.life += 1;
      return p.life < 48;
    });
  },

  drawPhaseBanner: function (state, ctx, canvas) {
    if (state.phase !== "enemy" && !state.busy) return;
    if (state.phase !== "enemy") return;
    ctx.fillStyle = "rgba(80,20,20,0.55)";
    ctx.fillRect(0, canvas.height / 2 - 22, canvas.width, 44);
    ctx.fillStyle = "#ffd0d0";
    ctx.font = "bold 18px 'Galmuri11', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("적 페이즈", canvas.width / 2, canvas.height / 2 + 6);
  },
};
