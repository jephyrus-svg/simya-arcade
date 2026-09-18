window.Game = window.Game || {};

Game.TILE = 52;
Game.COLS = 12;
Game.ROWS = 10;
Game.EXP_MAX = 100;
Game.LEVEL_CAP = 10;
Game.ALLOC_POINTS = 3;

Game.TERRAIN = {
  ".": { name: "초원", cost: 1, def: 0, rest: 0, flyOnly: false, wall: false, cavalryBlock: false, fill: "#4e8f3e", fill2: "#3f7a32" },
  F: { name: "숲", cost: 2, def: 1, rest: 0, flyOnly: false, wall: false, cavalryBlock: false, fill: "#2d6a34", fill2: "#24582b" },
  M: { name: "산", cost: 3, def: 2, rest: 0, flyOnly: false, wall: false, cavalryBlock: true, fill: "#8a7360", fill2: "#6e5b4b" },
  W: { name: "물", cost: 99, def: 0, rest: 0, flyOnly: true, wall: false, cavalryBlock: false, fill: "#3b6ea8", fill2: "#2f5b8e" },
  "#": { name: "벽", cost: 99, def: 0, rest: 0, flyOnly: false, wall: true, cavalryBlock: false, fill: "#2a2433", fill2: "#1c1824" },
  "=": { name: "다리", cost: 1, def: 0, rest: 0, flyOnly: false, wall: false, cavalryBlock: false, fill: "#c4a06a", fill2: "#a98654" },
  R: { name: "폐허", cost: 1, def: 1, rest: 0, flyOnly: false, wall: false, cavalryBlock: false, fill: "#8b7d70", fill2: "#74685d" },
  C: { name: "성", cost: 1, def: 1, rest: 0.1, flyOnly: false, wall: false, cavalryBlock: false, fill: "#6d687c", fill2: "#575366" },
  H: { name: "요새", cost: 1, def: 2, rest: 0.2, flyOnly: false, wall: false, cavalryBlock: false, fill: "#b08a4a", fill2: "#8f6e38" },
};

Game.JOBS = {
  warrior: { name: "전사", mov: 4, rng: 1, minRng: 1, healRng: 0, magic: false, fly: false, cavalry: false, kind: "infantry", primary: "atk" },
  knight: { name: "기사", mov: 7, rng: 1, minRng: 1, healRng: 0, magic: false, fly: false, cavalry: true, kind: "cavalry", primary: "atk" },
  dragon: { name: "용기사", mov: 8, rng: 1, minRng: 1, healRng: 0, magic: false, fly: true, cavalry: false, kind: "flyer", primary: "atk" },
  mage: { name: "마법사", mov: 4, rng: 2, minRng: 1, healRng: 0, magic: true, fly: false, cavalry: false, kind: "mage", primary: "mag" },
  healer: { name: "힐러", mov: 5, rng: 1, minRng: 1, healRng: 1, magic: false, fly: false, cavalry: false, kind: "healer", primary: "mag" },
};

Game.PARTY_TEMPLATES = [
  { id: "p-warrior", name: "검호", job: "warrior", sprite: "warrior", hp: 34, atk: 11, def: 9, mag: 1, res: 4 },
  { id: "p-knight", name: "성하", job: "knight", sprite: "knight", hp: 28, atk: 10, def: 7, mag: 2, res: 5 },
  { id: "p-dragon", name: "류진", job: "dragon", sprite: "dragon", hp: 24, atk: 11, def: 5, mag: 2, res: 3 },
  { id: "p-mage", name: "세린", job: "mage", sprite: "mage", hp: 16, atk: 3, def: 2, mag: 12, res: 8 },
  { id: "p-healer", name: "미라", job: "healer", sprite: "healer", hp: 20, atk: 4, def: 4, mag: 10, res: 9 },
];

