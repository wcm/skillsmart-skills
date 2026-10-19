/* Flappy Roadster · games: four ways to play, each built on a moment from the unveil and each with
   its own name and logo (drawn in ui.js). What differs between them on screen (names, title lines,
   hints, stats, stamps, punchlines, share-card copy, medals and the production-ETA rule) lives
   here, so ui and main stay generic. */
(function () {
  'use strict';
  const R = window.R;
  const fx = R.fx;
  const pick = (a) => a[Math.floor(fx() * a.length)];
  const medalBy = (v, at) => {
    // at: thresholds for SPORT, LUDICROUS, PLAID, STARMAN.
    for (let i = 3; i >= 0; i--) if (v >= at[i]) return R.MEDALS[3 - i];
    return null;
  };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'}`;
  const NAMES = { model3: 'MODEL 3', modely: 'MODEL Y', cybercab: 'CYBERCAB', cybertruck: 'CYBERTRUCK', semi: 'SEMI', police: 'POLICE CAR' };
  const RED = '#ff2a3d';

  const FLY = {
    id: 'fly',
    tab: 'FLY',
    name: 'FLAPPY ROADSTER',
    logo: 'flappy',
    replay: true,
    line1: 'WE WERE PROMISED FLYING CARS.',
    line2: 'NOW THERE IS A DEMO.',
    tapTo: 'TAP TO FLY',
    hint: 'TAP = THRUST',
    place: (w) => R.ZONES[w.zone].name,
    scoreLabel: 'SCORE',
    level: (b) => b,
    unlockText: (u) => `REACH ${u} TO UNLOCK`,
    medal: (run) => R.medalFor(run.score),
    eta: (run) => (run.score >= 30 ? -1 : 1),
    stamp: (run, w, e) => ({ text: e.kind === 'ground' ? (w.zone === 2 ? 'BURNED UP' : 'PARKED') : 'RECALLED' }),
    msg(run, w, e) {
      const pool = [
        '0-60 IN 0.81 S. 60-0 IN 0.01 S.',
        'FULL SELF-FLYING (SUPERVISED). YOU WERE THE SUPERVISOR.',
        'EXCITEMENT: GUARANTEED. SUCCESS: NOT GUARANTEED.',
        'REPAIR ESTIMATE: $250,000. SAME AS THE RESERVATION.',
        "THAT'S NOT HOW COLD-GAS THRUSTERS WORK.",
        'PANEL GAPS: NOW STRUCTURAL.',
        'YOUR INSURANCE PREMIUM JUST REACHED ORBIT.',
        'WELL, IT WAS UNFORGETTABLE.',
        'HAVE YOU TRIED AN OVER-THE-AIR UPDATE?',
        'THE PIPES WERE NOT IN THE RENDER.',
        'LUDICROUS DECISION.',
        'NOT APPROVED FOR PUBLIC SKIES.',
        'FLYING CARS ARRIVED BEFORE GTA 6. LANDING DID NOT.',
        'RETINA STATUS: STILL ATTACHED. ROADSTER: NOT.',
      ];
      if (R.SKINS[run.skin].id !== 'cyber') pool.push('THE CYBERTRUCK WOULD HAVE SURVIVED THAT.');
      const special = [];
      if (run.score === 0) special.push('NOT EVEN TWO WEEKS.', '0 PIPES. 9 YEARS OF HYPE.', 'THE DEMO WAS SHORTER THAN THE DELAY.');
      else if (run.score <= 2) special.push('THE DEMO WAS SHORTER THAN THE DELAY.', 'TONY HAWK WOULD NOT BE PROUD.');
      if (e.kind === 'ground') special.push("IT'S STILL TECHNICALLY A CAR.", 'ROADS? TURNS OUT WE NEED ROADS.');
      if (w.zone === 2) special.push('STARMAN SAYS HI.', 'RE-ENTRY NOT INCLUDED IN THE SPACEX PACKAGE.');
      if (w.zone === 3) special.push('FIRST CRASH ON MARS. HISTORIC.', 'POPULATION OF MARS: STILL 0.');
      if (w.zone === 1) special.push('SKY ANXIETY: CONFIRMED.');
      if (R.SKINS[run.skin].id === 'cyber') special.push('ARMOR GLASS: TESTED.', 'AERODYNAMICS OF A BRICK. CONFIRMED.');
      if (run.bestBefore > 3 && run.score >= run.bestBefore - 2 && run.score <= run.bestBefore) special.push('SO CLOSE. LIKE THE 2020 DELIVERY DATE.');
      if (run.newBest && run.score > 3) special.push('NEW RECORD. STILL SHIPS IN 2028.');
      return pick(special.length && fx() < 0.7 ? special : pool);
    },
    stats: (run) => [R.MODES[run.mode].name, R.ZONES[run.zoneMax % 4].name + (run.zoneMax >= 4 ? ' L' + (Math.floor(run.zoneMax / 4) + 1) : ''), plural(run.near, 'CLOSE CALL')],
    card: (run) => ({ lead: 'I FLEW THE NEW ROADSTER THROUGH', big: String(run.score), label: run.score === 1 ? 'NEON PIPE' : 'NEON PIPES', line: `${R.MODES[run.mode].name} MODE · REACHED ${R.ZONES[run.zoneMax % 4].name}` }),
    caption: (run, eta) => `I flew the new Tesla Roadster through ${run.score} neon pipes in Flappy Roadster. Production ETA is now ${eta}. #FlappyRoadster #TeslaRoadster #FlyingCar`,
  };

  const KICKFLIP = {
    id: 'kickflip',
    tab: 'KICKFLIP',
    name: 'KICKFLIP ROADSTER',
    logo: 'kickflip',
    replay: true,
    road: true,
    line1: 'DO A KICKFLIP!',
    line2: 'OVER RUSH-HOUR TRAFFIC.',
    tapTo: 'TAP TO DRIVE',
    hint: 'TAP JUMP · TAP AGAIN KICKFLIP · HOLD HIGHER',
    place: () => 'GIGA CITY RUSH HOUR',
    scoreLabel: 'SCORE',
    level: (b) => b * 0.6,
    unlockText: (u) => `SCORE ${Math.ceil(u / 0.6)} TO UNLOCK`,
    medal: (run) => medalBy(run.score, [10, 25, 40, 60]),
    eta: (run) => (run.score >= 40 ? -1 : 1),
    stamp: (run, w, e) => ({ text: e.kind === 'bail' ? 'BAILED' : e.kind === 'rearend' ? 'REAR-ENDED' : 'TOTALED' }),
    msg(run, w, e) {
      const pool = [
        "DO A KICKFLIP! (THAT WASN'T A KICKFLIP.)",
        'TRAFFIC: 1. ROADSTER: 0.',
        'THE THRUSTERS WORKED. THE DRIVER DID NOT.',
        'COLD-GAS THRUSTERS. HOT-HEADED DRIVING.',
        'YOUR INSURANCE PREMIUM JUST DID A KICKFLIP.',
        'FLYING CARS BEFORE GTA 6. PARKING SKILLS NOT INCLUDED.',
        'THE STUNT TOOK 4 SECONDS. THE PAPERWORK WILL TAKE 4 YEARS.',
      ];
      const v = e.victim;
      const special = [];
      if (e.kind === 'bail') special.push('BAILED MID-FLIP. TONY HAWK WINCED.', 'LAND ON THE WHEELS. THE WHEELS.', 'HALF A KICKFLIP IS ZERO KICKFLIPS.', 'THE CAR WAS STILL FLIPPING. YOU WERE NOT.');
      if (e.kind === 'rearend') {
        if (v === 'cybertruck') special.push('YOU HIT A CYBERTRUCK. THE CYBERTRUCK IS FINE.');
        if (v === 'cybercab') special.push('NOBODY WAS DRIVING THE CYBERCAB. NOBODY WAS DRIVING YOURS EITHER.');
        if (v === 'semi') special.push('THE SEMI DID NOT NOTICE.');
        if (v === 'modely') special.push('REAR-ENDED THE BEST-SELLING CAR ON EARTH.');
        if (v === 'model3') special.push('REAR-ENDED A MODEL 3. AWKWARD AT THE SERVICE CENTER.');
        if (v === 'police') special.push('LICENSE, REGISTRATION AND FLIGHT PLAN, PLEASE.');
      }
      if (e.kind === 'crash' && v) special.push(`MISSED THE ${NAMES[v]} ROOF BY THAT MUCH.`, `CAME DOWN ON A ${NAMES[v]}. NOT ITS ROOF.`);
      if (run.score === 0) special.push('THE KICKFLIP WAS THE EASY PART.');
      if (run.tricks >= 5) special.push('TONY HAWK WOULD BE PROUD. YOUR INSURER WOULD NOT.');
      if (run.roofs >= 3) special.push('ROOF RIDER. CARPOOLING, TECHNICALLY.');
      return pick(special.length && fx() < 0.8 ? special : pool);
    },
    stats: (run) => [R.MODES[run.mode].name, plural(run.cars, 'CAR'), plural(run.tricks, 'FLIP'), plural(run.roofs, 'ROOF')],
    card: (run) => ({ lead: 'I JUMPED THE NEW ROADSTER OVER', big: String(run.cars), label: run.cars === 1 ? 'CAR' : 'CARS', line: `${run.tricks} KICKFLIP${run.tricks === 1 ? '' : 'S'} · ${run.roofs} ROOF RIDE${run.roofs === 1 ? '' : 'S'} · ${R.MODES[run.mode].name}` }),
    caption: (run, eta) => `I kickflipped the new Tesla Roadster over ${run.cars} cars in Kickflip Roadster (${run.tricks} kickflips). Production ETA is now ${eta}. #KickflipRoadster #TeslaRoadster #Kickflip`,
  };

  const TUNNEL = {
    id: 'tunnel',
    tab: 'TUNNEL',
    name: 'UPSIDE-DOWN ROADSTER',
    logo: 'upside',
    replay: true,
    road: true,
    line1: 'IT HUNG UPSIDE DOWN ON THE RAMP.',
    line2: 'SO WE BUILT A WHOLE TUNNEL.',
    tapTo: 'TAP TO DRIVE',
    hint: 'TAP = FLIP TO THE OTHER SIDE',
    place: () => 'NEON TUNNEL',
    unit: 'M',
    scoreLabel: 'METERS',
    level: (b) => b / 20,
    unlockText: (u) => `DRIVE ${u * 20} M TO UNLOCK`,
    medal: (run) => medalBy(run.score, [150, 300, 500, 800]),
    eta: (run) => (run.score >= 500 ? -1 : 1),
    stamp: (run, w, e) => ({ text: e.kind === 'suction' ? 'SUCKED UP' : e.kind === 'wall' ? 'RECALLED' : 'FELL IN' }),
    msg(run, w, e) {
      const pool = [
        'SUCTION FANS: 10/10. STEERING: 2/10.',
        'MIND THE GAP. YOU DID NOT MIND THE GAP.',
        'THE LIGHT AT THE END OF THE TUNNEL WAS A LAMP.',
        'CEILING DRIVING IS STILL DRIVING.',
        'GRAVITY CALLED. IT WANTS ITS CAR BACK.',
        'ONE LANE. TWO SIDES. ZERO SURVIVORS.',
      ];
      const special = [];
      const what = e.victim;
      if (e.kind === 'wall') {
        if (what === 'cone') special.push('DEFEATED BY ONE TRAFFIC CONE.');
        if (what === 'barrier') special.push('THE BARRIER WAS IN THE RENDER.');
        if (what === 'lamp') special.push('HIT A LAMP. THE LEDS WERE RIGHT THERE.');
        if (what === 'duct') special.push('AIR DUCT: 1. SUCTION FANS: 0.');
      }
      if (e.kind === 'pit') special.push('FOUND THE ONE POTHOLE IN THE TUNNEL.', 'MIND THE GAP.');
      if (e.kind === 'lip') special.push('NOSED INTO THE EDGE. PANEL GAPS ARE NOT GAP JUMPS.');
      if (e.kind === 'suction') special.push('THE SUCTION FANS WORKED. A LITTLE TOO WELL.', 'SUCKED UP INTO THE VENTS.');
      if (run.ceilT > 10) special.push(`UPSIDE DOWN FOR ${run.ceilT.toFixed(1)} S. AS DESIGNED.`);
      if (run.score < 30) special.push('SHORTER THAN THE RAMP.');
      return pick(special.length && fx() < 0.8 ? special : pool);
    },
    stats: (run) => [R.MODES[run.mode].name, plural(run.flips, 'FLIP'), `UPSIDE DOWN ${run.ceilT.toFixed(1)} S`],
    card: (run) => ({ lead: 'I DROVE THE NEW ROADSTER', big: String(run.score), label: 'METERS OF NEON TUNNEL', line: `UPSIDE DOWN FOR ${run.ceilT.toFixed(1)} S · ${run.flips} FLIPS` }),
    caption: (run, eta) => `I drove the new Tesla Roadster ${run.score} m through a neon tunnel in Upside-Down Roadster, ${run.ceilT.toFixed(1)} s of it upside down on the ceiling. Production ETA is now ${eta}. #UpsideDownRoadster #TeslaRoadster`,
  };

  const s3 = (v) => v.toFixed(3);
  const LAUNCH = {
    id: 'launch',
    tab: '0-60',
    name: 'GREEN LIGHT ROADSTER',
    logo: 'green',
    replay: false,
    road: true,
    lowerBetter: true,
    line1: 'TESLA SAYS 0-60 IN 0.81 S.',
    line2: 'YOUR REFLEXES ARE THE SLOW PART.',
    tapTo: 'TAP TO STAGE',
    hint: 'TAP THE MOMENT IT TURNS GREEN',
    place: () => 'DRAG STRIP',
    level: () => 0,
    unlockText: (u) => `REACH ${u} IN FLY TO UNLOCK`,
    fmtBest: (v) => (v ? s3(v / 1000) + ' S' : '-'),
    medal(run) {
      const r = run.result;
      if (!r || r.foul) return null;
      return r.rt < 0.14 ? R.MEDALS[0] : r.rt < 0.18 ? R.MEDALS[1] : r.rt < 0.22 ? R.MEDALS[2] : r.rt < 0.27 ? R.MEDALS[3] : null;
    },
    eta(run) {
      const r = run.result;
      if (r.foul || r.rt > 0.5) return 1;
      return r.total < R.LAUNCH_T.car ? -1 : 0;
    },
    stamp(run) {
      const r = run.result;
      if (r.foul) return { text: r.kind === 'phantom' ? 'PHANTOM START' : 'FALSE START' };
      if (r.asleep) return { text: 'ASLEEP AT THE WHEEL', col: r.rating.col };
      return { text: r.robot ? 'ROBOT REFLEXES' : r.rating.name, col: r.rating.col };
    },
    msg(run) {
      const r = run.result;
      if (r.foul && r.kind === 'phantom') return pick(['FSF SAW A GREEN LIGHT. THERE WAS NO GREEN LIGHT.', 'PHANTOM BRAKING HAS A COUSIN NOW.']);
      if (r.foul) return pick(['EARLY. FOR ONCE.', 'THE FIRST ROADSTER THING EVER TO BE EARLY.', `RED LIGHT, ${s3(-r.rt)} S EARLY. A ROADSTER FIRST.`]);
      if (r.robot) return 'BEEP BOOP. FULL SELF-LAUNCHING (SUPERVISED).';
      if (r.asleep) return 'THE CAR LEFT WITHOUT YOU. THAT COUNTS AS AUTONOMY.';
      const n = r.rating.name;
      if (n === 'ARE YOU A ROBOT?') return 'FASTER THAN HUMANLY POSSIBLE. SUSPICIOUS.';
      if (n === 'FASTER THAN THE ROADSTER') return 'YOU BEAT 0.81 S. TESLA HAS BEEN NOTIFIED.';
      if (n === 'PLAID REFLEXES') return 'THE CAR DID ITS PART IN 0.67 S. YOU NEARLY DID YOURS.';
      if (n === 'STILL WAITING FOR 2020') return 'GREEN MEANS GO. LIKE 2020 MEANT 2020.';
      if (n === 'SUNDAY DRIVER') return 'THE LIGHT WAS GREEN. IT IS STILL GREEN.';
      return pick([`THE ROADSTER WAITED ${s3(r.rt)} S FOR YOU.`, `THE ROADSTER WAITED ${s3(r.rt)} S FOR YOU. IT WAS POLITE ABOUT IT.`, 'YOUR REFLEXES ARE ON A 2028 TIMELINE.']);
    },
    card(run) {
      const r = run.result;
      if (r.foul) return { lead: 'MY 0-60 IN THE NEW ROADSTER', big: s3(r.rt), label: 'SECONDS: RED LIGHT', line: 'JUMPED THE GREEN. EARLY, FOR ONCE.' };
      return { lead: 'MY 0-60 IN THE NEW ROADSTER', big: s3(r.total), label: 'SECONDS', line: `REACTION ${s3(r.rt)} S · TESLA SAYS 0.810` };
    },
    caption(run, eta) {
      const r = run.result;
      if (r.foul) return `I jumped the light by ${s3(-r.rt)} s in Green Light Roadster. Early, for once. Production ETA ${eta}. #GreenLightRoadster #TeslaRoadster #0to60`;
      return `My 0-60 in the new Tesla Roadster: ${s3(r.total)} s, off a ${s3(r.rt)} s reaction in Green Light Roadster. Tesla says 0.81. Beat me. #GreenLightRoadster #TeslaRoadster #0to60`;
    },
  };

  R.GAMES = [FLY, KICKFLIP, TUNNEL, LAUNCH];
  // The flying game keeps its original save keys; the others are per game and mode.
  for (const gm of R.GAMES) {
    gm.key = (m) => (gm.id === 'fly' ? R.MODES[m].id : `${gm.id}:${R.MODES[m].id}`);
    gm.fmt = gm.fmtBest || ((v) => String(v | 0) + (gm.unit ? ' ' + gm.unit : ''));
  }
  R.GAMES[0].World = R.World;
  R.GAMES[1].World = R.KickflipWorld;
  R.GAMES[2].World = R.TunnelWorld;
  R.GAMES[3].World = R.LaunchWorld;
})();
