#!/usr/bin/env python3
"""Publish an approved 심야오락실 game submission from a GitHub issue."""

from __future__ import annotations

import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ALLOWED_EXT = {
    ".html", ".htm", ".css", ".js", ".mjs", ".json",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm",
    ".txt", ".md", ".csv", ".ttf", ".otf", ".woff", ".woff2",
}
FORBIDDEN_PARTS = {".github", ".git", "node_modules"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,31}$")
JSON_BLOCK_RE = re.compile(
    r"<!--\s*simya-arcade-submission\s*-->\s*```json\s*(\{.*?\})\s*```\s*<!--\s*/simya-arcade-submission\s*-->",
    re.S,
)
JSON_FALLBACK_RE = re.compile(r"```json\s*(\{.*?\})\s*```", re.S)
HTML_BLOCK_RE = re.compile(r"```html\s*(.*?)```", re.S)
FILE_URL_RE = re.compile(
    r"https://github\.com/user-attachments/(?:files/\d+/[^\s)\"']+|assets/[a-f0-9-]+)",
    re.I,
)
MAX_ZIP_BYTES = 8 * 1024 * 1024
MAX_FILES = 200

ROOT = Path(__file__).resolve().parents[2]


def api(url: str, token: str, accept: str = "application/vnd.github+json") -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": accept,
            "User-Agent": "simya-arcade-publisher",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {url}: {e.read()[:400]!r}") from e


def parse_meta(body: str) -> dict:
    body = body or ""
    m = JSON_BLOCK_RE.search(body) or JSON_FALLBACK_RE.search(body)
    if not m:
        raise RuntimeError("이슈 본문에 제출 JSON이 없습니다.")
    data = json.loads(m.group(1))
    if not isinstance(data, dict):
        raise RuntimeError("제출 JSON 형식이 잘못되었습니다.")
    return data


def validate_meta(meta: dict, existing_ids: set[str]) -> dict:
    gid = str(meta.get("id", "")).strip().lower()
    if not ID_RE.match(gid):
        raise RuntimeError("id는 영문 소문자, 숫자, 하이픈만 2~32자여야 합니다.")
    if gid in existing_ids:
        raise RuntimeError(f"이미 있는 게임 id 입니다: {gid}")
    title = str(meta.get("title", "")).strip()
    if not title or len(title) > 40:
        raise RuntimeError("제목이 없거나 너무 깁니다.")
    genre = str(meta.get("genre", "기타")).strip() or "기타"
    players = str(meta.get("players", "1인")).strip() or "1인"
    controls = str(meta.get("controls", "")).strip()[:80]
    blurb = str(meta.get("blurb", "")).strip()[:120]
    if not blurb:
        raise RuntimeError("한 줄 소개가 필요합니다.")
    author = str(meta.get("author", "")).strip()[:40]
    entry_name = str(meta.get("entry", "index.html")).strip() or "index.html"
    entry_name = Path(entry_name).name
    if Path(entry_name).suffix.lower() not in {".html", ".htm"}:
        raise RuntimeError("시작 파일은 HTML 이어야 합니다.")
    return {
        "id": gid,
        "title": title,
        "genre": genre[:20],
        "players": players[:12],
        "controls": controls or "키보드",
        "blurb": blurb,
        "author": author,
        "entry_name": entry_name,
    }


def safe_relpath(name: str) -> Path | None:
    raw = name.replace("\\", "/").lstrip("/")
    path = Path(raw)
    if path.is_absolute() or ".." in path.parts:
        return None
    if any(p.startswith(".") and p not in {".", ".."} for p in path.parts if p in FORBIDDEN_PARTS):
        return None
    if any(p in FORBIDDEN_PARTS for p in path.parts):
        return None
    if path.suffix.lower() not in ALLOWED_EXT and path.name not in {"manifest.json", "cover.jpg", "cover.png", "cover.jpeg", "cover.webp"}:
        if path.suffix.lower() not in ALLOWED_EXT:
            return None
    return path