Game.ENEMIES = {
  slime: { name: "슬라임", sprite: "slime", hp: 10, atk: 5, def: 1, mag: 0, res: 1, mov: 3, rng: 1, minRng: 1, magic: false, fly: false, cavalry: false, vsFlyer: false, vsCavalry: false, exp: 32 },
  goblin: { name: "고블린", sprite: "goblin", hp: 14, atk: 7, def: 3, mag: 0, res: 2, mov: 4, rng: 1, minRng: 1, magic: false, fly: false, cavalry: false, vsFlyer: false, vsCavalry: false, exp: 40 },
  wolf: { name: "숲늑대", sprite: "wolf", hp: 16, atk: 8, def: 3, mag: 0, res: 2, mov: 5, rng: 1, minRng: 1, magic: false, fly: false, cavalry: false, vsFlyer: false, vsCavalry: false, exp: 46 },
  spear: { name: "창병", sprite: "spear", hp: 18, atk: 8, def: 6, mag: 0, res: 3, mov: 4, rng: 1, minRng: 1, magic: false, fly: false, cavalry: false, vsFlyer: false, vsCavalry: true, exp: 52 },
  archer: { name: "궁수", sprite: "archer", hp: 12, atk: 8, def: 2, mag: 0, res: 2, mov: 4, rng: 2, minRng: 2, magic: false, fly: false, cavalry: false, vsFlyer: true, vsCavalry: false, exp: 52 },
  boss: { name: "흑기사", sprite: "boss", hp: 50, atk: 13, def: 8, mag: 4, res: 6, mov: 6, rng: 1, minRng: 1, magic: false, fly: false, cavalry: true, vsFlyer: false, vsCavalry: false, exp: 120 },
};

Game.parseMap = function (raw) {
  const rows = raw.trim().split("\n").map(function (line) {
    return line.trim();
  });
  if (rows.length !== Game.ROWS) {
    throw new Error("map rows " + rows.length);
  }
  rows.forEach(function (row) {
    if (row.length !== Game.COLS) throw new Error("map cols " + row.length + " " + row);
  });
  return { cols: Game.COLS, rows: Game.ROWS, tiles: rows };
};

