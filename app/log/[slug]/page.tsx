import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPost, formatDate } from "@/lib/log";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.meta.title} — Deadlatch`,
    description: post.meta.description,
    alternates: { canonical: `https://deadlatch.dev/log/${slug}` },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      url: `https://deadlatch.dev/log/${slug}`,
      type: "article",
    },
  };
}

export default async function Post({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <main className="wrap logwrap">
      <Link href="/log" className="log-back mono">
        ← The Log
      </Link>
      <article className="log-article">
        <header className="log-article-head">
          <span className="log-date mono">{formatDate(post.meta.date)}</span>
          <h1>{post.meta.title}</h1>
        </header>
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </main>
  );
}
