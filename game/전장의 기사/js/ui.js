window.Game = window.Game || {};

Game.UI = {
  els: {},

  lastResult: null,

  bind: function () {
    const $ = function (id) {
      return document.getElementById(id);
    };
    this.els = {
      title: $("screen-title"),
      battle: $("screen-battle"),
      alloc: $("screen-alloc"),
      ending: $("screen-ending"),
      modal: $("modal"),
      banner: $("stage-banner"),
      cmd: $("cmd"),
      panel: $("panel"),
      log: $("log"),
      unitBox: $("unit-box"),
      meta: $("meta"),
      allocGrid: $("alloc-grid"),
      allocHint: $("alloc-hint"),
      allocGo: $("alloc-go"),
    };
  },

  show: function (name) {
    ["title", "battle", "alloc", "ending"].forEach(function (k) {
      Game.UI.els[k].classList.toggle("hidden", k !== name);
    });
  },

  refresh: function (state) {
    this.show(state.screen);
    if (state.screen === "battle") this.battle(state);
    if (state.screen === "alloc") this.alloc(state);
    if (state.result !== this.lastResult) {
      this.lastResult = state.result;
      if (state.result === "defeat") this.defeat();
      else if (state.result === "victory" && state.screen === "battle") this.victory(state);
      else this.els.modal.classList.add("hidden");
    }
  },

  battle: function (state) {
    const stage = Game.STAGES[state.stageIndex];
    this.els.banner.textContent = stage.title + "  ·  턴 " + state.turn;
    this.els.meta.textContent =
      (state.phase === "player" ? "아군 페이즈" : "적 페이즈") +
      "  ·  남은 아군 " +
      Game.Battle.living(state, "player").length +
      "  ·  적 " +
      Game.Battle.living(state, "enemy").length;

    const focus = Game.Battle.at(state, state.cursor.x, state.cursor.y) || Game.Battle.unitById(state, state.selectedId);
    this.els.unitBox.innerHTML = focus ? this.unitCard(state, focus) : "<p class='muted'>(빈 칸)</p>";
    this.els.log.innerHTML = state.log
      .map(function (line) {
        return "<div>" + Game.UI.escape(line) + "</div>";
      })
      .join("");

    this.commandMenu(state);
  },

  unitCard: function (state, u) {
    const t = Game.Path.terrain(state.map, u.x, u.y);
    const dmgHint =
      state.mode === "attack" && state.selectedId && u.team === "enemy"
        ? "<div class='hint'>예상 데미지 " +
          Game.Battle.damage(state, Game.Battle.unitById(state, state.selectedId), u) +
          "</div>"
        : "";
    return (
      "<div class='card-head'>" +
      "<strong>" +
      this.escape(u.name) +
      "</strong> <span class='job'>" +
      this.escape(u.jobName) +
      "</span></div>" +
      "<div class='hpbar'><span style='width:" +
      (100 * u.hp) / u.maxHp +
      "%'></span></div>" +
      "<div class='statrow'>HP " +
      u.hp +
      "/" +
      u.maxHp +
      (u.team === "player" ? "  ·  Lv " + u.level + "  EXP " + u.exp : "") +
      "</div>" +
      "<div class='statgrid'>" +
      "<span>힘 " +
      u.atk +
      "</span><span>방어 " +
      u.def +
      "</span><span>마법 " +
      u.mag +
      "</span><span>마방 " +
      u.res +
      "</span>" +
      "<span>이동 " +
      u.mov +
      "</span><span>사거리 " +
      u.rng +
      (u.healRng ? " / 치료 " + u.healRng : "") +
      "</span></div>" +
      "<div class='muted'>" +
      (t ? t.name : "") +
      (u.fly ? "  ·  비행" : "") +
      (u.cavalry ? "  ·  기병" : "") +
      (u.magic ? "  ·  마법" : "") +
      (u.vsFlyer ? "  ·  대공" : "") +
      (u.vsCavalry ? "  ·  대기병" : "") +
      (u.acted ? "  ·  행동 마침" : "") +
      "</div>" +
      dmgHint
    );
  },

  cmdSig: "",

  commandMenu: function (state) {
    const cmd = this.els.cmd;
    const unit = Game.Battle.unitById(state, state.selectedId);
    if (state.screen !== "battle" || state.mode !== "command" || !unit) {
      cmd.classList.add("hidden");
      cmd.innerHTML = "";
      this.cmdSig = "";
      return;
    }
    const canvas = document.getElementById("map");
    const T = Game.TILE;
    cmd.style.left = Math.min(canvas.clientWidth - 120, unit.x * T + T) + "px";
    cmd.style.top = Math.max(8, unit.y * T - 8) + "px";
    const atk = Game.Path.attackTargets(state, unit, unit);
    const heal = Game.Path.healTargets(state, unit, unit);
    const sig = unit.id + "|" + atk.length + "|" + heal.length + "|" + unit.x + "," + unit.y;
    if (sig === this.cmdSig) {
      cmd.classList.remove("hidden");
      return;
    }
    this.cmdSig = sig;
    let html = "";
    if (atk.length) html += "<button data-act='attack'>공격</button>";
    if (heal.length) html += "<button data-act='heal'>치료</button>";
    html += "<button data-act='wait'>대기</button>";
    html += "<button data-act='cancel' class='ghost'>취소</button>";
    cmd.innerHTML = html;
    cmd.classList.remove("hidden");
  },

  alloc: function (state) {
    this.els.allocHint.textContent = "남은 포인트 " + state.allocPoints;
    this.els.allocGo.disabled = state.allocPoints !== 0;
    this.els.allocGo.textContent =
      state.stageIndex >= Game.STAGES.length - 1 ? "엔딩" : "다음 스테이지";
    this.els.allocGrid.innerHTML = state.party
      .map(function (p) {
        const on = state.allocTarget === p.id ? " on" : "";
        return (
          "<button class='alloc-card" +
          on +
          "' data-id='" +
          p.id +
          "'>" +
          "<div class='name'>" +
          Game.UI.escape(p.name) +
          " <small>" +
          Game.UI.escape(p.jobName) +
          "</small></div>" +
          "<div>Lv " +
          p.level +
          "  HP " +
          p.maxHp +
          "</div>" +
          "<div>힘 " +
          p.atk +
          "  방어 " +
          p.def +
          "  마법 " +
          p.mag +
          "</div></button>"
        );
      })
      .join("");
  },

  victory: function (state) {
    const last = state.stageIndex >= Game.STAGES.length - 1;
    this.els.modal.innerHTML =
      "<div class='dialog'>" +
      "<h2>스테이지 클리어</h2>" +
      "<p>스탯 포인트 3개를 나눠 찍습니다.</p>" +
      "<button id='to-alloc'>" +
      (last ? "마지막 강화" : "강화하기") +
      "</button></div>";
    this.els.modal.classList.remove("hidden");
  },

  defeat: function () {
    this.els.modal.innerHTML =
      "<div class='dialog'>" +
      "<h2>전멸했다</h2>" +
      "<p>이번 스테이지 시작 능력치로 다시 싸울 수 있다.</p>" +
      "<button id='retry'>재도전</button>" +
      "<button id='to-title' class='ghost'>타이틀</button></div>";
    this.els.modal.classList.remove("hidden");
  },

  escape: function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  },
};
