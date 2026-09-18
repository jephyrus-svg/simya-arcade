window.Game = window.Game || {};

(function () {
  const state = Game.Battle.startGame();
  Game.state = state;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function paint() {
    if (state.screen === "battle") {
      const canvas = document.getElementById("map");
      const ctx = canvas.getContext("2d");
      Game.Render.draw(state, canvas, ctx);
    }
    Game.UI.refresh(state);
  }

  function tick() {
    if (state.screen === "battle") {
      const canvas = document.getElementById("map");
      const ctx = canvas.getContext("2d");
      Game.Render.draw(state, canvas, ctx);
      if (Game.UI.els.unitBox) {
        const focus =
          Game.Battle.at(state, state.cursor.x, state.cursor.y) ||
          Game.Battle.unitById(state, state.selectedId);
        Game.UI.els.unitBox.innerHTML = focus
          ? Game.UI.unitCard(state, focus)
          : "<p class='muted'>(빈 칸)</p>";
      }
    }
    requestAnimationFrame(tick);
  }

  function tileFromEvent(ev) {
    const canvas = document.getElementById("map");
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * Game.COLS);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * Game.ROWS);
    if (x < 0 || y < 0 || x >= Game.COLS || y >= Game.ROWS) return null;
    return { x: x, y: y };
  }

  async function maybeEnemy() {
    if (state.screen !== "battle") return;
    if (Game.Battle.checkEnd(state)) {
      paint();
      return;
    }
    if (!Game.Battle.endPlayerPhaseIfDone(state)) return;
    await runEnemy();
  }

  async function runEnemy() {
    if (state.busy) return;
    state.busy = true;
    Game.Battle.startEnemyPhase(state);
    paint();
    await sleep(350);
    const actions = Game.AI.plan(state);
    for (let i = 0; i < actions.length; i++) {
      if (Game.Battle.checkEnd(state)) break;
      const a = actions[i];
      if (a.type === "move") {
        Game.Battle.applyMove(state, a.id, a.x, a.y);
        paint();
        await sleep(260);
      } else if (a.type === "attack") {
        Game.Battle.applyAttack(state, a.id, a.targetId);
        paint();
        await sleep(380);
      } else if (a.type === "wait") {
        Game.Battle.applyWait(state, a.id);
        paint();
        await sleep(80);
      }
    }
    if (!Game.Battle.checkEnd(state)) {
      Game.Battle.startPlayerPhase(state);
    }
    state.busy = false;
    paint();
  }

  function onTile(x, y) {
    if (state.busy || state.phase !== "player" || state.screen !== "battle") return;
    state.cursor = { x: x, y: y };
    const unit = Game.Battle.at(state, x, y);

    if (state.mode === "select" || state.mode === "move") {
      if (state.mode === "move") {
        if (Game.Path.canStop(state.moveTiles, x, y)) {
          Game.Battle.confirmMove(state, x, y);
          paint();
          return;
        }
      }
      if (unit && unit.team === "player" && !unit.acted) {
        Game.Battle.selectUnit(state, unit);
        paint();
        return;
      }
      if (state.mode === "move") Game.Battle.cancel(state);
      paint();
      return;
    }

    if (state.mode === "attack") {
      if (unit && unit.team === "enemy") {
        const me = Game.Battle.unitById(state, state.selectedId);
        const ok = Game.Path.attackTargets(state, me, me).some(function (t) {
          return t.id === unit.id;
        });
        if (ok) {
          Game.Battle.applyAttack(state, me.id, unit.id);
          paint();
          maybeEnemy();
          return;
        }
      }
      return;
    }

    if (state.mode === "heal") {
      if (unit && unit.team === "player") {
        const me = Game.Battle.unitById(state, state.selectedId);
        const ok = Game.Path.healTargets(state, me, me).some(function (t) {
          return t.id === unit.id;
        });
        if (ok) {
          Game.Battle.applyHeal(state, me.id, unit.id);
          paint();
          maybeEnemy();
        }
      }
    }
  }

  function onCommand(act) {
    const me = Game.Battle.unitById(state, state.selectedId);
    if (!me) return;
    if (act === "attack") state.mode = "attack";
    else if (act === "heal") state.mode = "heal";
    else if (act === "wait") {
      Game.Battle.applyWait(state, me.id);
      paint();
      maybeEnemy();
      return;
    } else if (act === "cancel") Game.Battle.cancel(state);
    paint();
  }

  function start() {
    Game.Battle.loadStage(state, 0);
    paint();
  }

  function bind() {
    Game.UI.bind();
    Game.loadSprites();

    document.getElementById("btn-start").addEventListener("click", start);

    document.getElementById("map").addEventListener("mousemove", function (ev) {
      const t = tileFromEvent(ev);
      if (!t || state.screen !== "battle") return;
      state.hover = t;
      if (state.mode === "select" || state.mode === "move" || state.mode === "attack" || state.mode === "heal") {
        state.cursor = t;
      }
    });
    document.getElementById("map").addEventListener("click", function (ev) {
      const t = tileFromEvent(ev);
      if (!t) return;
      onTile(t.x, t.y);
    });

    document.getElementById("cmd").addEventListener("click", function (ev) {
      const btn = ev.target.closest("button");
      if (!btn) return;
      onCommand(btn.getAttribute("data-act"));
    });

    document.getElementById("btn-end-phase").addEventListener("click", function () {
      if (state.busy || state.phase !== "player" || state.screen !== "battle") return;
      Game.Battle.forceEndPlayer(state);
      paint();
      maybeEnemy();
    });

    document.getElementById("modal").addEventListener("click", function (ev) {
      const id = ev.target.id;
      if (id === "retry") {
        state.result = null;
        Game.Battle.retryStage(state);
        paint();
      }
      if (id === "to-title") {
        const fresh = Game.Battle.startGame();
        Object.keys(fresh).forEach(function (k) {
          state[k] = fresh[k];
        });
        paint();
      }
      if (id === "to-alloc") {
        state.result = null;
        Game.Battle.beginAlloc(state);
        paint();
      }
    });

    document.getElementById("alloc-grid").addEventListener("click", function (ev) {
      const card = ev.target.closest(".alloc-card");
      if (card) {
        state.allocTarget = card.getAttribute("data-id");
        paint();
      }
    });
    document.getElementById("alloc-stats").addEventListener("click", function (ev) {
      const btn = ev.target.closest("button[data-stat]");
      if (!btn || state.allocPoints <= 0) return;
      Game.Battle.applyAlloc(state, state.allocTarget, btn.getAttribute("data-stat"));
      paint();
    });
    document.getElementById("alloc-go").addEventListener("click", function () {
      if (state.allocPoints !== 0) return;
      Game.Battle.nextStageOrEnding(state);
      paint();
    });

    document.getElementById("btn-again").addEventListener("click", function () {
      const fresh = Game.Battle.startGame();
      Object.keys(fresh).forEach(function (k) {
        state[k] = fresh[k];
      });
      Game.Battle.loadStage(state, 0);
      paint();
    });

    window.addEventListener("keydown", function (ev) {
      if (state.screen !== "battle" || state.busy) {
        if (ev.key === "Enter" && state.screen === "title") start();
        return;
      }
      const c = state.cursor;
      if (ev.key === "ArrowUp") state.cursor = { x: c.x, y: Math.max(0, c.y - 1) };
      else if (ev.key === "ArrowDown") state.cursor = { x: c.x, y: Math.min(Game.ROWS - 1, c.y + 1) };
      else if (ev.key === "ArrowLeft") state.cursor = { x: Math.max(0, c.x - 1), y: c.y };
      else if (ev.key === "ArrowRight") state.cursor = { x: Math.min(Game.COLS - 1, c.x + 1), y: c.y };
      else if (ev.key === "Enter") onTile(state.cursor.x, state.cursor.y);
      else if (ev.key === "Escape") {
        Game.Battle.cancel(state);
      } else if (ev.key === " " || ev.key === "w" || ev.key === "W") {
        if (state.mode === "command") onCommand("wait");
      } else return;
      ev.preventDefault();
      paint();
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    bind();
    tick();
  });
})();
