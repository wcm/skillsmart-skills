# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Parts of the character vanish after keying (shoes, pale clothes, yellow) | key-colour spill: pale/yellow/green areas pick up the green screen | switch to a blue screen: `"key": {"color": "#0047FF", "despill": "blue"}`, update `{KEY}`/colour words in prompts, regenerate the still |
| Feet missing, blurry, or a reflection under the figure | model draws a floor | ask for "both feet clearly drawn and complete, standing on nothing, with empty margin below the feet", "no floor, no reflection", figure ~72% of frame height |
| Clothing hems fade into the background | soft gradient at the edge | `--edit "Fix only the hems: fully solid and opaque to a crisp edge, no fading."` |
| Accessories change between poses (earrings, glasses) | pose edits drift | name the accessory in `poseNote`; fix single poses with `--edit … --target pose-N` |
| Brand logos / garbled text on clothes | model defaults | "unbranded", "no logos", "plain … with no print" in the prompt |
| fal returns 422 content_policy_violation | trademarked character or flagged content | don't evade the filter; propose an original character with the same vibe |
| A clip does strange repeated motion (jumps 3×) | over-specified or negative instructions in `move` | rewrite `move` as one plain sentence of what happens; `--steps clips --clip N` |
| A prop pops in oddly mid-transition | the clip invents the prop between frames | acceptable between titles; or describe the prop "appearing in her hand" in `move` and redo that clip |
| Character tiny on the page | bbox includes props/jumps | the page sizes by the rest pose (`restBbox`) — make sure `--steps frames` (or `measure`) ran with the current generator |
| Waist-up character floats mid-screen | rest bbox not touching frame bottom | the page detects waist framing when the rest figure reaches the frame's bottom edge; make the rest still crop at the waist |
| Edits to JS/JSON don't show | python http.server lets the browser cache modules | hard reload (Cmd/Ctrl+Shift+R); in automation `fetch(url, {cache: 'reload'})` each file, then reload |
| Page blank in an automated/hidden browser tab | hidden tabs pause `requestAnimationFrame` and image decoding | normal for background tabs; verify with JS (layout values, rig renders) or make the tab visible |
| Eye ghost rims / white crescents / cut-off irises | see eyes.md | re-measure on hero.webp; tighten `paint`/`maskPad`; lower `shift` |
| Title far from the character | wrapped title boxes keep full max-width | handled — `fitTitles()` shrink-wraps side titles; if a theme's font loads late it re-fits on load |
