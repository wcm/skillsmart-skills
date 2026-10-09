#!/usr/bin/env node
// Skillsmart publisher — validate, security-scan, package and (optionally) upload every skill in a content repo.
// Zero dependencies (Node 22+). The same file is copied into each content repo at .github/scripts/publish.mjs.
//
//   node publish.mjs --repo . --source free --out .skillsmart-build              # build only
//   node publish.mjs --repo . --source free --out .skillsmart-build --upload     # build + upload to R2 (needs wrangler + CLOUDFLARE_API_TOKEN)
//   node publish.mjs --repo . --source free --out .skillsmart-build --local      # upload into wrangler's local R2 (dev)
//
// Env for upload: R2_BUCKET (default "skillsmart"), CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
//                 SKILLSMART_WEB_DIR (folder containing wrangler.jsonc, for --local).
// Exit code 1 if any skill fails validation or the security scan.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };

const REPO = path.resolve(opt("repo", "."));
const SOURCE = opt("source", "free");
const OUT = path.resolve(opt("out", ".skillsmart-build"));
const BUCKET = process.env.R2_BUCKET || "skillsmart";
const ONLY = opt("only", null);

const CATEGORIES = ["web", "slides", "social", "poster", "brand", "motion"];
const SHIP_EXCLUDE = new Set(["previews", "skillsmart.json", "node_modules", "out", ".DS_Store", ".git"]);
const MEDIA = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf"]);
const TEXT = new Set([".md", ".txt", ".json", ".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".html", ".css", ".glsl", ".frag", ".vert", ".yml", ".yaml", ".toml", ".csv", ""]);
const CODE = new Set([".js", ".mjs", ".cjs", ".ts", ".py", ".sh", ".html"]);
// www.w3.org appears in XML namespace URIs (SVG, XLink) that are never fetched.
const ALWAYS_ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "skillsmart.io", "localhost", "127.0.0.1", "x", "www.w3.org"];
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const LIMITS = { files: 2000, totalBytes: 50 * 1024 * 1024, fileBytes: 20 * 1024 * 1024 };

// ---------- helpers ----------
const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) return [{ rel: path.relative(base, p), symlink: true }];
    return e.isDirectory() ? walk(p, base) : [{ rel: path.relative(base, p).split(path.sep).join("/"), abs: p }];
  });

function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

// ---------- validation ----------
function validate(slug, dir) {
  const errors = [];
  const metaPath = path.join(dir, "skillsmart.json");
  if (!fs.existsSync(metaPath)) return { errors: ["missing skillsmart.json"] };
  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch (e) { return { errors: [`skillsmart.json: ${e.message}`] }; }
  const req = ["slug", "name", "tagline", "category", "tier", "version", "tags", "youSay", "whatYouGet", "goodFit", "notFor", "youBring", "needs", "testedIn"];
  for (const k of req) if (meta[k] === undefined) errors.push(`skillsmart.json: missing "${k}"`);
  if (meta.slug !== slug) errors.push(`skillsmart.json: slug "${meta.slug}" must equal folder name "${slug}"`);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) errors.push("slug must be lowercase kebab-case, ≤ 64 chars");
  if (!/^\d+\.\d+\.\d+$/.test(meta.version || "")) errors.push(`version "${meta.version}" must be semver x.y.z`);
  if (!CATEGORIES.includes(meta.category)) errors.push(`category must be one of ${CATEGORIES.join(", ")}`);
  if (!["free", "paid"].includes(meta.tier)) errors.push('tier must be "free" or "paid"');
  if (meta.tier === "paid" && !(meta.price && Number.isInteger(meta.price.amount) && meta.price.amount > 0)) errors.push("paid skills need price.amount (integer, cents)");
  if (SOURCE === "free" && meta.tier !== "free") errors.push("the free repo may only contain free skills");
  if ((meta.tagline || "").length > 140) errors.push("tagline must be ≤ 140 characters");
  if (meta.featured !== undefined && !(Number.isInteger(meta.featured) && meta.featured > 0)) errors.push("featured must be a positive integer (1 = first)");
  // Hosts the skill contacts without an API key (CDNs for fonts or libraries). Shown on the skill page.
  if (meta.network !== undefined) {
    if (!Array.isArray(meta.network)) errors.push("network must be a list of { host, purpose }");
    else for (const n of meta.network) {
      if (!n || !HOST.test(n.host || "")) errors.push(`network: "${n?.host}" is not a hostname`);
      if (!n?.purpose || n.purpose.length > 80) errors.push(`network: ${n?.host} needs a short "purpose" (≤ 80 characters)`);
    }
  }
  const skillMd = path.join(dir, "SKILL.md");
  if (!fs.existsSync(skillMd)) errors.push("missing SKILL.md");
  else {
    const fm = frontmatter(fs.readFileSync(skillMd, "utf8"));
    if (!fm) errors.push("SKILL.md: missing YAML frontmatter");
    else {
      if (fm.name !== slug) errors.push(`SKILL.md: name "${fm.name}" must equal "${slug}"`);
      if (!fm.description || fm.description.length < 40) errors.push("SKILL.md: description missing or too short");
    }
  }
  const prevJson = path.join(dir, "previews", "previews.json");
  let previews = [];
  if (fs.existsSync(prevJson)) {
    previews = JSON.parse(fs.readFileSync(prevJson, "utf8")).previews || [];
    for (const p of previews) for (const f of [p.file, p.poster, p.thumb].filter(Boolean)) {
      if (!fs.existsSync(path.join(dir, "previews", f))) errors.push(`previews.json references missing file ${f}`);
    }
  } else errors.push("missing previews/previews.json");
  return { meta, previews, errors };
}

