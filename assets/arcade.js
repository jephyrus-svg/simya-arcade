const LAST_KEY = "simya-arcade-last";
const DEFAULT_COVER = "assets/covers/_default.svg";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function safePath(p, allow) {
  const s = String(p || "");
  if (allow.some((pre) => s.startsWith(pre)) && !s.includes("..") && !s.includes("://")) return s;
  return "";
}

async function loadCatalog() {
  const res = await fetch("games.json", { cache: "no-store" });
  if (!res.ok) throw new Error("catalog");
  return res.json();
}

function playUrl(id) {
  return "play.html?id=" + encodeURIComponent(id);
}

function renderLobby(data) {
  const games = data.games || [];
  const last = localStorage.getItem(LAST_KEY);
  const grid = document.getElementById("grid");
  const filters = document.getElementById("filters");
  const count = document.getElementById("count");
  const genres = ["전체", ...Array.from(new Set(games.map((g) => g.genre)))];
  let current = "전체";

  document.getElementById("game-count").textContent = games.length + " GAMES";
  count.textContent = games.length + "개";

  filters.innerHTML = "";
  genres.forEach((genre) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.textContent = genre;
    btn.setAttribute("aria-pressed", genre === current ? "true" : "false");
    btn.addEventListener("click", () => {
      current = genre;
      [...filters.children].forEach((el) => el.setAttribute("aria-pressed", el.textContent === current ? "true" : "false"));
      paint();
    });
    filters.appendChild(btn);
  });

  function paint() {
    const list = current === "전체" ? games : games.filter((g) => g.genre === current);
    count.textContent = list.length + "개";
    if (!list.length) {
      grid.innerHTML = '<p class="empty">이 장르 게임이 아직 없습니다.</p>';
      return;
    }
    grid.innerHTML = list.map((g) => {
      const featured = g.featured ? " featured" : "";
      const badge = g.id === last ? '<span class="badge">이어서</span>' : g.featured ? '<span class="badge">추천</span>' : "";
      const cover = safePath(g.cover, ["assets/", "game/"]) || DEFAULT_COVER;
      return `
        <a class="card${featured}" href="${playUrl(g.id)}">
          <div class="cover">
            <img src="${esc(cover)}" alt="${esc(g.title)} 커버" onerror="this.src='${DEFAULT_COVER}'" />
            <div class="bezel"></div>
            ${badge}
          </div>
          <div class="meta">
            <div class="row">
              <h2>${esc(g.title)}</h2>
              <span class="genre">${esc(g.genre)} · ${esc(g.players)}</span>
            </div>
            <p>${esc(g.blurb)}</p>
            <span class="play">PLAY ▶</span>
          </div>
        </a>`;
    }).join("");
  }

  paint();
}

function bootLobby() {
  loadCatalog()
    .then(renderLobby)
    .catch(() => {
      document.getElementById("grid").innerHTML =
        '<p class="empty">목록을 불러오지 못했습니다. 폴더를 더블클릭하지 말고, 로컬 서버나 공개 주소로 열어 주세요.</p>';
    });
}

function bootPlay() {
  const id = new URLSearchParams(location.search).get("id");
  const iframe = document.getElementById("stage");
  const title = document.getElementById("title");
  const hint = document.getElementById("hint");

  loadCatalog()
    .then((data) => {
      const game = (data.games || []).find((g) => g.id === id);
      if (!game) {
        title.textContent = "게임을 찾을 수 없습니다";
        hint.textContent = "로비로 돌아가 다시 골라 주세요.";
        return;
      }
      const entry = safePath(game.entry, ["game/"]);
      if (!entry) {
        title.textContent = "경로가 안전하지 않습니다";
        return;
      }
      document.title = game.title + " · 심야오락실";
      title.textContent = game.title;
      hint.textContent = game.controls;
      iframe.src = encodeURI(entry);
      localStorage.setItem(LAST_KEY, game.id);
      iframe.addEventListener("load", () => {
        try { iframe.contentWindow.focus(); } catch (_) {}
      });
    })
    .catch(() => {
      title.textContent = "목록 오류";
    });

  document.getElementById("fs").addEventListener("click", () => {
    const node = document.documentElement;
    if (!document.fullscreenElement) node.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.body.addEventListener("pointerdown", () => {
    try { iframe.contentWindow.focus(); } catch (_) {}
  });
}

window.Arcade = { bootLobby, bootPlay };
