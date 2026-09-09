// Crawl the public pages of a running site and print status and title per path. Used before and after the upgrade.
const origin = process.argv[2] ?? "http://localhost:3000";
const paths = ["/", "/audit", "/log", "/log/confused-deputy", "/log/a-log-is-not-proof", "/log/the-head-leaves-the-building", "/robots.txt", "/sitemap.xml", "/nope-404"];
for (const p of paths) {
  const r = await fetch(origin + p, { redirect: "manual" });
  const text = await r.text();
  const title = /<title>([^<]*)<\/title>/.exec(text)?.[1] ?? "";
  console.log(`${r.status} ${p} ${title}`);
}
