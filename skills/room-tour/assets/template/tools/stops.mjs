// The stop frames of a walk with a measuring grid, for placing hotspots, focus points, the title and its occluder
// (free). A stop shows the first frame of the move that leaves it, or the last frame of the move that reaches it, not the
// generated picture, so measure here.
//
//   node stops.mjs <id>            → out/<id>/stops/<move>-first.jpg, <move>-last.jpg (1600 wide) and out/<id>/stops.jpg
//
// Grid lines every 5 % (labelled every 10 %): a hotspot's `at` is [x, y] in these fractions of the frame.
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { OUT, loadWalk, needFfmpeg, probe } from "./common.mjs";

const id = process.argv[2];
const walk = loadWalk(id);
needFfmpeg();
const dir = join(OUT, id, "stops");
mkdirSync(dir, { recursive: true });
const W = 1600, H = 900;

const grid = () => {
  let s = `<svg width="${W}" height="${H}">`;
  for (let k = 1; k < 20; k++) {
    const x = (W * k) / 20, y = (H * k) / 20, major = k % 2 === 0, o = major ? 0.75 : 0.35;
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#fff" stroke-opacity="${o}" stroke-width="${major ? 1.5 : 1}"/><line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#fff" stroke-opacity="${o}" stroke-width="${major ? 1.5 : 1}"/>`;
    if (major) s += `<text x="${x + 4}" y="22" font-family="Helvetica" font-size="18" font-weight="700" fill="#ff0" stroke="#000" stroke-width="3" paint-order="stroke">.${k / 2}</text><text x="6" y="${y - 6}" font-family="Helvetica" font-size="18" font-weight="700" fill="#ff0" stroke="#000" stroke-width="3" paint-order="stroke">.${k / 2}</text>`;
  }
  return Buffer.from(s + "</svg>");
};
const label = (t) => Buffer.from(`<svg width="${W}" height="60"><rect x="10" y="10" width="${20 + 15 * t.length}" height="40" rx="6" fill="#000" opacity=".75"/><text x="22" y="38" font-family="Helvetica" font-size="24" font-weight="700" fill="#fff">${t}</text></svg>`);

const tiles = [];
for (const [name] of Object.entries(walk.moves ?? {})) {
  const mp4 = join(OUT, id, `${name}.mp4`);
  if (!existsSync(mp4)) { console.error(`no ${mp4} yet (node moves.mjs ${id} --keep ${name}:<take>)`); continue; }
  const { count } = probe(mp4);
  for (const [which, sel] of [["first", "eq(n\\,0)"], ["last", `eq(n\\,${count - 1})`]]) {
    const png = spawnSync("ffmpeg", ["-loglevel", "error", "-i", mp4, "-vf", `select=${sel},scale=${W}:${H}`, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 1 << 27 }).stdout;
    const out = join(dir, `${name}-${which}.jpg`);
    const img = await sharp(png).composite([{ input: grid() }, { input: label(`${name} ${which} frame`), left: 0, top: H - 70 }]).jpeg({ quality: 86 }).toBuffer();
    await sharp(img).toFile(out);
    tiles.push(img);
    console.log(out);
  }
}
if (tiles.length) {
  const tw = 800, th = 450, cols = 2;
  const small = await Promise.all(tiles.map((b) => sharp(b).resize(tw, th).toBuffer()));
  await sharp({ create: { width: cols * tw + 6, height: Math.ceil(small.length / cols) * (th + 6), channels: 3, background: "#fff" } })
    .composite(small.map((b, i) => ({ input: b, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) }))).jpeg({ quality: 82 }).toFile(join(OUT, id, "stops.jpg"));
  console.log(join(OUT, id, "stops.jpg"));
}
