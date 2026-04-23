import Parser from "rss-parser";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !GEMINI_API_KEY) {
  console.error("필수 환경변수 누락");
  process.exit(1);
}
const AI_NEWS_SOURCES = [
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml" },
  { name: "Google AI Blog", url: "https://blog.research.google/feeds/posts/default" },
  { name: "arXiv AI", url: "https://arxiv.org/rss/cs.AI" },
];
const parser = new Parser({ timeout: 15000, headers: { "User-Agent": "Mozilla/5.0 AINewsBot" } });
function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
async function collectNews() {
  const articles = [];
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  for (const source of AI_NEWS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of feed.items.slice(0, 6)) {
        if (!item.title || !item.link) continue;
        const pubTime = new Date(item.pubDate || item.isoDate || Date.now()).getTime();
        if (pubTime < cutoff) continue;
        articles.push({
          source: source.name,
          title: stripHtml(item.title).slice(0, 200),
          summary: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 150),
          url: item.link,
          pubTime,
        });
      }
      console.log(`✓ ${source.name}`);
    } catch (err) {
      console.warn(`✗ ${source.name}: ${err.message}`);
    }
  }
  articles.sort((a, b) => b.pubTime - a.pubTime);
  console.log(`총 ${articles.length}개 기사 수집`);
  return articles.slice(0, 15);
}
async function callGemini(prompt, retries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 3000, temperature: 0.7 },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "요약 생성 실패";
    }
    const errText = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const wait = 30 * attempt;
      console.log(`한도 초과, ${wait}초 대기 후 재시도 (${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`Gemini API 오류: ${res.status} ${errText.slice(0, 300)}`);
  }
  throw new Error("Gemini 재시도 모두 실패");
}
async function generateDigest(articles) {
  if (articles.length === 0) return "오늘 수집된 AI 뉴스가 없습니다.";
  const list = articles.map((a, i) => `${i + 1}. [${a.source}] ${a.title}\n   ${a.summary}\n   ${a.url}`).join("\n\n");
  const prompt = `당신은 AI 뉴스 큐레이터입니다. 아래 뉴스를 한국어로 요약하세요.
${list}
형식:
1. 🌟 *오늘의 AI 동향* (2-3줄)
2. 📰 *주요 뉴스 TOP 5* (각 2줄 + 링크)
3. 📊 *한줄 인사이트*
텔레그램 마크다운(*굵게*) 사용.`;
  return await callGemini(prompt);
}
async function sendTelegram(text) {
  const MAX = 4000;
  for (let i = 0; i < text.length; i += MAX) {
    const chunk = text.slice(i, i + MAX);
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: chunk, parse_mode: "Markdown", disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram 오류: ${res.status} ${await res.text()}`);
  }
}
async function main() {
  console.log("=== AI 뉴스 다이제스트 시작 ===");
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" });
  const articles = await collectNews();
  if (articles.length === 0) {
    await sendTelegram(`📱 *AI 데일리 뉴스* - ${today}\n\n오늘은 새로운 AI 뉴스가 없습니다.`);
    return;
  }
  console.log("Gemini로 요약 생성 중...");
  const digest = await generateDigest(articles);
  console.log("텔레그램 전송 중...");
  await sendTelegram(`📱 *AI 데일리 뉴스* - ${today}\n\n${digest}`);
  console.log(`✅ 완료: ${articles.length}개 기사 발송`);
}
main().catch(err => { console.error("실행 실패:", err); process.exit(1); });
