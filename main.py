import os
import requests
import yfinance as yf
from datetime import datetime, timezone, timedelta
from google import genai
from google.genai import types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

kst = timezone(timedelta(hours=9))
today_str = datetime.now(kst).strftime("%Y년 %m월 %d일")

# 1. 금융/원자재 데이터
tickers = {
    "🇰🇷 KOSPI": "^KS11", "🇺🇸 나스닥": "^IXIC", "🇨🇳 상해종합": "000001.SS", "🇯🇵 닛케이": "^N225",
    "💵 USD/KRW": "KRW=X", "💴 USD/JPY": "JPY=X", "🇮🇳 USD/INR": "INR=X", "💶 USD/EUR": "EUR=X", "📊 달러지수": "DX-Y.NYB",
    "💰 금": "GC=F", "🥈 은": "SI=F", "🏗️ 구리": "HG=F", "⛓️ 알루미늄": "ALI=F", "🛢️ WTI유": "CL=F", "⛽ 브렌트유": "BZ=F"
}

finance_text = f"📊 <b>[{today_str} 금융/원자재 시황]</b>\n\n"
for name, ticker in tickers.items():
    try:
        data = yf.Ticker(ticker).history(period="2d")
        if len(data) >= 2:
            current, prev = data['Close'].iloc[-1], data['Close'].iloc[-2]
            pct = ((current - prev) / prev) * 100
            sign = "🔺" if pct > 0 else "🔻" if pct < 0 else "➖"
            finance_text += f"{name}: {current:,.2f} ({sign}{pct:+.2f}%)\n"
    except: 
        finance_text += f"{name}: 조회불가\n"

# 2. 뉴스 요약 (원문 링크 강제 프롬프트 적용)
client = genai.Client(api_key=GEMINI_API_KEY)
prompt = f"""
당신은 텔레그램 뉴스 브리핑 봇입니다. 
🚨 오늘 날짜는 {today_str}입니다. 구글 검색을 통해 실시간 한국 뉴스를 취합하세요. (경제 50%, 정치/사회 40%, 삼성 라이온즈 5%, 연예 5%)

[🚨매우 엄격한 출력 규칙]
1. 마크다운 기호(별표 **, 대괄호 [] 등)는 텔레그램 에러를 유발하므로 절대 금지합니다.
2. 각 기사마다 구글 검색을 통해 **실제 뉴스 기사의 인터넷 주소(URL)를 반드시 찾아내세요.** URL이 빠지면 절대 안 됩니다.
3. 기사 작성 시 아래의 HTML 태그 형식을 한 글자도 빠짐없이 지켜주세요:

<b>기사 제목</b>
- 요약 내용 (1~2줄)
- <a href="여기에_실제_검색한_기사_URL_입력">🔗 원문보기</a>
<br>

4. 한국 10년물 및 미국 10년물 국채 금리는 뉴스 섹션 맨 위에 일반 텍스트로 적어주세요.
"""

print("뉴스 분석 및 텔레그램 최적화 중...")
response = client.models.generate_content(
    model='gemini-2.0-flash',
    contents=prompt,
    config=types.GenerateContentConfig(tools=[{"google_search": {}}])
)

# 3. 통합 및 텔레그램 발송
final_text = finance_text + "\n📰 <b>[주요 뉴스 브리핑]</b>\n\n" + response.text

def send_telegram(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID, 
        "text": text, 
        "parse_mode": "HTML", 
        "disable_web_page_preview": True
    }
    res = requests.post(url, data=payload)
    
    if res.status_code != 200:
        print(f"⚠️ HTML 렌더링 에러 발생. 일반 텍스트로 안전하게 우회 발송합니다. 사유: {res.text}")
        payload.pop("parse_mode")
        requests.post(url, data=payload)
    else:
        print("✅ 텔레그램 발송 성공!")

send_telegram(final_text)