// ---------- security scan ----------
const RULES = [
  { id: "pipe-to-shell", level: "block", re: /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh|iex|Invoke-Expression|python3?)\b/i, msg: "downloads and runs a remote script" },
  { id: "encoded-exec", level: "block", re: /(base64\s+(-d|--decode)[^\n]*\|\s*(sh|bash))|(powershell[^\n]*-e(nc(odedcommand)?)?\s+[A-Za-z0-9+/=]{20,})|(eval\s*\(\s*atob\s*\()/i, msg: "executes encoded code" },
  { id: "destructive", level: "block", re: /\brm\s+-rf\s+(\/|~\/?(\s|$)|\$HOME\b)|\bmkfs\b|\bdd\s+if=.*of=\/dev\//i, msg: "destructive command" },
  { id: "credential-access", level: "block", re: /(~|\$HOME)\/\.(ssh|aws|gnupg|config\/gcloud|docker\/config\.json)|security\s+(find|dump)-(generic|internet)-password|Login\s+Data|\.kube\/config/i, msg: "reads credentials or keychains" },
  { id: "env-exfil", level: "block", re: /((printenv|\benv\b|process\.env\b(?!\.)|os\.environ\b(?!\.get|\[))[^\n]{0,80}(curl|fetch|requests\.(post|get)|http\.request|axios))|((curl|fetch|requests\.(post|get)|axios)[^\n]{0,120}(JSON\.stringify\(process\.env\)|process\.env\b(?!\.)|os\.environ\b(?!\.get|\[)|\$\(printenv\)))/i, msg: "sends environment variables over the network" },
  { id: "prompt-injection", level: "block", re: /ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (your|the) (instructions|system prompt)|do not (tell|inform) the user|you are now (in )?(developer|dan|jailbreak)/i, msg: "prompt-injection phrasing" },
  { id: "private-key", level: "block", re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, msg: "private key" },
  { id: "secret-token", level: "block", re: /\b(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{20,}|rk_live_[0-9a-zA-Z]{20,}|ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{40,}|xox[baprs]-[0-9A-Za-z-]{10,}|AIza[0-9A-Za-z_-]{35}|sk-ant-[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{40,})\b/, msg: "hard-coded secret" },
  { id: "sudo", level: "warn", re: /\bsudo\s+/, msg: "uses sudo" },
  { id: "chmod-777", level: "warn", re: /chmod\s+(-R\s+)?777/, msg: "world-writable permissions" },
];

function scan(dir, meta) {
  const findings = [];
  const files = walk(dir).filter((f) => !f.rel.startsWith("previews/"));
  const allowedHosts = new Set([...ALWAYS_ALLOWED_HOSTS, ...((meta && meta.byoKey && meta.byoKey.domains) || []), ...((meta && Array.isArray(meta.network) && meta.network.map((n) => n.host)) || [])]);
  let total = 0;
  if (files.length > LIMITS.files) findings.push({ level: "block", rule: "too-many-files", file: ".", msg: `${files.length} files` });
  for (const f of files) {
    if (f.symlink) { findings.push({ level: "block", rule: "symlink", file: f.rel, msg: "symlinks are not allowed" }); continue; }
    const st = fs.statSync(f.abs);
    total += st.size;
    if (st.size > LIMITS.fileBytes) findings.push({ level: "block", rule: "large-file", file: f.rel, msg: `${(st.size / 1e6).toFixed(1)} MB` });
    const ext = path.extname(f.rel).toLowerCase();
    if (MEDIA.has(ext)) continue;
    if (!TEXT.has(ext) && !f.rel.endsWith("package-lock.json")) { findings.push({ level: "block", rule: "file-type", file: f.rel, msg: `unexpected file type ${ext || "(none)"}` }); continue; }
    const text = fs.readFileSync(f.abs, "utf8");
    if (text.includes("\u0000")) { findings.push({ level: "block", rule: "binary", file: f.rel, msg: "binary content in a text file" }); continue; }
    const lines = text.split("\n");
    for (const r of RULES) {
      const i = lines.findIndex((l) => r.re.test(l));
      if (i >= 0) findings.push({ level: r.level, rule: r.id, file: f.rel, line: i + 1, msg: r.msg });
    }
    if (CODE.has(ext) && !f.rel.endsWith("package-lock.json")) {
      if (lines.some((l) => l.length > 3000 && !/\s/.test(l.slice(0, 500)))) findings.push({ level: "block", rule: "obfuscation", file: f.rel, msg: "minified or obfuscated code" });
      if ((text.match(/\\x[0-9a-f]{2}/gi) || []).length > 200 || /String\.fromCharCode\((\s*\d+\s*,){20,}/.test(text)) findings.push({ level: "block", rule: "obfuscation", file: f.rel, msg: "encoded strings" });
      for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        const host = m[1].toLowerCase();
        if (![...allowedHosts].some((h) => host === h || host.endsWith(`.${h}`))) {
          findings.push({ level: "block", rule: "network", file: f.rel, msg: `contacts ${host} (not allow-listed; add it to byoKey.domains or network if intended)` });
        }
      }
    }
  }
  if (total > LIMITS.totalBytes) findings.push({ level: "block", rule: "too-large", file: ".", msg: `${(total / 1e6).toFixed(1)} MB total` });
  const dedup = [...new Map(findings.map((x) => [`${x.rule}|${x.file}|${x.msg}`, x])).values()];
  return { passed: !dedup.some((x) => x.level === "block"), checks: RULES.length + 6, findings: dedup, scannedAt: new Date().toISOString() };
}

// ---------- deterministic ZIP writer (deflate) ----------
function zip(entries) {
  // entries: [{ name, data: Buffer }]
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const nameBuf = Buffer.from(name, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const useStore = comp.length >= data.length;
    const body = useStore ? data : comp;
    const crc = zlib.crc32(data) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(useStore ? 0 : 8, 8);
    h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18);
    h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameBuf.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, nameBuf, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x0314, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(useStore ? 0 : 8, 10);
    c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

// ---------- main ----------
const skillsDir = path.join(REPO, "skills");
const slugs = fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory() && (!ONLY || d === ONLY)).sort();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const catalog = { source: SOURCE, generatedAt: new Date().toISOString(), skills: [] };
const uploads = []; // [key, file, contentType]
let failed = false;

for (const slug of slugs) {
  const dir = path.join(skillsDir, slug);
  const { meta, previews, errors } = validate(slug, dir);
  const report = scan(dir, meta);
  const blockers = report.findings.filter((f) => f.level === "block");
  const label = `${slug}@${meta?.version ?? "?"}`;
  if (errors.length || blockers.length) {
    failed = true;
    console.error(`✗ ${label}`);
    for (const e of errors) console.error(`    validation: ${e}`);
    for (const b of blockers) console.error(`    security:   ${b.file}${b.line ? `:${b.line}` : ""} — ${b.msg} [${b.rule}]`);
    continue;
  }
  for (const w of report.findings.filter((f) => f.level === "warn")) console.warn(`  ! ${label} ${w.file}:${w.line} — ${w.msg}`);

  const entries = walk(dir)
    .filter((f) => !f.symlink && !f.rel.split("/").some((seg) => SHIP_EXCLUDE.has(seg)))
    .map((f) => ({ name: `${slug}/${f.rel}`, data: fs.readFileSync(f.abs) }));
  entries.push({ name: `${slug}/skill-manifest.json`, data: Buffer.from(JSON.stringify({ slug, version: meta.version, source: SOURCE, name: meta.name, youSay: meta.youSay, needs: meta.needs, byoKey: meta.byoKey ?? null }, null, 2) + "\n") });
  const archive = zip(entries);
  const sha256 = crypto.createHash("sha256").update(archive).digest("hex");
  const zipKey = `skills/${SOURCE}/${slug}/${meta.version}.zip`;
  const zipPath = path.join(OUT, zipKey);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, archive);
  uploads.push([zipKey, zipPath, "application/zip"]);

  const stage = (file) => {
    const key = `previews/${slug}/${meta.version}/${file}`;
    const dst = path.join(OUT, key);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(dir, "previews", file), dst);
    const ct = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp4": "video/mp4", ".avif": "image/avif" }[path.extname(file).toLowerCase()] || "application/octet-stream";
    uploads.push([key, dst, ct]);
    return key;
  };
  // A video preview may carry a poster frame and a small rendition for thumbnails.
  const prev = previews.map((p) => ({
    ...p,
    key: stage(p.file),
    ...(p.poster ? { posterKey: stage(p.poster) } : {}),
    ...(p.thumb ? { thumbKey: stage(p.thumb) } : {}),
  }));

  const changelog = fs.existsSync(path.join(dir, "CHANGELOG.md")) ? fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8") : "";
  catalog.skills.push({
    ...meta,
    source: SOURCE,
    zipKey,
    sha256,
    size: archive.length,
    files: entries.length,
    previews: prev,
    changelog,
    scan: { passed: true, checks: report.checks, warnings: report.findings.filter((f) => f.level === "warn").length, scannedAt: report.scannedAt },
    publishedAt: new Date().toISOString(),
  });
  console.log(`✓ ${label}  ${(archive.length / 1024).toFixed(0)} KB  sha256 ${sha256.slice(0, 12)}…  ${prev.length} previews`);
}

const catKey = `catalog/${SOURCE}.json`;
fs.mkdirSync(path.join(OUT, "catalog"), { recursive: true });
fs.writeFileSync(path.join(OUT, catKey), JSON.stringify(catalog, null, 2));

if (failed) {
  console.error("\nPublishing stopped: fix the errors above.");
  process.exit(1);
}

if (flag("upload") || flag("local")) {
  const local = flag("local");
  const cwd = process.env.SKILLSMART_WEB_DIR ? path.resolve(process.env.SKILLSMART_WEB_DIR) : process.cwd();
  // Versions are immutable: refuse to overwrite a published version with different content.
  const prevCatalogFile = path.join(OUT, ".previous.json");
  try {
    execFileSync("npx", ["--yes", "wrangler", "r2", "object", "get", `${BUCKET}/${catKey}`, "--file", prevCatalogFile, local ? "--local" : "--remote"], { cwd, stdio: "ignore" });
    const before = JSON.parse(fs.readFileSync(prevCatalogFile, "utf8"));
    for (const s of catalog.skills) {
      const old = before.skills.find((o) => o.slug === s.slug && o.version === s.version);
      if (old && old.sha256 !== s.sha256 && !flag("force")) {
        console.error(`✗ ${s.slug}@${s.version} changed but its version did not. Bump "version" in skillsmart.json and add a CHANGELOG entry.`);
        process.exit(1);
      }
      if (old && old.sha256 === s.sha256) s.publishedAt = old.publishedAt; // unchanged
    }
    fs.writeFileSync(path.join(OUT, catKey), JSON.stringify(catalog, null, 2));
  } catch {
    // first publish
  }
  uploads.push([catKey, path.join(OUT, catKey), "application/json"]);
  for (const [key, file, ct] of uploads) {
    execFileSync("npx", ["--yes", "wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", ct, local ? "--local" : "--remote"], { cwd, stdio: ["ignore", "ignore", "inherit"] });
    console.log(`↑ ${key}`);
  }
  // Tell the site to drop its cached catalog (optional).
  if (process.env.SKILLSMART_URL && process.env.SKILLSMART_PUBLISH_TOKEN) {
    const r = await fetch(`${process.env.SKILLSMART_URL}/api/internal/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SKILLSMART_PUBLISH_TOKEN}` } });
    console.log(`revalidate: HTTP ${r.status}`);
  }
}
console.log(`\nCatalog: ${path.join(OUT, catKey)} (${catalog.skills.length} skills)`);
