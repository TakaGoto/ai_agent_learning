import Parser from "rss-parser";

export type RedditItem = {
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
  commentsCount?: number;
};

const parser: Parser<any, any> = new Parser({
  customFields: {
    item: [
      ["slash:comments", "slashComments"], // often present in Reddit RSS
      ["dc:creator", "dcCreator"],
    ],
  },
});

function safeNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function fetchSubredditRss(
  subreddit: string,
  sort: "hot" | "new" = "hot"
) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.rss`;
  const feed = await parser.parseURL(url);

  const items: RedditItem[] = (feed.items ?? [])
    .map((it: any) => ({
      title: String(it.title ?? "").trim(),
      link: String(it.link ?? it.guid ?? "").trim(),
      pubDate: it.pubDate,
      isoDate: it.isoDate,
      author: it.dcCreator ?? it.creator ?? it.author,
      commentsCount: safeNum(it.slashComments),
    }))
    .filter((it) => it.title.length > 0 && it.link.startsWith("http"));

  return { url, items };
}

export type RankedRedditItem = RedditItem & {
  score: number;
  ageMs: number;
};

export function rankCandidates(items: RedditItem[]): RankedRedditItem[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const scored = items.map((it) => {
    const t = Date.parse(it.isoDate ?? it.pubDate ?? "") || now;
    const ageMs = Math.max(0, now - t);

    // If RSS doesn’t include comment count, this stays 0.
    const comments = it.commentsCount ?? 0;

    // Simple, stable scoring:
    // - Prefer more comments
    // - Prefer newer posts (linear decay over 24h)
    const recency = Math.max(0, 1 - ageMs / DAY); // 1..0
    const score = Math.log1p(comments) * 2 + recency * 1;

    return { ...it, score, ageMs };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
