# 심야오락실

공개 주소 (맥을 켜두지 않아도 됨):

**https://jephyrus-svg.github.io/simya-arcade/**

누구나 들어와서 바로 플레이하는 HTML 게임 홈피입니다. 다크 테마.

## 로컬에서 열기

이 폴더에서:

```bash
python3 -m http.server 4860
```

브라우저에서 `http://127.0.0.1:4860` 을 엽니다. `index.html`을 더블클릭하면 목록이 안 뜹니다.

## 게임 올리기 (다른 사람)

1. https://jephyrus-svg.github.io/simya-arcade/submit.html 에서 제목과 HTML 파일을 넣습니다.
2. 내려받은 zip을 GitHub 이슈에 첨부합니다.
3. 관리자가 이슈에 `approved` 라벨을 달면, 액션이 `games.json`과 `game/` 폴더를 갱신하고 홈피에 바로 게시합니다.

거절은 `rejected` 라벨입니다. 관리 화면: https://jephyrus-svg.github.io/simya-arcade/admin.html

## 직접 추가 (저장소 주인)

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

`id`는 영문/숫자만 쓰는 것이 안전합니다. 새로 제출되는 게임은 `game/아이디/` 폴더를 씁니다.
