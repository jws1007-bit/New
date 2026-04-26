import os
import requests
from datetime import datetime, timezone, timedelta
from google import genai
from google.genai import types

# 1. 환경 변수 설정
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

if not GEMINI_API_KEY:
    print("🚨 API 키 누락")
    exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)

# 2. '오늘 날짜' 정확히 계산 (한국 시간 기준)
kst = timezone(timedelta(hours=9))
today_str = datetime.now(kst).strftime("%Y년 %m월 %d일")

# 3. 구글 검색을 강제하는 프롬프트
prompt = f"""
당신은 전 세계 AI 동향을 분석하는 최고 수준의 기술 리서처입니다.
🚨 매우 중요: 오늘 날짜는 **{today_str}** 입니다. 반드시 구글 검색을 활용하여 과거 뉴스가 아닌 **{today_str} 기준 지난 24시간 이내의 가장 최신 글로벌 AI 뉴스** 8~10개를 선정해주세요.

각 뉴스마다 다음 형식을 지켜서 작성해줘:
1. 제목 앞에 적절한 이모지 사용
2. 핵심 내용을 2~3문장으로 간결하게 요약
3. 해당 뉴스의 출처([원문 보기](실제 URL 주소))를 반드시 포함

전체적인 분위기는 스마트하고 읽기 편한 다이제스트 형식으로 작성해줘.
"""

# 4. '구글 검색 도구'를 켜고 뉴스 생성
print(f"🔍 {today_str} 기준 최신 AI 뉴스를 검색 중입니다...")
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents=prompt,
    config=types.GenerateContentConfig(
        tools=[{"google_search": {}}], # 구글 실시간 검색 활성화!
    )
)
news_digest = f"🚀 **[{today_str} 글로벌 AI 뉴스 상세 브리핑]**\n\n{response.text}"

# 5. 텔레그램 발송 (안전장치 포함)
def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False
    }
    res = requests.post(url, data=payload)
    if res.status_code != 200:
        payload.pop("parse_mode")
        requests.post(url, data=payload)

send_telegram_message(news_digest)

