# Skull King Discord Activity (Single Tunnel Ready)

각 계정이 같은 세션에 접속해 함께 플레이할 수 있도록 구성된 Skull King Activity입니다.

## 실행 (한 포트만 사용)
운영 기본 실행:
```powershell
cd "C:\Users\T\Desktop\WORKSPACE\skull_king\skull_king activity"
.\run_activity.ps1
```

개발용 자동 리로드:
```powershell
cd "C:\Users\T\Desktop\WORKSPACE\skull_king\skull_king activity"
.\run_activity_dev.ps1
```

브라우저 접속:
- `http://localhost:8010/?session=skullking-main`
- 헬스체크: `http://localhost:8010/health`
- 메트릭스: `http://localhost:8010/metrics`

## ngrok (동시 터널 막힘 대응)
터널 1개만 엽니다.
```powershell
ngrok http 8010
```

Discord Activity URL 예시:
- `https://lat-leader-rat-images.trycloudflare.com/?session=skullking-main`

이제 프론트와 API를 모두 같은 도메인/포트(8010)에서 제공합니다.

## 구현 요약
- 공식 Skull King 기본 룰 반영 (10라운드, 트럼프 검정, 특수카드 우선순위, 배팅 점수, 보너스 점수)
- 계정별 입장 + 세션 동기화 + 턴/트릭 처리
- 카툰 스타일 카드 UI + 플레이/승자 애니메이션

## Discord OAuth 설정
개발 환경에서는 `discord_activity_skullking/config/discord_config.local.json` 파일을 사용할 수 있습니다.
운영 환경에서는 `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ACTIVITY_IDENTITY_SIGNING_KEY`를 시크릿 주입 방식으로 넣는 것을 권장합니다.

예시:

```json
{
  "discord_client_id": "YOUR_APP_ID",
  "discord_client_secret": "YOUR_CLIENT_SECRET"
}
```

주의:
- Discord Activity RPC authorize 플로우에서는 `redirect_uri`를 보내지 않습니다.
- `discord_config.local.json`의 `discord_client_id`는 프론트와 서버가 같이 사용합니다.

## Firebase 인증서 경로
- 기본 위치: `discord_activity_skullking/config/firebase.json`
- 사용자 지정 위치: 환경변수 `FIREBASE_CREDENTIALS_PATH`
- 운영 상세 계약: `docs/deployment-env.md`

## 참고
- 메모리 저장 방식이라 서버 재시작 시 세션 초기화
- Advanced 룰(Kraken/White Whale/Loot)은 아직 미포함
- 현재 실시간 구조는 `single-instance` 배포를 기준으로 안전합니다.
