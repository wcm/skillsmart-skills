# Stats

Each stat is one object. The chart comes from the shape of the data (or set `kind`):

| Data | Chart | Example |
| --- | --- | --- |
| `value` | `count`: the number counts up over a gauge | `{ value: 12400, label: "teams planned their week in Orbit" }` |
| `value` ≤ 100 with `suffix: "%"` | `percent`: a ring fills to the value | `{ value: 38, suffix: "%", label: "more deep work per person" }` |
| `values: [before, after]` | `compare`: two bars, the headline is the change ("3.4× less") | `{ values: [4.1, 1.2], labels: ["Before", "With Orbit"], suffix: " h", label: "spent planning each week" }` |
| `values: [3+]` | `series`: columns over time, the last one highlighted | `{ values: [2.1, 2.8, 3.9, 5.2], labels: ["Feb", "Mar", "Apr", "May"], suffix: "k", label: "teams, month by month" }` |
| `items: [[name, value], …]` | `rank`: horizontal bars, biggest first | `{ items: [["Berlin", 340], ["Lisbon", 210]], label: "events by city" }` |
| `items` + `parts: true` | `parts`: one stacked bar and a legend (shares of a whole) | `{ items: [["Planning", 41], ["Focus", 33], ["Sharing", 26]], parts: true, suffix: "%" }` |

Every stat also takes: `label` (required), `source` (put it in), `prefix` (`"$"`), `suffix` (`"%"`, `"k"`,
`" h"`), `headline` (overrides the big number), `dur` (seconds on screen; default 3.6, 4.2 for rank and series).

## The film around them

- `title`: the first card, e.g. "Orbit's 2026 in *five numbers*". `*…*` uses the accent.
- `end`: the last card, e.g. "Here's to *2027.*", with `url` under it.
- `brand`: under the title.
- Length: 2.4 s title + 3.6–4.2 s per stat + 2.6 s end. Five stats ≈ 24 s.

## Themes

| Theme | Looks like | Good for |
| --- | --- | --- |
| `wrapped` | a new saturated colour block for every stat, wiping up from the bottom a beat before the numbers | year in review, community, consumer apps |
| `ledger` | warm paper, black ink, mono figures, one green; a rule draws between stats | investors, finance, B2B, reports |
| `night` | deep navy, a mint-to-violet gradient on the numbers and bars, soft glow | dev tools, AI, infrastructure |
