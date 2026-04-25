import os
import requests
from google import genai

# 1. 환경 변수 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

# 2. 클라이언트 초기화
client = genai.Client(api_key=GEMINI_API_KEY)

# 3. 더 강력해진 프롬프트
prompt = """
전 세계 주요 IT 및 AI 뉴스 사이트(The Verge, TechCrunch, Wired, MIT Technology Review 등)를 참고하여 
지난 24시간 동안 가장 중요한 글로벌 AI 관련 뉴스 8~10개를 선정해줘.

각 뉴스마다 다음 형식을 지켜서 작성해줘:
1. 제목 앞에 적절한 이모지 사용
2. 핵심 내용을 2~3문장으로 간결하게 요약
3. 해당 뉴스의 출처(신뢰할 수 있는 뉴스 사이트의 URL 주소)를 반드시 포함

전체적인 분위기는 스마트하고 읽기 편한 다이제스트 형식으로 작성해줘.
"""

# 4. 뉴스 생성
print("풍성한 뉴스 다이제스트를 생성 중입니다...")
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents=prompt,
)
news_digest = f"🚀 **[오늘의 AI 뉴스 상세 브리핑]**\n\n{response.text}"

# 5. 텔레그램 발송
def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False  # 링크 미리보기 활성화
    }
    telegram_response = requests.post(url, data=payload)
    if telegram_response.status_code == 200:
        print("상세 뉴스 발송 성공!")
    else:
        # 메시지가 너무 길 경우를 대비한 간단한 예외 처리
        print(f"발송 실패: {telegram_response.text}")

send_telegram_message(news_digest)
