# 심야오락실

누구나 들어와서 바로 플레이하는 HTML 게임 홈피입니다. 다크 테마.

## 로컬에서 열기

이 폴더에서:

```bash
python3 -m http.server 4860
```

브라우저에서 `http://127.0.0.1:4860` 을 엽니다. `index.html`을 더블클릭하면 목록이 안 뜹니다.

## 게임 추가

1. `game/새이름/index.html` 에 게임을 넣습니다.
2. `games.json`에 항목 하나를 추가합니다.

```json
{
  "id": "mygame",
  "title": "새 게임",
  "entry": "game/새이름/index.html",
  "cover": "assets/covers/mygame.jpg",
  "genre": "액션",
  "players": "1인",
  "controls": "방향키 · 스페이스",
  "blurb": "한 줄 소개."
}
```

3. 커버 이미지가 있으면 `assets/covers/mygame.jpg`로 둡니다.
4. 공개 저장소에 푸시하면 홈피에 바로 반영됩니다.

`id`는 영문/숫자만 쓰는 것이 안전합니다. 폴더 이름은 한글이어도 됩니다.
