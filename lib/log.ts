import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const DIR = path.join(process.cwd(), "content", "log");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
};

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const { data } = matter(fs.readFileSync(path.join(DIR, f), "utf8"));
      return {
        slug,
        title: String(data.title ?? slug),
        date: String(data.date ?? ""),
        description: String(data.description ?? ""),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): { meta: PostMeta; html: string } | null {
  const file = path.join(DIR, slug + ".md");
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const html = marked.parse(content, { gfm: true, async: false }) as string;
  return {
    meta: {
      slug,
      title: String(data.title ?? slug),
      date: String(data.date ?? ""),
      description: String(data.description ?? ""),
    },
    html,
  };
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const y = parts[0];
  const m = months[parseInt(parts[1], 10) - 1] ?? parts[1];
  const d = parseInt(parts[2], 10);
  return `${m} ${d}, ${y}`;
}
