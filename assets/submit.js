(() => {
  const form = document.getElementById("form");
  const drop = document.getElementById("drop");
  const fileInput = document.getElementById("files");
  const fileList = document.getElementById("file-list");
  const status = document.getElementById("status");
  const preview = document.getElementById("preview-card");
  const titleEl = document.getElementById("title");
  const idEl = document.getElementById("id");
  const coverEl = document.getElementById("cover");

  let files = [];
  let cfg = {
    repo: "jephyrus-svg/simya-arcade",
    pages: "https://jephyrus-svg.github.io/simya-arcade",
    submitLabel: "game-submit",
  };

  fetch("arcade.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => { cfg = { ...cfg, ...j }; })
    .catch(() => {});

  fetch("https://api.github.com/repos/jephyrus-svg/simya-arcade/issues?labels=game-submit&state=open&per_page=20")
    .then((r) => r.ok ? r.json() : [])
    .then((issues) => {
      const el = document.getElementById("queue-count");
      if (el) el.textContent = (issues.length || 0) + " WAITING";
    })
    .catch(() => {});

  function slugify(title) {
    const ascii = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return ascii.length >= 2 ? ascii : "";
  }

  titleEl.addEventListener("input", () => {
    if (!idEl.dataset.touched) {
      const s = slugify(titleEl.value);
      if (s) idEl.value = s;
    }
    paintPreview();
  });
  idEl.addEventListener("input", () => { idEl.dataset.touched = "1"; paintPreview(); });
  ["genre", "players", "blurb"].forEach((id) => {
    document.getElementById(id).addEventListener("input", paintPreview);
  });
  coverEl.addEventListener("change", paintPreview);

  function paintPreview() {
    const title = titleEl.value || "새 게임";
    const genre = document.getElementById("genre").value;
    const players = document.getElementById("players").value || "1인";
    const blurb = document.getElementById("blurb").value || "한 줄 소개가 여기에 보입니다.";
    let cover = "assets/covers/_default.svg";
    if (coverEl.files[0]) cover = URL.createObjectURL(coverEl.files[0]);
    preview.innerHTML = `
      <a class="card" href="#" onclick="return false">
        <div class="cover">
          <img src="${cover}" alt="" />
          <div class="bezel"></div>
          <span class="badge">심사 전</span>
        </div>
        <div class="meta">
          <div class="row">
            <h2></h2>
            <span class="genre">${genre} · ${players}</span>
          </div>
          <p></p>
          <span class="play">PLAY ▶</span>
        </div>
      </a>`;
    preview.querySelector("h2").textContent = title;
    preview.querySelector(".meta p").textContent = blurb;
  }
  paintPreview();

  function showFiles() {
    fileList.innerHTML = files.map((f) => `<li>${f.path} · ${Math.ceil(f.blob.size / 1024)}KB</li>`).join("");
  }

  async function addFileList(list) {
    const next = [];
    for (const file of list) {
      const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
      if (file.name.startsWith(".")) continue;
      next.push({ path, blob: file });
    }
    if (next.length) files = next;
    showFiles();
  }

  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    addFileList(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => addFileList(fileInput.files));

  function meta() {
    return {
      id: idEl.value.trim().toLowerCase(),
      title: titleEl.value.trim(),
      genre: document.getElementById("genre").value,
      players: document.getElementById("players").value.trim() || "1인",
      controls: document.getElementById("controls").value.trim() || "키보드",
      blurb: document.getElementById("blurb").value.trim(),
      entry: "index.html",
      author: document.getElementById("author").value.trim(),
    };
  }

  function issueBody(m) {
    return [
      "<!-- simya-arcade-submission -->",
      "```json",
      JSON.stringify(m, null, 2),
      "```",
      "<!-- /simya-arcade-submission -->",
      "",
      `첨부: \`simya-${m.id}.zip\` 파일을 이 이슈에 **드래그해서 첨부**해 주세요.`,
      "",
      "관리자가 `approved` 라벨을 달면 홈피에 바로 게시됩니다.",
    ].join("\n");
  }

  function setStatus(text, kind) {
    status.className = "notice" + (kind ? " " + kind : "");
    status.innerHTML = text;
  }

  async function buildZip(m) {
    if (typeof JSZip === "undefined") throw new Error("zip 라이브러리를 못 불러왔습니다. 네트워크를 확인하세요.");
    if (!files.length) throw new Error("게임 파일을 넣어 주세요.");
    const html = files.find((f) => /\.html?$/i.test(f.path));
    if (!html) throw new Error("index.html 같은 HTML 파일이 필요합니다.");

    const zip = new JSZip();
    let prefix = "";
    const tops = new Set(files.map((f) => f.path.split("/")[0]));
    if (files.every((f) => f.path.includes("/")) && tops.size === 1) prefix = [...tops][0] + "/";

    const names = files.map((f) => (f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path));
    if (names.some((n) => n === "index.html" || n === "index.htm")) m.entry = "index.html";
    else m.entry = (html.path.startsWith(prefix) ? html.path.slice(prefix.length) : html.path).split("/").pop();

    for (const f of files) {
      let name = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
      if (!name || name.endsWith("/")) continue;
      zip.file(name, f.blob);
    }
    zip.file("manifest.json", JSON.stringify(m, null, 2));

    const cover = coverEl.files[0];
    if (cover) {
      const blob = await toJpeg(cover);
      zip.file("cover.jpg", blob);
    }

    return zip.generateAsync({ type: "blob" });
  }

  function toJpeg(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = 960, h = 540;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0a0810";
        ctx.fillRect(0, 0, w, h);
        const scale = Math.max(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("cover"))), "image/jpeg", 0.82);
      };
      img.onerror = () => reject(new Error("커버 이미지를 읽지 못했습니다."));
      img.src = URL.createObjectURL(file);
    });
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = meta();
    if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(m.id)) {
      setStatus("아이디는 영문 소문자, 숫자, 하이픈만 2~32자로 적어 주세요.", "err");
      return;
    }
    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    setStatus("zip을 만드는 중…");
    try {
      const blob = await buildZip(m);
      const zipName = `simya-${m.id}.zip`;
      downloadBlob(blob, zipName);
      const body = issueBody(m);
      try { await navigator.clipboard.writeText(body); } catch (_) {}
      const url = `https://github.com/${cfg.repo}/issues/new?labels=${encodeURIComponent(cfg.submitLabel)}&title=${encodeURIComponent("[게임] " + m.title)}&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener");
      setStatus(
        `<strong>거의 다 됐습니다.</strong><ol class="checklist">` +
        `<li>방금 <code>${zipName}</code> 이 내려갔습니다.</li>` +
        `<li>열린 GitHub 이슈 창에서 본문이 비어 있으면 붙여넣기 하세요. 본문은 클립보드에 복사해 두었습니다.</li>` +
        `<li>그 이슈에 zip 파일을 드래그해서 첨부한 뒤 Submit 하세요.</li>` +
        `<li>관리자가 승인하면 로비에 바로 올라갑니다.</li></ol>`,
        "ok"
      );
    } catch (err) {
      setStatus(err.message || String(err), "err");
    } finally {
      btn.disabled = false;
    }
  });
})();
