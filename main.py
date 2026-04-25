import os
import requests
from google import genai

# 1. 환경 변수에서 API 키 및 토큰 불러오기
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

# 2. 최신 Gemini 클라이언트 초기화
client = genai.Client(api_key=GEMINI_API_KEY)

prompt = """
오늘의 글로벌 AI(인공지능) 최신 뉴스 트렌드를 검색해서 핵심만 3~4가지 다이제스트로 요약해줘. 
텔레그램 메시지로 보낼 거니까 가독성 좋게, 스마트폰에서 읽기 편하게 이모지를 섞어서 작성해줘.
"""

# 3. 뉴스 요약 생성 (최신 flash 모델 사용)
print("최신 Gemini 모델이 뉴스를 요약하고 있습니다...")
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents=prompt,
)
news_digest = f"📱 **[오늘의 AI 뉴스 다이제스트]**\n\n{response.text}"

# 4. 텔레그램으로 메시지 발송
def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    telegram_response = requests.post(url, data=payload)
    if telegram_response.status_code == 200:
        print("텔레그램 발송 성공!")
    else:
        print(f"발송 실패: {telegram_response.text}")

send_telegram_message(news_digest)
