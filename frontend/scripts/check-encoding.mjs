import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetDir = path.join(root, "src");
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md"]);

// Typical mojibake markers for cp1251/utf8 mix that are not part of Russian alphabet.
const badCharPattern = /[ЀЂЃЄЅІЇЈЉЊЋЌЍЎЏѐђѓєѕіїјљњћќўџ°±²³´µ¶·¸¹º»¼½¾¿]/u;

const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.has(ext)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (badCharPattern.test(lines[i])) {
        offenders.push({ file: path.relative(root, fullPath), line: i + 1, text: lines[i].trim() });
      }
    }
  }
}

walk(targetDir);

if (offenders.length > 0) {
  console.error("Encoding issue detected (possible mojibake):");
  for (const item of offenders) {
    console.error(`- ${item.file}:${item.line} ${item.text}`);
  }
  process.exit(1);
}

console.log("Encoding check passed: no mojibake markers found.");
