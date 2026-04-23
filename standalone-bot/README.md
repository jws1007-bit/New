# AI 데일리 뉴스 텔레그램 봇 (GitHub Actions 단독 운영)

서버나 데이터베이스 없이, GitHub Actions만으로 매일 오전 8시(KST)에 AI 뉴스를 수집·요약하여 텔레그램으로 발송합니다.

## 동작 방식

1. GitHub Actions가 매일 오전 8시(KST) 자동 실행
2. 8개 RSS 소스에서 최근 36시간 내 AI 뉴스 수집 (최대 30개)
3. OpenAI로 한국어 종합 요약 생성
4. 텔레그램 채팅방으로 발송

## 설치 방법

### 1. GitHub 저장소 만들기

이 폴더를 GitHub 저장소에 푸시합니다. 필요한 파일은 다음 두 가지만 있으면 됩니다:

- `standalone-bot/` 폴더 전체
- `.github/workflows/daily-digest.yml`

다른 폴더(`artifacts/`, `lib/` 등)는 옵션 3 운영에 필요 없습니다.

### 2. GitHub Secrets 등록

저장소 페이지에서 **Settings → Secrets and variables → Actions → New repository secret** 클릭 후 다음 3개를 등록합니다:

| 이름 | 값 |
|------|-----|
| `TELEGRAM_BOT_TOKEN` | BotFather에서 받은 봇 토큰 |
| `TELEGRAM_CHAT_ID` | `6349428378` (현재 등록된 ID) |
| `OPENAI_API_KEY` | OpenAI에서 발급받은 API 키 ([platform.openai.com/api-keys](https://platform.openai.com/api-keys)) |

> **중요**: 기존 Replit 환경에서는 Replit AI 통합을 통해 OpenAI를 사용했지만, GitHub Actions에서는 본인의 OpenAI API 키가 필요합니다. 비용은 매일 약 $0.001~0.01 정도 (gpt-4o-mini 기준)입니다.

### 3. 모델 변경 (선택)

기본은 `gpt-4o-mini`(저렴+빠름)입니다. 다른 모델을 쓰려면 **Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**에서:

- 이름: `OPENAI_MODEL`
- 값: `gpt-4o`, `gpt-4-turbo` 등

### 4. 첫 실행 테스트

저장소의 **Actions 탭 → Daily AI News Digest → Run workflow** 클릭으로 즉시 수동 실행 가능합니다. 1~2분 후 텔레그램으로 다이제스트가 도착합니다.

## 발송 시간 변경

`.github/workflows/daily-digest.yml`의 cron 값을 수정하세요:

```yaml
- cron: "0 23 * * *"  # 매일 23:00 UTC = 익일 08:00 KST
```

GitHub Actions는 UTC를 사용하므로 KST 시간에서 9시간을 빼야 합니다.
- 오전 8시 KST → `0 23 * * *`
- 오전 9시 KST → `0 0 * * *`
- 정오 12시 KST → `0 3 * * *`

## 비용

- **GitHub Actions**: 퍼블릭 저장소는 무료, 프라이빗은 월 2,000분 무료 (이 봇은 월 약 30분 사용)
- **OpenAI API**: gpt-4o-mini 기준 월 약 $0.30~$1
- **Telegram Bot**: 무료

## 문제 해결

- **메시지가 안 옴**: Actions 탭에서 워크플로우 실행 로그 확인. 실패 시 빨간 X 표시.
- **"Bot was blocked"**: 텔레그램에서 봇과의 대화방을 다시 열고 `/start` 입력
- **"Invalid chat_id"**: `TELEGRAM_CHAT_ID` 시크릿 값 확인
