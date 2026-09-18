window.Game = window.Game || {};

Game.AI = {
  plan: function (state) {
    const simUnits = state.units.map(function (u) {
      return {
        id: u.id,
        team: u.team,
        hp: u.hp,
        maxHp: u.maxHp,
        atk: u.atk,
        def: u.def,
        mag: u.mag,
        res: u.res,
        mov: u.mov,
        rng: u.rng,
        healRng: u.healRng,
        magic: u.magic,
        fly: u.fly,
        job: u.job,
        x: u.x,
        y: u.y,
        acted: u.acted,
        bounty: u.bounty,
      };
    });
    const sim = { map: state.map, units: simUnits };
    const actions = [];
    const enemies = simUnits.filter(function (u) {
      return u.team === "enemy" && u.hp > 0;
    });

    enemies.forEach(function (unit) {
      const moves = Game.Path.moveRange(sim, unit);
      let best = null;
      let bestScore = -Infinity;

      moves.forEach(function (m) {
        const targets = Game.Path.attackTargets(sim, unit, m);
        targets.forEach(function (t) {
          const dmg = Game.Battle.damage(sim, unit, t);
          let score = 40 + dmg * 3;
          if (t.job === "healer") score += 36;
          if (t.job === "mage") score += 22;
          if (t.hp <= dmg) score += 50;
          score += (t.maxHp - t.hp);
          score -= m.c * 0.2;
          if (score > bestScore) {
            bestScore = score;
            best = { x: m.x, y: m.y, targetId: t.id };
          }
        });
      });

      if (best) {
        actions.push({ type: "move", id: unit.id, x: best.x, y: best.y });
        actions.push({ type: "attack", id: unit.id, targetId: best.targetId });
        unit.x = best.x;
        unit.y = best.y;
        const victim = simUnits.find(function (u) {
          return u.id === best.targetId;
        });
        if (victim) {
          victim.hp = Math.max(0, victim.hp - Game.Battle.damage(sim, unit, victim));
        }
        unit.acted = true;
        return;
      }

      const players = simUnits.filter(function (u) {
        return u.team === "player" && u.hp > 0;
      });
      if (!players.length) {
        actions.push({ type: "wait", id: unit.id });
        unit.acted = true;
        return;
      }

      let nearest = players[0];
      let nd = Game.Path.manhattan(unit, nearest);
      players.forEach(function (p) {
        const d = Game.Path.manhattan(unit, p);
        if (d < nd) {
          nd = d;
          nearest = p;
        }
      });

      let bestM = { x: unit.x, y: unit.y, c: 0 };
      let bestD = Game.Path.manhattan(bestM, nearest);
      moves.forEach(function (m) {
        const d = Game.Path.manhattan(m, nearest);
        if (d < bestD || (d === bestD && m.c < bestM.c)) {
          bestD = d;
          bestM = m;
        }
      });
      actions.push({ type: "move", id: unit.id, x: bestM.x, y: bestM.y });
      actions.push({ type: "wait", id: unit.id });
      unit.x = bestM.x;
      unit.y = bestM.y;
      unit.acted = true;
    });

    return actions;
  },
};
