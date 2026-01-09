import { NextResponse } from "next/server";
import { fetchSubredditRss, rankCandidates } from "@/lib/reddit";
import { z } from "zod";

const QuerySchema = z.object({
  sort: z.enum(["hot", "new"]).optional().default("hot"),
  limit: z.coerce.number().int().min(1).max(25).optional().default(15),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    sort: url.searchParams.get("sort") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { sort, limit } = parsed.data;

  const { url: feedUrl, items } = await fetchSubredditRss("OnePieceTCG", sort);
  const ranked = rankCandidates(items).slice(0, limit);

  return NextResponse.json({
    subreddit: "OnePieceTCG",
    sort,
    feedUrl,
    count: ranked.length,
    candidates: ranked.map((c) => ({
      title: c.title,
      link: c.link,
      author: c.author,
      isoDate: c.isoDate,
      pubDate: c.pubDate,
      commentsCount: c.commentsCount ?? null,
      score: Number(c.score.toFixed(4)),
      ageHours: Number((c.ageMs / (1000 * 60 * 60)).toFixed(2)),
    })),
  });
}
