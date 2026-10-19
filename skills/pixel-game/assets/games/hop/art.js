/* Pixel Hop · art: every sprite as rows of characters, one character per pixel, turned into a
   canvas and its emissive twin by R.sprite (the characters listed in `glow` also go into the
   glow buffer, so they bloom). Drawn once at load.

   The hero is a little robot with a visor and an antenna; the obstacles are a traffic cone, a
   striped road barrier and a stack of neon crates; the coin spins over four frames. When you
   reskin the game, draw the new cast here first (from reference photos for anything real) and
   check it on the sprite sheet: node tools/sheet.mjs hop. */
(function () {
  'use strict';
  const R = window.R;

  // ---------------- the hero: 16×19, feet on the bottom row, facing right ----------------
  const HERO = {
    k: '#170d2b', // outline
    w: '#eef6ff', // shell
    s: '#9db0d8', // shell in shade
    v: '#25103f', // visor
    e: '#2ef6ff', // eyes (glow)
    x: '#ff2a3d', // eyes when hit (glow)
    p: '#ff3fd2', // antenna light (glow)
    c: '#2ad0ff', // trim (glow)
    f: '#6a5a9a', // legs
    glow: 'expc',
  };
  const HEAD = [
    '..........pp....',
    '..........k.....',
    '...kkkkkkkkkkk..',
    '..kwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwsk',
    '.kwvvvvvvvvvvvsk',
    '.kwvvvvveevveesk',
    '.kwvvvvveevveesk',
    '.kwvvvvvvvvvvvsk',
    '.kswwwwwwwwwwssk',
    '..kkkkkkkkkkkkk.',
    '....kcwwwwck....',
    '...kwwwwwwwwk...',
    '...kcwwwwwwck...',
    '...kswwwwwwsk...',
    '....kkkkkkkk....',
  ];
  const LEGS = {
    a: ['....kf....fk....', '...kff....ffk...', '...kkk....kkk...'], // stride
    b: ['......kffk......', '......kffk......', '......kkkk......'], // passing
    jump: ['.....kffffk.....', '.....kkkkkk.....', '................'], // tucked
  };
  // Each frame also gets a 1 px rim in the glow buffer, so the hero stands out from the city.
  const hero = (legs, hurt) => {
    const sp = R.sprite(HEAD.map((r) => (hurt ? r.replace(/e/g, 'x') : r)).concat(LEGS[legs]), HERO);
    sp.rim = R.outlined(sp.c, hurt ? '#ff3fd2' : '#2ef6ff');
    return sp;
  };
  R.HOP_ART = {
    hero: { run: [hero('a'), hero('b')], jump: hero('jump'), hurt: hero('jump', true) },
  };

  // ---------------- obstacles: w × h as in R.HOP_KINDS, standing on their bottom row ----------------
  const OB = {
    k: '#1a0f2e',
    o: '#ff7a2f', // cone orange
    O: '#c94a1a',
    w: '#fff4e0',
    y: '#ffe14d', // warning light (glow)
    r: '#ff2a3d', // barrier red
    R: '#a3122a',
    g: '#3a2f5c', // legs
    b: '#2b1f4d', // crate
    B: '#3d2d6b',
    c: '#2ef6ff', // crate edges (glow)
    m: '#ff3fd2', // crate mark (glow)
    glow: 'ycm',
  };
  R.HOP_ART.ob = {
    cone: R.sprite([
      '.....y.....',
      '.....o.....',
      '....ooO....',
      '....ooO....',
      '....wwO....',
      '...wwwwO...',
      '...oooOO...',
      '...oooOO...',
      '..wwwwwwO..',
      '..oooooOO..',
      '.ooooooOOO.',
      '.ooooooOOO.',
      'kkkkkkkkkkk',
      'kkkkkkkkkkk',
    ], OB),
    barrier: R.sprite([
      '........yy........',
      '.......kyyk.......',
      'kkkkkkkkkkkkkkkkkk',
      'krrrwwwrrrwwwrrrRk',
      'krrwwwrrrwwwrrrwRk',
      'krwwwrrrwwwrrrwwRk',
      'kwwwrrrwwwrrrwwwRk',
      'kkkkkkkkkkkkkkkkkk',
      '..kgk........kgk..',
      '..kgk........kgk..',
      '..kgk........kgk..',
      '..kgk........kgk..',
      '..kgk........kgk..',
      '..kgk........kgk..',
      '.kkgkk......kkgkk.',
      'kkkkkkk....kkkkkkk',
    ], OB),
    // Three neon crates, 13×30: built from one crate's rows.
    tower: R.sprite(
      ['ccccccccccccc'].concat(
        ...[0, 1, 2].map((i) => [
          'cbbbbbbbbbbBc',
          i === 1 ? 'cbbmbbbbbmbBc' : 'cbBbbbbbbbBBc',
          i === 1 ? 'cbbbmbbbmbbBc' : 'cbbbbmmmbbbBc',
          i === 1 ? 'cbbbbmbmbbbBc' : 'cbbbbbmbbbbBc',
          i === 1 ? 'cbbbbbmbbbbBc' : 'cbbbbbbbbbbBc',
          'cbbbbbbbbbbBc',
          'cbbbbbbbbbbBc',
          'cBBBBBBBBBBBc',
          'ccccccccccccc',
        ]),
        ['kkkkkkkkkkkkk', 'kkkkkkkkkkkkk']
      ),
      OB
    ),
  };

  // ---------------- the coin: 7×7, four frames of a spin ----------------
  const COIN = { k: '#5a3a00', y: '#ffe14d', Y: '#ffb21e', w: '#fffbd0', glow: 'yYw' };
  R.HOP_ART.coin = [
    ['..kkk..', '.kyyyk.', 'kywyyYk', 'kyyyyYk', 'kyyyYYk', '.kYYYk.', '..kkk..'],
    ['..kkk..', '..kyk..', '.kwyYk.', '.kyyYk.', '.kyYYk.', '..kYk..', '..kkk..'],
    ['...k...', '...k...', '..kwk..', '..kyk..', '..kYk..', '...k...', '...k...'],
    ['..kkk..', '..kyk..', '.kyywk.', '.kyyYk.', '.kyYYk.', '..kYk..', '..kkk..'],
  ].map((rows) => R.sprite(rows, COIN));
})();
