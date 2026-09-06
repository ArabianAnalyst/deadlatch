import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/log";

const origin = "https://www.deadlatch.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const newest = posts.map((p) => p.date).filter(Boolean).sort().at(-1);
  const logDate = newest ? new Date(newest) : new Date();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/audit`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/log`, lastModified: logDate, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({
      url: `${origin}/log/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : undefined,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
