# SkillsMart — free skills

Free visual skills for AI agents (Claude Code, Codex, Cursor and others), published on **[skillsmart.io](https://skillsmart.io)**.

| Skill | Makes |
|---|---|
| [glass-hero](skills/glass-hero) | A hero around an abstract 3D glass object that splits light into rainbows |
| [cloth-hero](skills/cloth-hero) | A hero where a picture becomes real cloth that ripples under the cursor |
| [linework-hero](skills/linework-hero) | Your system drawn as an animated isometric diagram |
| [puff-hero](skills/puff-hero) | A hero whose word is in puffy, overinflated 3D letters that pop when touched |
| [exploded-view](skills/exploded-view) | A scroll page that lifts your product out of a real photo and takes it apart, with a label on every part |
| [wave-shader](skills/wave-shader) | A hero over a live, wavy gradient: silk, an aurora, a sunset sea or a silky ribbon |
| [fluid-shader](skills/fluid-shader) | A hero around a gentle liquid you can touch: dye, chrome, marbled ink or a soap film |
| [glass-shader](skills/glass-shader) | A hero with glass over the page: reeded, fogged, beaded with drops or frosted into tiles |
| [pixel-game](skills/pixel-game) | A retro pixel-art arcade game that reskins an old classic with a news story, made for vertical video |
| [type-poster](skills/type-poster) | Bold typographic event posters (PNG + print PDF) |
| [social-carousel](skills/social-carousel) | Instagram / LinkedIn carousels |
| [og-card-set](skills/og-card-set) | Matching link-preview images for every page |
| [bento-grid](skills/bento-grid) | Bento-box feature sections |
| [brand-board](skills/brand-board) | One-page brand boards with palette, type and voice |
| [device-mockups](skills/device-mockups) | Screenshots in phone, laptop and browser scenes |
| [kinetic-type-teaser](skills/kinetic-type-teaser) | 10–15 s kinetic typography teaser videos |

## Install

The easy way: open the skill on [skillsmart.io](https://skillsmart.io), click **Get skill**, and paste the prompt into your AI agent.

Developers: `skillsmart add <skill>` with the [SkillsMart CLI](https://skillsmart.io/install.sh), or `npx skills add wcm/skillsmart-skills`.

## Repository layout

```
skills/<slug>/
  SKILL.md          the instructions the agent follows
  assets/ scripts/ references/
  previews/         preview images/videos + previews.json (not shipped in the install)
  skillsmart.json   catalog metadata (not shipped in the install)
  CHANGELOG.md
```

Adding or updating a skill: follow [docs/ADDING-SKILLS.md](https://github.com/wcm/skillsmart/blob/main/docs/ADDING-SKILLS.md) in `wcm/skillsmart`.

Publishing: every push to `main` runs `.github/workflows/publish.yml`, which validates, security-scans, packages and uploads changed skills to skillsmart.io. Bump `version` in `skillsmart.json` and add a CHANGELOG entry to release a new version.

Licensed under MIT (see [LICENSE](LICENSE)).
