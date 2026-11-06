// Builds one self-contained HTML page from every PNG under a directory so a
// developer on one OS can eyeball the app on all of them side by side.
// Usage: node scripts/contact-sheet.mjs <dir> <out.html>
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const [, , dir, out] = process.argv;
if (!dir || !out) {
  console.error("usage: node scripts/contact-sheet.mjs <dir> <out.html>");
  process.exit(2);
}

function walk(d) {
  const files = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (name.toLowerCase().endsWith(".png")) files.push(p);
  }
  return files;
}

const files = walk(dir).sort();
const cards = files
  .map((f) => {
    const b64 = readFileSync(f).toString("base64");
    const label = relative(dir, f).replace(/\\/g, "/");
    return `<figure><img src="data:image/png;base64,${b64}" alt="${label}"><figcaption>${label}</figcaption></figure>`;
  })
  .join("\n");

const html = `<!doctype html><meta charset="utf-8"><title>Contact sheet</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;background:#f3f4f6;color:#111}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:8px}
img{width:100%;height:auto;display:block;border:1px solid #e5e7eb}
figcaption{font:12px/1.4 ui-monospace,monospace;margin-top:6px;word-break:break-all}
</style>
<h1>Contact sheet</h1><p>${files.length} screenshot(s) from <code>${dir}</code></p>
<div class="grid">${cards}</div>`;

writeFileSync(out, html);
console.log(`wrote ${out} with ${files.length} image(s)`);
