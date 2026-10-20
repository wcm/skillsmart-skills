/*
 * Starter: MONTAGE. A showreel: one technique per scene, cut on the beat, a new ground at every
 * cut, quicker cuts late (the rhythm burst), and the end card's dot opening into the first frame.
 * For a studio, a product, an event or any idea you want shown many ways at once.
 *
 * Replace every placeholder, the words in double angle quotes (check.mjs fails while one is left). Drop, reorder or repeat scenes
 * as the idea needs (keep the end card last, and the beats in whole bars of 4). The scenes:
 *   title, phyllotaxis, morph (shapes of the idea), lattice → cloud (one continuous shot: the dot
 *   floor becomes your 3D forms), ribbons, words (one a beat), dashboard (real numbers only),
 *   rhythm (six shots on the half beat), orbit (keywords in rings), endcard (its dot is the loop).
 */
Reel.make({
  name: "reel",
  brand: "«BRAND»",
  edition: "«EDITION»",
  bpm: 111,
  slow: 2, // the pace: 1 is very fast, 1.5 relaxed, 2 half speed (beats × slow stay whole bars); a scene can set its own
  palette: "studio",
  energy: 0.8,
  music: { key: "A", mood: "minor" },
  scenes: [
    { type: "title", beats: 4, kicker: "«KICKER --- 2026»", words: ["«WORD»", "«WORD»"], line: "«in Name»" },
    { type: "phyllotaxis", beats: 3, label: "«CHAPTER»", title: "«TITLE»", sub: "«a model line»", readout: "«STATE»" },
    { type: "morph", beats: 3, label: "«SHAPE»", shapes: ["circle", "triangle", "star-12"], names: ["«SHAPE 1»", "«SHAPE 2»", "«SHAPE 3»"], out: { type: "whip", beats: 0.5, dir: [-1, 0] } },
    { type: "lattice", beats: 2, label: "«PATTERN»", top: "«DOMAIN» / LATTICE" },
    { type: "cloud", beats: 3, label: "«FORMS»", forms: ["sphere", "torus", "cube"], names: ["«FORM 1»", "«FORM 2»", "«FORM 3»"], title: "«TITLE» / MORPH" },
    { type: "ribbons", beats: 3, label: "«FLOW»", in: { type: "punch", beats: 0.4 } },
    { type: "words", beats: 4, words: ["«WORD»", "«WORD»", "«WORD»", "«two words»"] },
    { type: "dashboard", beats: 4, label: "«DATA»" },
    { type: "rhythm", beats: 6, per: 1, label: "«RHYTHM»", shots: ["target", "sun", "dots", "orbit", "harmonograph", "vinyl"], hits: [1, 2, 3, 4, 5] },
    { type: "orbit", beats: 3, label: "«KEYWORDS»", words: ["«TEN»", "«TO»", "«FOURTEEN»", "«KEYWORDS»", "«OF»", "«THE»", "«IDEA»", "«IN»", "«CAPITALS»", "«EACH»"] },
    { type: "endcard", beats: 5, wordmark: "«Name»", role: "«ROLE»", tagline: "«TAGLINE.»" },
  ],
});
