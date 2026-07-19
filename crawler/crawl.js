import fs from "node:fs/promises";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

const MAX_PAGES = Number(process.env.MAX_PAGES || 50);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 2500);
const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ||
  "MiniSearchCrawler/3.0";

const seeds = JSON.parse(await fs.readFile("data/seeds.json", "utf8"));
const existingIndex = JSON.parse(await fs.readFile("data/index.json", "utf8"));
const existingQueue = JSON.parse(await fs.readFile("data/queue.json", "utf8"));

const indexed = new Map(existingIndex.map(page => [page.url, page]));
const queue = [];
const queued = new Set();

function normaliseUrl(value, base) {
  try {
    const url = new URL(value, base);

    if (!["http:", "https:"].includes(url.protocol)) return null;

    url.hash = "";

    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "fbclid",
      "gclid"
    ]) {
      url.searchParams.delete(key);
    }

    const blockedExtensions = [
      ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
      ".pdf", ".zip", ".rar", ".7z",
      ".mp3", ".wav", ".mp4", ".avi", ".mov",
      ".css", ".js"
    ];

    if (
      blockedExtensions.some(extension =>
        url.pathname.toLowerCase().endsWith(extension)
      )
    ) return null;

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function addToQueue(value, discoveredFrom = null) {
  const url = normaliseUrl(value);

  if (!url) return;
  if (indexed.has(url)) return;
  if (queued.has(url)) return;

  queued.add(url);
  queue.push({ url, discoveredFrom });
}

for (const item of existingQueue) {
  addToQueue(
    typeof item === "string" ? item : item.url,
    typeof item === "object" ? item.discoveredFrom || null : null
  );
}

for (const seed of seeds) {
  addToQueue(seed);
}

const robotsCache = new Map();
const lastRequestByOrigin = new Map();

async function waitForOrigin(origin) {
  const previous = lastRequestByOrigin.get(origin) || 0;
  const elapsed = Date.now() - previous;

  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve =>
      setTimeout(resolve, REQUEST_DELAY_MS - elapsed)
    );
  }

  lastRequestByOrigin.set(origin, Date.now());
}

async function politeFetch(url) {
  const origin = new URL(url).origin;
  await waitForOrigin(origin);

  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
}

async function isAllowed(url) {
  const origin = new URL(url).origin;

  if (!robotsCache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;

    try {
      const response = await politeFetch(robotsUrl);
      const text = response.ok ? await response.text() : "";
      robotsCache.set(origin, robotsParser(robotsUrl, text));
    } catch {
      robotsCache.set(origin, robotsParser(robotsUrl, ""));
    }
  }

  return robotsCache.get(origin).isAllowed(url, USER_AGENT) !== false;
}

let processed = 0;

while (queue.length && processed < MAX_PAGES) {
  const item = queue.shift();
  queued.delete(item.url);

  if (indexed.has(item.url)) continue;

  processed += 1;
  console.log(`[${processed}/${MAX_PAGES}] ${item.url}`);

  try {
    if (!(await isAllowed(item.url))) {
      console.log("Blocked by robots.txt");
      continue;
    }

    const response = await politeFetch(item.url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      throw new Error("Not HTML");
    }

    const finalUrl = normaliseUrl(response.url) || item.url;
    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, noscript, iframe, svg, canvas").remove();

    const text = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    if (text.length < 50) {
      throw new Error("Too little readable text");
    }

    const title = (
      $('meta[property="og:title"]').attr("content") ||
      $("title").first().text() ||
      new URL(finalUrl).hostname
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const description = (
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      text.slice(0, 260)
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    indexed.set(finalUrl, {
      url: finalUrl,
      title,
      description,
      text,
      domain: new URL(finalUrl).hostname,
      discoveredFrom: item.discoveredFrom,
      crawledAt: new Date().toISOString()
    });

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const discoveredUrl = normaliseUrl(href, finalUrl);

      if (discoveredUrl) {
        addToQueue(discoveredUrl, finalUrl);
      }
    });

    console.log("Indexed");
  } catch (error) {
    console.log(`Skipped: ${error.message}`);
  }
}

await fs.writeFile(
  "data/index.json",
  JSON.stringify([...indexed.values()], null, 2) + "\n"
);

await fs.writeFile(
  "data/queue.json",
  JSON.stringify(queue, null, 2) + "\n"
);

console.log(`Indexed total: ${indexed.size}`);
console.log(`Queue remaining: ${queue.length}`);
