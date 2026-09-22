// Downloads the latin woff2 subsets of Instrument Serif that Google Fonts serves, plus the OFL text.
// Run once: node scripts/fetch-instrument-serif.mjs
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CSS_URL = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
const OFL_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt";
const OUT = path.resolve("app/fonts");

const css = await (await fetch(CSS_URL, { headers: { "user-agent": UA } })).text();
// Google's css2 output places a "/* latin */" comment before each latin @font-face block.
const pick = (style) => {
  const re = new RegExp(String.raw`/\* latin \*/\s*@font-face\s*\{[^}]*font-style:\s*${style}[^}]*url\((https:[^)]+\.woff2)\)`);
  const m = css.match(re);
  if (!m) throw new Error(`no latin ${style} face in the css response`);
  return m[1];
};
const save = async (url, name) => {
  const buf = Buffer.from(await (await fetch(url, { headers: { "user-agent": UA } })).arrayBuffer());
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, buf.length, "bytes");
};
fs.mkdirSync(OUT, { recursive: true });
await save(pick("normal"), "InstrumentSerif-Regular.woff2");
await save(pick("italic"), "InstrumentSerif-Italic.woff2");
fs.writeFileSync(path.join(OUT, "InstrumentSerif-OFL.txt"), await (await fetch(OFL_URL)).text());
console.log("InstrumentSerif-OFL.txt written");
