(() => {
  const TOKEN_KEY = "simya-admin-token";
  const pendingEl = document.getElementById("pending");
  const recentEl = document.getElementById("recent");
  const tokenEl = document.getElementById("token");
  const tokenStatus = document.getElementById("token-status");

  let cfg = {
    repo: "jephyrus-svg/simya-arcade",
    pages: "https://jephyrus-svg.github.io/simya-arcade",
    submitLabel: "game-submit",
    approveLabel: "approved",
    publishedLabel: "published",
    rejectLabel: "rejected",
  };

  tokenEl.value = sessionStorage.getItem(TOKEN_KEY) || "";

  document.getElementById("save-token").addEventListener("click", () => {
    const t = tokenEl.value.trim();
    if (!t) return;
    sessionStorage.setItem(TOKEN_KEY, t);
    tokenStatus.textContent = "이 브라우저 탭에만 저장했습니다. 원클릭 승인을 쓸 수 있습니다.";
  });
  document.getElementById("clear-token").addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    tokenEl.value = "";
    tokenStatus.textContent = "토큰을 지웠습니다.";
  });
  document.getElementById("reload").addEventListener("click", () => load());

  function token() {
    return tokenEl.value.trim() || sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function headers() {
    const h = { Accept: "application/vnd.github+json", "User-Agent": "simya-arcade-admin" };
    if (token()) h.Authorization = "Bearer " + token();
    return h;
  }

  function parseMeta(body) {
    const m = /```json\s*(\{[\s\S]*?\})\s*```/.exec(body || "");
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (_) { return null; }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function issueUrl(n) {
    return `https://github.com/${cfg.repo}/issues/${n}`;
  }

  function card(issue, mode) {
    const meta = parseMeta(issue.body) || {};
    const labels = (issue.labels || []).map((l) => l.name);
    const pills = labels.map((n) => `<span class="pill">${esc(n)}</span>`).join("");
    const title = meta.title || issue.title;
    const blurb = meta.blurb || "";
    const id = meta.id || "";
    let actions = `<a class="btn" href="${issueUrl(issue.number)}" target="_blank" rel="noopener">GitHub에서 보기</a>`;
    if (mode === "pending") {
      actions += `<button class="btn good" data-act="approve" data-n="${issue.number}">승인하고 게시</button>`;
      actions += `<button class="btn warn" data-act="reject" data-n="${issue.number}">거절</button>`;
    }
    return `<article class="issue">
      <div class="pills">${pills}</div>
      <h3>${esc(title)} ${id ? `<span class="hint">#${esc(id)}</span>` : ""}</h3>
      <p>${esc(blurb) || "소개 없음"} · 제출자 @${esc(issue.user && issue.user.login)}</p>
      <div class="actions">${actions}</div>
    </article>`;
  }

  async function addLabel(n, label) {
    const t = token();
    if (!t) {
      window.open(issueUrl(n), "_blank", "noopener");
      alert("토큰이 없어 GitHub 이슈 페이지를 열었습니다. 거기서 " + label + " 라벨을 달면 됩니다.");
      return;
    }
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/issues/${n}/labels`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ labels: [label] }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error("라벨 실패 " + res.status + " " + text.slice(0, 180));
    }
  }

  pendingEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await addLabel(btn.dataset.n, btn.dataset.act === "approve" ? cfg.approveLabel : cfg.rejectLabel);
      tokenStatus.textContent = btn.dataset.act === "approve"
        ? "승인했습니다. 액션이 홈피에 올리는 중입니다. 약 1분 뒤 로비를 새로고침하세요."
        : "거절 라벨을 달았습니다.";
      await load();
    } catch (err) {
      tokenStatus.textContent = err.message;
      btn.disabled = false;
    }
  });

  async function load() {
    pendingEl.innerHTML = '<p class="empty">불러오는 중…</p>';
    recentEl.innerHTML = '<p class="empty">불러오는 중…</p>';
    try {
      cfg = { ...cfg, ...(await fetch("arcade.json", { cache: "no-store" }).then((r) => r.json())) };
    } catch (_) {}
    const base = `https://api.github.com/repos/${cfg.repo}/issues`;
    try {
      const [open, closed] = await Promise.all([
        fetch(`${base}?labels=${cfg.submitLabel}&state=open&per_page=30`, { headers: headers() }).then((r) => r.json()),
        fetch(`${base}?state=closed&per_page=20`, { headers: headers() }).then((r) => r.json()),
      ]);
      const pending = Array.isArray(open) ? open.filter((i) => !i.pull_request) : [];
      pendingEl.innerHTML = pending.length
        ? pending.map((i) => card(i, "pending")).join("")
        : '<p class="empty">대기 중인 제출이 없습니다.</p>';
      const rec = (Array.isArray(closed) ? closed : [])
        .filter((i) => !i.pull_request)
        .filter((i) => (i.labels || []).some((l) => l.name === cfg.publishedLabel || l.name === cfg.rejectLabel || l.name === cfg.submitLabel));
      recentEl.innerHTML = rec.length
        ? rec.map((i) => card(i, "done")).join("")
        : '<p class="empty">최근 처리된 제출이 없습니다.</p>';
    } catch (err) {
      pendingEl.innerHTML = `<p class="empty">목록을 못 불러왔습니다. ${esc(err.message)}</p>`;
      recentEl.innerHTML = "";
    }
  }

  load();
})();