def unpack_zip(data: bytes, dest: Path) -> list[str]:
    if len(data) > MAX_ZIP_BYTES:
        raise RuntimeError("zip이 너무 큽니다 (최대 8MB).")
    dest.mkdir(parents=True, exist_ok=True)
    written = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        infos = [i for i in zf.infolist() if not i.is_dir()]
        if len(infos) > MAX_FILES:
            raise RuntimeError("파일이 너무 많습니다.")
        names = [i.filename.replace("\\", "/") for i in infos]
        prefix = common_root(names)
        for info in infos:
            name = info.filename.replace("\\", "/")
            if prefix and name.startswith(prefix):
                name = name[len(prefix):]
            rel = safe_relpath(name)
            if rel is None or str(rel) == ".":
                continue
            if rel.name == "manifest.json":
                continue
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src:
                payload = src.read()
            if rel.name.lower().startswith("cover.") and rel.parent == Path("."):
                continue
            target.write_bytes(payload)
            written.append(str(rel))
    return written


def common_root(names: list[str]) -> str:
    cleaned = [n for n in names if n and not n.endswith("/")]
    if not cleaned:
        return ""
    top = {n.split("/")[0] for n in cleaned}
    if len(top) == 1 and all("/" in n for n in cleaned):
        return next(iter(top)) + "/"
    return ""


def extract_cover(data: bytes, dest: Path, gid: str) -> str | None:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            name = Path(info.filename.replace("\\", "/")).name.lower()
            if name in {"cover.jpg", "cover.jpeg", "cover.png", "cover.webp"}:
                ext = ".jpg" if name.endswith((".jpg", ".jpeg")) else Path(name).suffix
                out = dest / f"{gid}{ext}"
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(zf.read(info))
                return f"assets/covers/{gid}{ext}"
    return None


def find_entry(game_dir: Path, preferred: str) -> str:
    cand = game_dir / preferred
    if cand.is_file():
        return preferred
    for name in ("index.html", "index.htm", "game.html"):
        if (game_dir / name).is_file():
            return name
    htmls = sorted(game_dir.rglob("*.html")) + sorted(game_dir.rglob("*.htm"))
    if htmls:
        return str(htmls[0].relative_to(game_dir)).replace("\\", "/")
    raise RuntimeError("HTML 시작 파일이 없습니다.")


