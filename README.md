# SkillsMart — free skills

Free visual skills for AI agents (Claude Code, Codex, Cursor and others), published on **[skillsmart.io](https://skillsmart.io)**.

| Skill | Makes |
|---|---|
| [shader-hero](skills/shader-hero) | A landing page with a dramatic, interactive shader hero |
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
