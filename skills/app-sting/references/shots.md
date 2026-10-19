# Shots

`shots` is a list of 3–5 objects. The film adds the logo before them and the end card (logo + URL) after them;
the end card eases back into the opening frame, so the MP4 loops without a seam.

| Field | What it does |
| --- | --- |
| `screen` | path to the screenshot. Portrait images go in a phone, landscape ones in a browser (`device: "phone"` or `"browser"` to force it). |
| `label` | 1–2 words in the bottom-left corner while the shot is on screen ("Today", "Plan"). |
| `tap: [x, y]` | a tap at that point (fractions of the screenshot). In a browser an arrow glides in and clicks; on a phone, just the ripple. |
| `toast` | a dark pill that slides up after the tap: what just happened ("Task added to Friday"). Needs `tap`. |
| `number: { value, prefix, suffix, label }` | a sticker in the accent colour that counts up to `value` ("38 %", "more deep work a week"). |

## Order (the classic sting)

1. **Entry**: the screen people see first.
2. **One number**: the screen where the benefit shows, with `number`.
3. **Navigation**: the wider view (a board, a map, a timeline).
4. **Create**: the main action, with `tap` + `toast`.

## Colours

`ground` fills the frame (the brand colour), `ink` is the text on it, `accent` is taps, ripples and the number
sticker (it must stand out against both the ground and the screenshots), `hairline` is the thin frame.

## Timing

Logo 1.3 s, each shot 2.3 s, end card 2.1 s; every pan is 0.64 s centred on the cut. Four shots make 12.6 s.
Render with `--fps 60` for smooth pans; 30 fps works but blurs more.