def load_catalog(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_catalog(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def collect_urls(issue: dict, comments: list[dict]) -> list[str]:
    blobs = [issue.get("body") or ""]
    blobs.extend(c.get("body") or "" for c in comments)
    urls = []
    for blob in blobs:
        for url in FILE_URL_RE.findall(blob):
            if url not in urls:
                urls.append(url)
    return urls


def download_url(url: str, token: str) -> bytes:
    return api(url, token, accept="application/octet-stream")


def publish_from_issue(issue: dict, comments: list[dict], token: str, root: Path) -> dict:
    catalog_path = root / "games.json"
    catalog = load_catalog(catalog_path)
    existing = {g.get("id") for g in catalog.get("games", [])}
    meta = validate_meta(parse_meta(issue.get("body") or ""), existing)

    gid = meta["id"]
    game_dir = root / "game" / gid
    if game_dir.exists():
        raise RuntimeError(f"폴더가 이미 있습니다: game/{gid}")

    urls = collect_urls(issue, comments)
    zip_bytes = None
    cover_bytes = None
    html_name = None
    html_bytes = None

    for url in urls:
        payload = download_url(url, token)
        lower = url.lower()
        if payload[:2] == b"PK":
            zip_bytes = payload
        elif lower.endswith((".png", ".jpg", ".jpeg", ".webp")) or payload[:3] in (b"\xff\xd8\xff", b"\x89PN"):
            cover_bytes = payload
            cover_ext = ".png" if payload[:4] == b"\x89PNG" else ".jpg"
        elif payload.lstrip().lower().startswith(b"<!doctype html") or payload.lstrip().lower().startswith(b"<html"):
            html_bytes = payload
            html_name = "index.html"

    if zip_bytes is None:
        html_m = HTML_BLOCK_RE.search(issue.get("body") or "")
        if html_m and not html_bytes:
            html_bytes = html_m.group(1).encode("utf-8")
            html_name = meta["entry_name"]

    written = []
    cover = "assets/covers/_default.svg"
    if zip_bytes:
        written = unpack_zip(zip_bytes, game_dir)
        found = extract_cover(zip_bytes, root / "assets" / "covers", gid)
        if found:
            cover = found
    elif html_bytes:
        game_dir.mkdir(parents=True, exist_ok=True)
        (game_dir / html_name).write_bytes(html_bytes)
        written = [html_name]
    else:
        raise RuntimeError("첨부된 게임 파일(zip 또는 HTML)이 없습니다. 이슈에 zip을 첨부했는지 확인하세요.")

    if cover_bytes:
        ext = ".png" if cover_bytes[:4] == b"\x89PNG" else ".jpg"
        out = root / "assets" / "covers" / f"{gid}{ext}"
        out.write_bytes(cover_bytes)
        cover = f"assets/covers/{gid}{ext}"

    entry_file = find_entry(game_dir, meta["entry_name"])
    entry = f"game/{gid}/{entry_file}"

    item = {
        "id": gid,
        "title": meta["title"],
        "entry": entry,
        "cover": cover,
        "genre": meta["genre"],
        "players": meta["players"],
        "controls": meta["controls"],
        "blurb": meta["blurb"],
    }
    if meta["author"]:
        item["author"] = meta["author"]

    catalog.setdefault("games", []).insert(0, item)
    save_catalog(catalog_path, catalog)

    result = {
        "id": gid,
        "title": meta["title"],
        "entry": entry,
        "cover": cover,
        "files": written[:50],
        "fileCount": len(written),
    }
    (root / "publish-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def self_test(tmp: Path) -> None:
    games = {
        "name": "심야오락실",
        "games": [{"id": "tetris", "title": "테트리스", "entry": "game/tetris/index.html", "cover": "x", "genre": "퍼즐", "players": "1인", "controls": "x", "blurb": "x"}],
    }
    (tmp / "games.json").write_text(json.dumps(games), encoding="utf-8")
    (tmp / "assets" / "covers").mkdir(parents=True, exist_ok=True)
    (tmp / "game").mkdir(parents=True, exist_ok=True)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("index.html", "<!DOCTYPE html><title>Hi</title><body>ok</body>")
        zf.writestr("cover.jpg", b"\xff\xd8\xff\xdbfakejpeg")
        zf.writestr("manifest.json", "{}")
    zip_bytes = buf.getvalue()

    body = """
<!-- simya-arcade-submission -->
```json
{"id":"night-run","title":"나이트런","genre":"액션","players":"1인","controls":"방향키","blurb":"달려라","entry":"index.html","author":"테스터"}
```
<!-- /simya-arcade-submission -->
[zip](https://github.com/user-attachments/files/1/simya-night-run.zip)
"""
    issue = {"body": body, "number": 1}
    # monkeypatch download
    global download_url

    def fake_download(url: str, token: str) -> bytes:
        return zip_bytes

    download_url = fake_download  # type: ignore
    result = publish_from_issue(issue, [], "token", tmp)
    assert result["id"] == "night-run"
    assert (tmp / "game" / "night-run" / "index.html").is_file()
    cat = json.loads((tmp / "games.json").read_text())
    assert cat["games"][0]["id"] == "night-run"
    assert cat["games"][1]["id"] == "tetris"
    try:
        publish_from_issue(issue, [], "token", tmp)
        raise SystemExit("duplicate should fail")
    except RuntimeError as e:
        assert "이미 있는" in str(e)
    print("self-test ok")


def main() -> int:
    if "--self-test" in sys.argv:
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            self_test(Path(d))
        return 0

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not token or not repo or not event_path:
        print("GITHUB_TOKEN / GITHUB_REPOSITORY / GITHUB_EVENT_PATH required", file=sys.stderr)
        return 2
    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    issue = event.get("issue") or {}
    number = issue.get("number")
    if not number:
        print("no issue in event", file=sys.stderr)
        return 2
    comments = json.loads(
        api(f"https://api.github.com/repos/{repo}/issues/{number}/comments?per_page=50", token)
    )
    result = publish_from_issue(issue, comments, token, ROOT)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