Game.STAGES = [
  {
    id: 1,
    name: "초원",
    title: "제1장 초원의 습격",
    blurb: "이동 후 공격 또는 대기. 기병은 빠르고, 용기사는 하늘을 난다.",
    allySpawns: [
      [1, 4],
      [1, 5],
      [1, 6],
      [2, 4],
      [2, 6],
    ],
    enemies: [
      { kind: "slime", x: 9, y: 3 },
      { kind: "slime", x: 10, y: 5 },
      { kind: "slime", x: 9, y: 7 },
    ],
    map: Game.parseMap(`
............
............
............
............
............
............
............
............
............
............
`),
  },
  {
    id: 2,
    name: "숲",
    title: "제2장 닫힌 숲길",
    blurb: "말은 숲에서 더디다. 용기사는 나무 위를 그대로 날아간다.",
    allySpawns: [
      [1, 4],
      [1, 5],
      [1, 6],
      [2, 3],
      [2, 7],
    ],
    enemies: [
      { kind: "wolf", x: 10, y: 4 },
      { kind: "wolf", x: 10, y: 6 },
      { kind: "goblin", x: 8, y: 2 },
      { kind: "goblin", x: 8, y: 8 },
      { kind: "slime", x: 6, y: 5 },
    ],
    map: Game.parseMap(`
....FFFF....
...FF..FF...
..FF....FF..
.FF......FF.
............
............
.FF......FF.
..FF....FF..
...FF..FF...
....FFFF....
`),
  },
  {
    id: 3,
    name: "다리",
    title: "제3장 강의 다리",
    blurb: "보병은 다리를 건넌다. 용기사는 강 위를 날아 옆구리를 찌른다.",
    allySpawns: [
      [3, 9],
      [4, 9],
      [5, 9],
      [3, 8],
      [5, 8],
    ],
    enemies: [
      { kind: "spear", x: 3, y: 0 },
      { kind: "spear", x: 4, y: 0 },
      { kind: "spear", x: 5, y: 0 },
      { kind: "goblin", x: 3, y: 1 },
      { kind: "goblin", x: 5, y: 1 },
    ],
    map: Game.parseMap(`
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
WWW===WWWWWW
`),
  },
  {
    id: 4,
    name: "폐허",
    title: "제4장 무너진 신전",
    blurb: "활은 나는 자를 떨어뜨린다. 용기사를 궁수에게 들이밀지 마라.",
    allySpawns: [
      [0, 3],
      [1, 3],
      [2, 3],
      [0, 6],
      [1, 6],
    ],
    enemies: [
      { kind: "archer", x: 10, y: 2 },
      { kind: "archer", x: 10, y: 7 },
      { kind: "archer", x: 5, y: 1 },
      { kind: "spear", x: 7, y: 4 },
      { kind: "goblin", x: 7, y: 5 },
      { kind: "wolf", x: 8, y: 4 },
    ],
    map: Game.parseMap(`
##........##
#....RR....#
..RR####RR..
............
.##......##.
.##......##.
............
..RR####RR..
#....RR....#
##........##
`),
  },
  {
    id: 5,
    name: "성문",
    title: "제5장 성문의 흑기사",
    blurb: "흑기사는 기병. 창병이 말을 노린다. 요새에 서면 체력이 회복된다.",
    allySpawns: [
      [4, 8],
      [5, 8],
      [6, 8],
      [7, 8],
      [5, 7],
    ],
    enemies: [
      { kind: "boss", x: 5, y: 2 },
      { kind: "spear", x: 3, y: 3 },
      { kind: "spear", x: 8, y: 3 },
      { kind: "archer", x: 1, y: 4 },
      { kind: "archer", x: 10, y: 4 },
      { kind: "goblin", x: 4, y: 4 },
      { kind: "goblin", x: 7, y: 4 },
    ],
    map: Game.parseMap(`
############
####....####
###......###
............
............
..H......H..
..CCCCCCCC..
..C......C..
..C..HH..C..
############
`),
  },
];

Game.makeHero = function (template) {
  const job = Game.JOBS[template.job];
  return {
    id: template.id,
    name: template.name,
    job: template.job,
    jobName: job.name,
    sprite: template.sprite,
    team: "player",
    hp: template.hp,
    maxHp: template.hp,
    atk: template.atk,
    def: template.def,
    mag: template.mag,
    res: template.res,
    mov: job.mov,
    rng: job.rng,
    minRng: job.minRng || 1,
    healRng: job.healRng,
    magic: job.magic,
    fly: job.fly,
    cavalry: job.cavalry,
    kind: job.kind,
    vsFlyer: false,
    vsCavalry: false,
    level: 1,
    exp: 0,
    x: 0,
    y: 0,
    acted: false,
    alive: true,
  };
};

Game.makeEnemy = function (kind, x, y, index, stageIndex) {
  const base = Game.ENEMIES[kind];
  const bump = stageIndex;
  return {
    id: "e-" + index,
    name: base.name,
    job: kind,
    jobName: base.name,
    sprite: base.sprite,
    team: "enemy",
    hp: base.hp + bump * 2,
    maxHp: base.hp + bump * 2,
    atk: base.atk + Math.floor(bump / 2),
    def: base.def,
    mag: base.mag,
    res: base.res,
    mov: base.mov,
    rng: base.rng,
    minRng: base.minRng || 1,
    healRng: 0,
    magic: base.magic,
    fly: base.fly,
    cavalry: !!base.cavalry,
    kind: base.kind || "infantry",
    vsFlyer: !!base.vsFlyer,
    vsCavalry: !!base.vsCavalry,
    level: 1 + Math.floor(bump / 2),
    exp: 0,
    bounty: base.exp,
    x: x,
    y: y,
    acted: false,
    alive: true,
  };
};

Game.cloneParty = function (party) {
  return party.map(function (u) {
    return JSON.parse(JSON.stringify(u));
  });
};
