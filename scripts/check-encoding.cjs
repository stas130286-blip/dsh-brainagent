// CI-гард: текстовые файлы репозитория обязаны быть чистым UTF-8.
// Ловит символы замены (U+FFFD) и типичную латиничную кракозябру,
// которая получается, если кириллицу в UTF-8 ошибочно прочитать как
// латиницу. Файлы с подозрительными символами валят сборку CI.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const fixed = [".gitignore", "LICENSE", "README.md", "CHANGELOG.md"];
const dirs = ["src", "host-patches", "scripts"];
const exts = new Set([".ts", ".md", ".cjs", ".yml", ".json"]);

const files = [];
for (const f of fixed) {
  if (fs.existsSync(path.join(root, f))) files.push(f);
}
for (const d of dirs) {
  const base = path.join(root, d);
  if (!fs.existsSync(base)) continue;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") walk(full);
      } else if (exts.has(path.extname(e.name))) {
        files.push(path.relative(root, full));
      }
    }
  })(base);
}

// U+FFFD и латиничный мусор от неправильной перекодировки кириллицы
const bad = /[\uFFFD\u00D0\u00EF\u00BF\u00BD]/;
let failures = 0;
for (const rel of files) {
  const txt = fs.readFileSync(path.join(root, rel), "utf8");
  const m = txt.match(bad);
  if (m) {
    console.error(
      "encoding: suspicious character U+" +
        m[0].charCodeAt(0).toString(16).padStart(4, "0") +
        " in " +
        rel
    );
    failures++;
  }
}
if (failures > 0) {
  console.error("encoding: " + failures + " file(s) with suspicious characters");
  process.exit(1);
}
console.log("encoding: " + files.length + " files clean");
