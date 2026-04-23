import Parser from "rss-parser";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !GEMINI_API_KEY) {
  console.error("필수 환경변수 누락: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY");
  process.exit(1);
}

const AI_NEWS_SOURCES = [
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", category: "Research" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", category: "Industry" },
  { name: "The Verge - AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", category: "Industry" },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/artificial-intelligence/latest/rss", category: "Industry" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "Industry" },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", category: "Research" },
  { name: "Google AI Blog", url: "https://blog.research.google/feeds/posts/default", category: "Research" },
  { name: "arXiv AI", url: "https://arxiv.org/rss/cs.AI", category: "Research" },
];

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)" },
});

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function collectNews() {
  const articles = [];
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;

  for (const source of AI_NEWS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of feed.items.slice(0, 8)) {
        if (!item.title || !item.link) continue;
        const pubTime = new Date(item.pubDate || item.isoDate || Date.now()).getTime();
        if (pubTime < cutoff) continue;

        articles.push({
          source: source.name,
          category: source.category,
          title: stripHtml(item.title).slice(0, 300),
          summary: stripHtml(item.contentSnippet || item.summary || item.content || "").slice(0, 400),
          url: item.link,
          pubTime,
        });
      }
      console.log(`✓ ${source.name}: ${feed.items.length}개 중 처리`);
    } catch (err) {
      console.warn(`✗ ${source.name} 수집 실패: ${err.message}`);
    }
  }

  articles.sort((a, b) => b.pubTime - a.pubTime);
  console.log(`총 ${articles.length}개 기사 수집 완료`);
  return articles.slice(0, 20);
}

async function generateDigest(articles) {
  if (articles.length === 0) return "오늘 수집된 AI 뉴스가 없습니다.";

  const articleList = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}${a.summary ? `\n   ${a.summary.slice(0, 200)}` : ""}\n   링크: ${a.url}`)
    .join("\n\n");

  const prompt = `당신은 AI 뉴스 전문 큐레이터입니다. 아래 AI 관련 뉴스들을 한국어로 종합 요약해주세요.

수집된 뉴스 목록:
${articleList}

다음 형식으로 작성해주세요:
1. 🌟 *오늘의 AI 주요 동향* (전체 2-3줄 요약)
2. 📰 *주요 뉴스 TOP 5* (가장 중요한 5개를 골라 각각 2-3줄 설명 + 원문 링크)
3. 🔬 *연구/기술 동향* (연구 관련 뉴스 요약, 없으면 생략)
4. 💼 *산업/비즈니스 동향* (기업/제품 관련 뉴스 요약, 없으면 생략)
5. 📊 *오늘의 AI 한줄 인사이트*

한국어로 명확하고 전문적으로 작성해주세요. 텔레그램 마크다운(*굵게*) 형식을 사용하세요.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "요약 생성 실패";
}

async function sendTelegram(text) {
  const MAX = 4000;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: chunk,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Telegram 전송 실패: ${res.status} ${errText}`);
    }
  }
}

async function main() {
  console.log("=== AI 뉴스 다이제스트 시작 ===");
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul",
  });

  const articles = await collectNews();
  if (articles.length === 0) {
    await sendTelegram(`📱 *AI 데일리 뉴스* - ${today}\n\n오늘은 새로운 AI 뉴스가 없습니다.`);
    return;
  }

  console.log("Gemini로 요약 생성 중...");
  const digest = await generateDigest(articles);

  console.log("텔레그램 전송 중...");
  await sendTelegram(`📱 *AI 데일리 뉴스* - ${today}\n\n${digest}`);

  console.log(`✅ 완료: ${articles.length}개 기사 다이제스트 발송`);
}

main().catch((err) => {
  console.error("실행 실패:", err);
  process.exit(1);
});
