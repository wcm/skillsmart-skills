---
name: character-landing
description: Build an animated, scroll-driven landing page starring one character generated from a reference image — a big peeking hero whose eyes follow the cursor, then side-by-side scenes where the character settles into a new pose for each title as you scroll, on a themed animated gradient with fashionable fonts. Uses fal (nano-banana-pro for stills, Kling for pose-to-pose video) and a ready-made static site template. Use this skill whenever someone wants a mascot / character / avatar landing page, an "animated character website", a page where a character reacts to the mouse or poses on scroll, or wants to turn a photo, illustration, drawing or reference image (including a photo of themselves) into an interactive animated site — even if they don't say "landing page".
---

# Character landing page

Turns one reference image into a single-character landing page:

- **Hero:** the character, large, peeking up from the bottom edge. Its eyes follow the pointer, it breathes, leans and blinks. Title centred above.
- **Scroll:** the character zooms out into scene 1 (rest pose), then scenes 2–4 each settle on a distinct pose. The video between poses scrubs with scroll. Titles alternate sides; each scene has its own gradient palette.
- **Theme:** per-character fonts, title styling and background look (`mesh` soft gradient or `poster` flat colour shapes).

The pipeline: reference → **rest still** → **3 pose stills** → **3 Kling clips** pinned start→end on those stills → chroma-keyed WebP frame sequence → eye calibration → preview. Each generation step is reviewed with the user before the next one spends money.

## What you need before starting

| Need | Why | How to check |
|---|---|---|
| A reference image | the character's look and art style | ask the user for a file path |
| `FAL_KEY` | all image/video generation | ask the user; pass it only as an env var on the command (`FAL_KEY=… node …`). Never write it into a file, and don't echo it back. |
| Node 18+, `ffmpeg`, Python 3 | generator, keying, eye finder | `node -v`, `ffmpeg -version`, `python3 -V`; on macOS `brew install node ffmpeg` |
| numpy, pillow, scipy (eyes only) | `eyes.py` | `uv run --with numpy --with pillow --with scipy python3 …` works without installing; or `pip install numpy pillow scipy` |

Rough cost per character: ~5 image generations (~$0.15 each) + 3 five-second Kling clips (≈ $1–3 total, check fal pricing). Tell the user before the first video step.

## Step 0 — Look at the reference and agree on intent

Read the image. Then decide, and confirm anything you're unsure of with the user in one short message (don't interrogate — fill gaps with sensible defaults and state them):

- **Whose image is it?**
  - A photo of a real person → confirm it's the user (or they have consent), and stylise it (Pixar-style 3D, flat illustration, etc. — ask which if not said). Keep the photo out of git.
  - Someone else's artwork (watermark, signature, platform handle) → say so plainly; it's fine for a private demo, but publishing needs the artist's permission or credit. Keep the ref out of git.
  - A trademarked character (Minions, Pikachu, …) → image models often refuse these, and the page would be a knock-off. Offer an original character with the same energy instead. Don't reword prompts to slip past a content filter.
- **Style:** "keep exactly this style" (lock to the reference) vs "inspired by". If the user says the output style is wrong, they almost always mean: lock harder to the reference — pass it as a ref and say "exactly the same art style as the reference image".
- **Framing:** `full` body (good for mascots, plush, Pixar figures) or `waist`-up (good for portraits, illustrated characters, anything face-led). The page adapts automatically.
- **Name:** use the name the user gives. If they don't give one, invent a short, memorable name that fits what's in the reference (a ginger cat → "Miso", a robot → "Bolt") and mention it so they can change it. The id is the name lowercased with dashes.
- **Copy tone, palette, fonts, gradient:** if the user gave instructions, follow them. If not, choose — see `references/themes.md` for how to pick a fashionable font pairing and gradient for the character, and write copy that suits this character's personality.

## Step 1 — Scaffold the project

```bash
python3 <skill>/scripts/new_project.py <dest-dir> <id> <reference-image> --name "<Name>"
cd <dest-dir>/tools && npm install
```

`<id>` is lowercase-dashed (e.g. `juno`). This copies the site + tools template, puts the reference at `ref/`, and writes a `.gitignore`.

## Step 2 — Write `site/characters/<id>/character.json`

