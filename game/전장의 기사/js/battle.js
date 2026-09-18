window.Game = window.Game || {};

Game.Battle = {
  newParty: function () {
    return Game.PARTY_TEMPLATES.map(Game.makeHero);
  },

  startGame: function () {
    return {
      screen: "title",
      stageIndex: 0,
      party: this.newParty(),
      snapshot: null,
      map: null,
      units: [],
      phase: "player",
      mode: "select",
      selectedId: null,
      origin: null,
      moveTiles: [],
      cursor: { x: 0, y: 0 },
      hover: { x: 0, y: 0 },
      log: [],
      popups: [],
      busy: false,
      allocPoints: 0,
      allocTarget: null,
      result: null,
      turn: 1,
    };
  },

  loadStage: function (state, index) {
    const stage = Game.STAGES[index];
    state.stageIndex = index;
    state.map = stage.map;
    state.phase = "player";
    state.mode = "select";
    state.selectedId = null;
    state.origin = null;
    state.moveTiles = [];
    state.busy = false;
    state.result = null;
    state.turn = 1;
    state.popups = [];
    state.log = [stage.title];
    this.log(state, stage.blurb);

    state.party.forEach(function (p) {
      p.hp = p.maxHp;
      p.acted = false;
      p.alive = true;
    });
    state.snapshot = Game.cloneParty(state.party);

    const units = [];
    stage.allySpawns.forEach(function (xy, i) {
      const hero = state.party[i];
      hero.x = xy[0];
      hero.y = xy[1];
      hero.acted = false;
      units.push(hero);
    });
    stage.enemies.forEach(function (e, i) {
      units.push(Game.makeEnemy(e.kind, e.x, e.y, i, index));
    });
    state.units = units;
    state.cursor = { x: units[0].x, y: units[0].y };
    state.screen = "battle";
  },

  retryStage: function (state) {
    state.party = Game.cloneParty(state.snapshot);
    this.loadStage(state, state.stageIndex);
  },

  unitById: function (state, id) {
    for (let i = 0; i < state.units.length; i++) {
      if (state.units[i].id === id) return state.units[i];
    }
    return null;
  },

  at: function (state, x, y) {
    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (u.hp > 0 && u.x === x && u.y === y) return u;
    }
    return null;
  },

  log: function (state, msg) {
    state.log.push(msg);
    if (state.log.length > 8) state.log.shift();
  },

  popup: function (state, x, y, text, color) {
    state.popups.push({ x: x, y: y, text: text, color: color || "#fff", life: 0 });
  },

  damage: function (state, attacker, defender) {
    const t = Game.Path.terrain(state.map, defender.x, defender.y);
    const bonus = t && !attacker.magic ? t.def : 0;
    let raw;
    if (attacker.magic) {
      raw = Math.max(1, attacker.mag - defender.res);
    } else {
      raw = Math.max(1, attacker.atk - (defender.def + bonus));
    }
    if (attacker.vsFlyer && defender.fly) raw = Math.max(1, Math.floor(raw * 1.5));
    if (attacker.vsCavalry && defender.cavalry) raw = Math.max(1, Math.floor(raw * 1.5));
    return raw;
  },

  healAmount: function (healer) {
    return 8 + healer.mag;
  },

  restAmount: function (state, unit) {
    const t = Game.Path.terrain(state.map, unit.x, unit.y);
    const ratio = t ? t.rest : 0.1;
    return Math.max(1, Math.floor(unit.maxHp * ratio));
  },

  gainExp: function (state, unit, amount) {
    if (unit.team !== "player") return;
    unit.exp += amount;
    while (unit.exp >= Game.EXP_MAX && unit.level < Game.LEVEL_CAP) {
      unit.exp -= Game.EXP_MAX;
      unit.level += 1;
      unit.maxHp += 3;
      unit.hp += 3;
      const job = Game.JOBS[unit.job];
      if (job.primary === "mag") unit.mag += 1;
      else unit.atk += 1;
      if (unit.level % 2 === 0) unit.def += 1;
      this.log(state, unit.name + " 레벨 " + unit.level + "!");
      this.popup(state, unit.x, unit.y, "Lv" + unit.level, "#ffe27a");
    }
  },

  applyAttack: function (state, attackerId, targetId) {
    const attacker = this.unitById(state, attackerId);
    const target = this.unitById(state, targetId);
    if (!attacker || !target || attacker.hp <= 0 || target.hp <= 0) return;
    const dmg = this.damage(state, attacker, target);
    target.hp = Math.max(0, target.hp - dmg);
    this.popup(state, target.x, target.y, "-" + dmg, "#ff6b6b");
    this.log(state, attacker.name + "의 공격! " + target.name + "에게 " + dmg + " 데미지");
    if (target.hp <= 0) {
      target.hp = 0;
      this.log(state, target.name + "을(를) 쓰러뜨렸다.");
      this.popup(state, target.x, target.y, "쓰러짐", "#ffd56a");
      const bounty = target.bounty || 40;
      this.gainExp(state, attacker, bounty);
    } else {
      this.gainExp(state, attacker, 12);
      if (Game.Path.inAttackRange(target, target, attacker)) {
        const cdmg = this.damage(state, target, attacker);
        attacker.hp = Math.max(0, attacker.hp - cdmg);
        this.popup(state, attacker.x, attacker.y, "-" + cdmg, "#ffb347");
        this.log(state, target.name + "의 반격! " + cdmg + " 데미지");
        if (attacker.hp <= 0) {
          this.log(state, attacker.name + "이(가) 쓰러졌다.");
          if (target.team === "player") this.gainExp(state, target, attacker.bounty || 40);
        }
      }
    }
    attacker.acted = true;
    this.clearSelect(state);
  },

  applyHeal: function (state, healerId, targetId) {
    const healer = this.unitById(state, healerId);
    const target = this.unitById(state, targetId);
    if (!healer || !target || healer.hp <= 0 || target.hp <= 0) return;
    const amt = this.healAmount(healer);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amt);
    const got = target.hp - before;
    this.popup(state, target.x, target.y, "+" + got, "#6bff9a");
    this.log(state, healer.name + "의 치료! " + target.name + " HP +" + got);
    this.gainExp(state, healer, 10);
    healer.acted = true;
    this.clearSelect(state);
  },

  applyWait: function (state, unitId) {
    const unit = this.unitById(state, unitId);
    if (!unit || unit.hp <= 0) return;
    const t = Game.Path.terrain(state.map, unit.x, unit.y);
    const ratio = t ? t.rest : 0;
    if (ratio > 0 && unit.hp < unit.maxHp) {
      const amt = Math.max(1, Math.floor(unit.maxHp * ratio));
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + amt);
      const got = unit.hp - before;
      if (got > 0) {
        this.popup(state, unit.x, unit.y, "+" + got, "#9ad0ff");
        this.log(state, unit.name + "은(는) " + t.name + "에서 회복. HP +" + got);
      } else {
        this.log(state, unit.name + "은(는) 대기했다.");
      }
    } else {
      this.log(state, unit.name + "은(는) 대기했다.");
    }
    unit.acted = true;
    this.clearSelect(state);
  },

  applyMove: function (state, unitId, x, y) {
    const unit = this.unitById(state, unitId);
    if (!unit) return;
    unit.x = x;
    unit.y = y;
  },

  selectUnit: function (state, unit) {
    if (state.busy || state.phase !== "player") return;
    if (!unit || unit.team !== "player" || unit.hp <= 0 || unit.acted) return;
    state.selectedId = unit.id;
    state.origin = { x: unit.x, y: unit.y };
    state.moveTiles = Game.Path.moveRange(state, unit);
    state.mode = "move";
    state.cursor = { x: unit.x, y: unit.y };
  },

  confirmMove: function (state, x, y) {
    const unit = this.unitById(state, state.selectedId);
    if (!unit || state.mode !== "move") return;
    if (!Game.Path.canStop(state.moveTiles, x, y)) return;
    this.applyMove(state, unit.id, x, y);
    state.mode = "command";
    state.cursor = { x: x, y: y };
  },

  cancel: function (state) {
    if (state.busy) return;
    const unit = this.unitById(state, state.selectedId);
    if (!unit) {
      state.mode = "select";
      return;
    }
    if (state.mode === "attack" || state.mode === "heal") {
      state.mode = "command";
      return;
    }
    if (state.mode === "command" || state.mode === "move") {
      if (state.origin) {
        unit.x = state.origin.x;
        unit.y = state.origin.y;
      }
      this.clearSelect(state);
    }
  },

  clearSelect: function (state) {
    state.selectedId = null;
    state.origin = null;
    state.moveTiles = [];
    state.mode = "select";
  },

  playerLeft: function (state) {
    return state.units.filter(function (u) {
      return u.team === "player" && u.hp > 0 && !u.acted;
    });
  },

  living: function (state, team) {
    return state.units.filter(function (u) {
      return u.team === team && u.hp > 0;
    });
  },

  checkEnd: function (state) {
    if (this.living(state, "player").length === 0) {
      state.result = "defeat";
      return "defeat";
    }
    if (this.living(state, "enemy").length === 0) {
      state.result = "victory";
      this.syncParty(state);
      return "victory";
    }
    return null;
  },

  syncParty: function (state) {
    // party objects are the same references as player units
    state.party.forEach(function (p) {
      p.acted = false;
    });
  },

  endPlayerPhaseIfDone: function (state) {
    if (this.playerLeft(state).length === 0) return true;
    return false;
  },

  startPlayerPhase: function (state) {
    state.phase = "player";
    state.turn += 1;
    state.units.forEach(function (u) {
      if (u.hp > 0) u.acted = false;
    });
    this.clearSelect(state);
    this.log(state, "아군 페이즈");
  },

  startEnemyPhase: function (state) {
    state.phase = "enemy";
    this.clearSelect(state);
    this.log(state, "적 페이즈");
  },

  forceEndPlayer: function (state) {
    this.playerLeft(state).forEach(function (u) {
      Game.Battle.applyWait(state, u.id);
    });
  },

  applyAlloc: function (state, unitId, stat) {
    if (state.allocPoints <= 0) return;
    const unit = state.party.find(function (p) {
      return p.id === unitId;
    });
    if (!unit) return;
    if (stat === "atk") unit.atk += 1;
    else if (stat === "def") unit.def += 1;
    else if (stat === "mag") unit.mag += 1;
    else if (stat === "hp") {
      unit.maxHp += 4;
      unit.hp = unit.maxHp;
    } else return;
    state.allocPoints -= 1;
  },

  beginAlloc: function (state) {
    state.allocPoints = Game.ALLOC_POINTS;
    state.allocTarget = state.party[0].id;
    state.screen = "alloc";
  },

  nextStageOrEnding: function (state) {
    if (state.stageIndex >= Game.STAGES.length - 1) {
      state.screen = "ending";
      return;
    }
    this.loadStage(state, state.stageIndex + 1);
  },
};