This one file drives both the page and the generator. Read `references/character-json.md` for every field and how to write good prompts. `assets/examples/pip.character.json` is one complete, working file — use it only to see the structure. Everything in the new file is written fresh for this character, from its reference image and the user's instructions: name, prompts, poses, titles, palettes, key colour, theme. Copying an example's prompts or titles produces a page about the wrong character. Key decisions:

- `generate.key.color` — the chroma-key screen colour. Default green `#00B140`. Use blue `#0047FF` with `"despill": "blue"` when the character has green, yellow, cream/white or olive elements (green spills onto pale colours and keys them away).
- `generate.imagePrompt` — the rest pose, facing camera, arms relaxed, on a perfectly flat key-colour background. This frame is the hero and the eye-tracking frame, so the face must be clear.
- `generate.poses` — exactly 3, each `{name, pose, move}`. Poses should be dynamic and turned ¾ (not front-on, not a full turn), may use props, and must match the scene titles. `move` is a short, plain description of the motion into the pose — over-specifying ("no jumping, no hopping") makes video models do exactly that.
- `scenes` — 5 entries: hero + 4 side scenes (scene 1 = rest, 2–4 = the poses, in order). Each has `title` (short, punchy; `<em>` marks the accent word), `sub`, 4 `colors` and an `ink` colour with good contrast on them.
- `theme` — fonts + gradient (see `references/themes.md`).
- `eyes` — leave `[]` for now; filled in Step 6.

## Step 3 — Rest still → review

```bash
FAL_KEY=… node generate.mjs <id> --steps image
```

Show `tools/out/<id>/clean.png` to the user. Check for: likeness/style, complete feet (full framing), nothing in the key colour, solid edges (no fading into the background), no text/logos. Small fixes don't need a full regeneration:

```bash
FAL_KEY=… node generate.mjs <id> --edit "Fix only the trouser hems: solid and opaque to a crisp edge."
```

Iterate until the user approves. Everything downstream inherits this image.

## Step 4 — Pose stills → review

```bash
FAL_KEY=… node generate.mjs <id> --steps poses
```

Show `tools/out/<id>/poses-sheet.png` (rest + 3 poses). Check identity/outfit/accessories stay consistent (earrings and props love to drift — fix with `--edit … --target pose-2`), and that nothing is cropped. Rewrite and regenerate poses the user dislikes.

## Step 5 — Clips → frames → review

```bash
FAL_KEY=… node generate.mjs <id> --steps clips          # ~5 min; three clips in parallel
FAL_KEY=… node generate.mjs <id> --steps clips --clip 2 # redo just one clip
node generate.mjs <id> --steps frames                   # re-cut frames only, free
```

Show `tools/out/<id>/seq-sheet.png` (keyed frames on a contrasting backdrop). Check the keying is clean (no halo, no holes) and transitions make sense. If a clip moves strangely, simplify its `move` text and redo that clip only.

## Step 6 — Eyes

Read `references/eyes.md`. In short: find the eyes on `site/characters/<id>/seq/0001.webp` (or the sharper `hero.webp`, same framing), write them into `"eyes"`, and verify by rendering the rig at extreme look directions in the browser. Bead/dot eyes and irises inside eye-whites work well. If the eyes are drawn so that thick lashes overlap the iris and touch the pupil, the effect can't be done cleanly — leave `"eyes": []` (the character still breathes and leans) and tell the user why.

## Step 7 — Preview and hand over

```bash
cd <dest-dir> && python3 -m http.server 5174 -d site     # open http://localhost:5174/?c=<id>
```

Check the hero (eyes follow, title centred above), scroll through every scene, and a phone-width viewport. The static server caches JS — hard reload (Cmd/Ctrl+Shift+R) after edits. Then tell the user what was built, what each pose/title is, anything you couldn't make work, and where to tweak copy (`character.json`) or pacing (`SCREENS_PER_SCENE` at the top of `site/js/main.js`).

`references/troubleshooting.md` covers the failure modes seen so far (key-colour spill, blurry/missing feet, faded hems, content-filter refusals, stale cache, hidden-tab rendering, eye artifacts).

## Adding more characters to the same page

Run Step 2–6 again with a new id inside the same project and add the id to `site/characters/index.json`. With two or more ids, a character switcher appears at the top automatically.
