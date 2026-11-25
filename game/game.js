'use strict';
/*
 * RAMEN RUSH — Tiny Counter, Big Flavour
 * An original counter-cooking game in one file. Orders arrive as tickets on
 * the board; build each bowl by adding ingredients in the ticket's order,
 * serve it before the customer's patience runs out, and keep the combo alive.
 * Canvas 2D, no assets, no network: every picture is drawn with code.
 */

// ---------------------------------------------------------------- constants
const W = 1280;
const H = 800;
const SHIFT_SECONDS = 120;
const MAX_ORDERS = 3;
const ORDER_EVERY = 6.5;
const PATIENCE = 46;

const INGREDIENTS = [
  { id: 'noodles',  name: 'Noodles',   key: '1', color: '#f2c14e', deep: '#c98f1b' },
  { id: 'broth',    name: 'Broth',     key: '2', color: '#b45a1b', deep: '#7e3c0e' },
  { id: 'egg',      name: 'Egg',       key: '3', color: '#fff3d6', deep: '#f0a832' },
  { id: 'chashu',   name: 'Chashu',    key: '4', color: '#c96f4a', deep: '#8f4526' },
  { id: 'nori',     name: 'Nori',      key: '5', color: '#20392e', deep: '#0f2019' },
  { id: 'scallion', name: 'Scallion',  key: '6', color: '#58b368', deep: '#2f7a3e' },
  { id: 'chili',    name: 'Chili Oil', key: '7', color: '#d93a2b', deep: '#8f1d12' },
  { id: 'corn',     name: 'Corn',      key: '8', color: '#ffd94d', deep: '#d9a41b' },
];
const ING = Object.fromEntries(INGREDIENTS.map((g) => [g.id, g]));

const RECIPES = [
  { name: 'Shoyu Classic',  steps: ['noodles', 'broth', 'egg', 'chashu', 'nori', 'scallion'], price: 42 },
  { name: 'Spicy Miso Fire', steps: ['noodles', 'broth', 'chili', 'chashu', 'corn', 'scallion'], price: 48 },
  { name: 'Garden Tamago',  steps: ['noodles', 'broth', 'egg', 'corn', 'scallion', 'nori'], price: 44 },
  { name: 'Pork Deluxe',    steps: ['noodles', 'broth', 'chashu', 'egg', 'nori', 'chili'], price: 46 },
  { name: 'Midnight Corn',  steps: ['noodles', 'broth', 'corn', 'chili', 'scallion'], price: 36 },
  { name: 'Double Egg Day', steps: ['noodles', 'broth', 'egg', 'egg', 'scallion'], price: 34 },
];

// Seeded RNG so screenshot scenes are the same on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- state
const SCREEN = { TITLE: 0, PLAY: 1, OVER: 2 };
const state = {
  screen: SCREEN.TITLE,
  time: 0,               // seconds since boot, drives idle animation
  shiftLeft: SHIFT_SECONDS,
  coins: 0,
  served: 0,
  bestCombo: 0,
  combo: 0,
  stars: 3,
  orders: [],            // {recipe, patience, maxPatience, face}
  bowl: [],              // ingredient ids, in the order added
  sinceOrder: 0,
  shake: 0,
  flash: 0,              // red splash flash after a wrong ingredient
  banner: '',            // big centre text ("COMBO x4!", "TOO SLOW...")
  bannerT: 0,
  passBowl: null,        // last served bowl resting on the pass {steps, t}
  coinsFx: [],           // flying coin particles {x,y,vx,vy,t}
  steam: [],             // steam puffs {x,y,t,seed}
  message: '',
  rng: mulberry32(20261125),
  frozen: false,         // screenshot mode: no timers advance
};

function resetGame(rng) {
  state.screen = SCREEN.PLAY;
  state.shiftLeft = SHIFT_SECONDS;
  state.coins = 0;
  state.served = 0;
  state.bestCombo = 0;
  state.combo = 0;
  state.stars = 3;
  state.orders = [];
  state.bowl = [];
  state.sinceOrder = ORDER_EVERY - 1; // first ticket arrives quickly
  state.passBowl = null;
  state.banner = '';
  state.message = 'First ticket incoming — build the bowl in ticket order!';
  if (rng) state.rng = rng;
}

function addOrder() {
  if (state.orders.length >= MAX_ORDERS) return;
  const recipe = RECIPES[Math.floor(state.rng() * RECIPES.length)];
  state.orders.push({
    recipe,
    patience: PATIENCE,
    maxPatience: PATIENCE,
    face: Math.floor(state.rng() * 4),
  });
}

function targetOrder() {
  return state.orders.length > 0 ? state.orders[0] : null;
}

function nextNeeded() {
  const order = targetOrder();
  if (!order) return null;
  if (state.bowl.length >= order.recipe.steps.length) return null;
  return order.recipe.steps[state.bowl.length];
}

// ------------------------------------------------------------------ actions
function addIngredient(id) {
  if (state.screen !== SCREEN.PLAY) return;
  const order = targetOrder();
  if (!order) { state.message = 'No ticket yet — hold on a second!'; return; }
  if (state.bowl.length >= order.recipe.steps.length) {
    state.message = 'That bowl is complete — hit SERVE!';
    return;
  }
  const want = order.recipe.steps[state.bowl.length];
  if (id === want) {
    state.bowl.push(id);
    blip(520 + state.bowl.length * 60);
    state.message = state.bowl.length === order.recipe.steps.length
      ? 'Bowl complete! Press SERVE before patience runs out!'
      : `Nice — next: ${ING[order.recipe.steps[state.bowl.length]].name}.`;
  } else {
    state.combo = 0;
    state.flash = 1;
    state.shake = 0.45;
    order.patience = Math.max(1, order.patience - 3);
    blip(140);
    state.message = `Splash! The ticket wants ${ING[want].name} next, not ${ING[id].name}.`;
  }
}

function serve() {
  if (state.screen !== SCREEN.PLAY) return;
  const order = targetOrder();
  if (!order) return;
  const steps = order.recipe.steps;
  const exact = state.bowl.length === steps.length && steps.every((s, i) => state.bowl[i] === s);
  if (!exact) {
    state.message = 'That bowl does not match the ticket yet.';
    return;
  }
  const patienceBonus = Math.round((order.patience / order.maxPatience) * 20);
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const gain = order.recipe.price + patienceBonus + (state.combo - 1) * 5;
  state.coins += gain;
  state.served += 1;
  state.passBowl = { steps: steps.slice(), t: 0 };
  for (let i = 0; i < 10; i += 1) {
    state.coinsFx.push({
      x: 880 + state.rng() * 60, y: 300,
      vx: (state.rng() - 0.5) * 130, vy: -160 - state.rng() * 140,
      t: 0,
    });
  }
  state.banner = state.combo >= 2 ? `COMBO x${state.combo}!` : 'SERVED!';
  state.bannerT = 1.15;
  state.message = `${order.recipe.name} served: +${gain} coins (speed bonus ${patienceBonus}).`;
  state.orders.shift();
  state.bowl = [];
  blip(760); setTimeout(() => blip(980), 70);
}

function trashBowl() {
  if (state.screen !== SCREEN.PLAY) return;
  if (state.bowl.length === 0) return;
  state.bowl = [];
  state.combo = 0;
  state.message = 'Bowl trashed. Combo lost — start the ticket again.';
  blip(220);
}

function expireOrder() {
  const order = state.orders.shift();
  state.stars -= 1;
  state.combo = 0;
  state.banner = 'TOO SLOW!';
  state.bannerT = 1.0;
  state.message = `The ${order.recipe.name} customer left hungry. ${state.stars} star(s) left.`;
  if (state.stars <= 0) {
    state.screen = SCREEN.OVER;
  }
}

// -------------------------------------------------------------------- audio
let audioCtx = null;
function blip(freq) {
  try {
    if (state.frozen) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  } catch (err) { /* audio is a garnish, never a blocker */ }
}

// ------------------------------------------------------------------- update
function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
  if (state.bannerT > 0) state.bannerT = Math.max(0, state.bannerT - dt);
  if (state.passBowl) {
    state.passBowl.t += dt;
    if (state.passBowl.t > 6) state.passBowl = null;
  }
  for (const fx of state.coinsFx) { fx.t += dt; fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 420 * dt; }
  state.coinsFx = state.coinsFx.filter((fx) => fx.t < 0.9);
  if (state.rng() < dt * 1.4) {
    state.steam.push({ x: 596 + state.rng() * 90, y: 356, t: 0, seed: state.rng() * 10 });
  }
  for (const puff of state.steam) puff.t += dt;
  state.steam = state.steam.filter((puff) => puff.t < 2.4);
  if (state.screen !== SCREEN.PLAY || state.frozen) return;

  state.shiftLeft -= dt;
  if (state.shiftLeft <= 0) {
    state.shiftLeft = 0;
    state.screen = SCREEN.OVER;
    return;
  }
  state.sinceOrder += dt;
  if (state.sinceOrder >= ORDER_EVERY) {
    state.sinceOrder = 0;
    addOrder();
  }
  for (const order of state.orders) order.patience -= dt;
  if (state.orders.length > 0 && state.orders[0].patience <= 0) expireOrder();
}

// -------------------------------------------------------------------- input
const STATION_BOXES = []; // filled by render: {id, x, y, w, h}
let serveBox = null;
let trashBox = null;
let startBox = null;

function canvasPoint(evt) {
  const canvas = document.getElementById('game');
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * W,
    y: ((evt.clientY - rect.top) / rect.height) * H,
  };
}

function inside(p, box) {
  return box && p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
}

function onTap(evt) {
  const p = canvasPoint(evt);
  if (state.screen === SCREEN.TITLE) {
    if (inside(p, startBox)) resetGame();
    return;
  }
  if (state.screen === SCREEN.OVER) {
    if (inside(p, startBox)) resetGame();
    return;
  }
  for (const box of STATION_BOXES) {
    if (inside(p, box)) { addIngredient(box.id); return; }
  }
  if (inside(p, serveBox)) serve();
  else if (inside(p, trashBox)) trashBowl();
}

function onKey(evt) {
  if (state.screen !== SCREEN.PLAY) {
    if (evt.key === ' ' || evt.key === 'Enter') { resetGame(); evt.preventDefault(); }
    return;
  }
  const found = INGREDIENTS.find((g) => g.key === evt.key);
  if (found) { addIngredient(found.id); return; }
  if (evt.key === ' ' || evt.key === 'Enter') { serve(); evt.preventDefault(); }
  if (evt.key === 'Backspace' || evt.key === 'Delete') { trashBowl(); evt.preventDefault(); }
}

// ------------------------------------------------------------------ drawing
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(str, x, y, size, color, align = 'left', weight = 700, font = '"Trebuchet MS", Verdana, sans-serif') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawIngredientIcon(id, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  if (id === 'noodles') {
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.32, -r * 0.7);
      ctx.bezierCurveTo(i * r * 0.32 - r * 0.3, -r * 0.2, i * r * 0.32 + r * 0.3, r * 0.2, i * r * 0.32, r * 0.7);
      ctx.stroke();
    }
  } else if (id === 'broth') {
    ctx.fillStyle = '#8a8f98';
    roundRect(-r * 0.95, -r * 0.2, r * 1.9, r * 0.85, r * 0.3); ctx.fill();
    ctx.fillStyle = '#b45a1b';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = r * 0.14;
    ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.35); ctx.lineTo(r * 1.15, -r * 0.95); ctx.stroke();
  } else if (id === 'egg') {
    for (const dx of [-r * 0.42, r * 0.42]) {
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.ellipse(dx, 0, r * 0.52, r * 0.68, dx * 0.02, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a832';
      ctx.beginPath(); ctx.arc(dx, r * 0.05, r * 0.27, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'chashu') {
    ctx.fillStyle = '#c96f4a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8f4526'; ctx.lineWidth = r * 0.13;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const rad = (a / (Math.PI * 5)) * r * 0.62;
      const px = Math.cos(a) * rad; const py = Math.sin(a) * rad;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#e8a37c';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'nori') {
    ctx.fillStyle = '#20392e';
    ctx.save(); ctx.rotate(-0.16); roundRect(-r * 0.62, -r * 0.85, r * 1.24, r * 1.7, r * 0.08); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#2e5240';
    ctx.save(); ctx.rotate(0.22); roundRect(-r * 0.1, -r * 0.8, r * 0.9, r * 1.55, r * 0.08); ctx.fill(); ctx.restore();
  } else if (id === 'scallion') {
    ctx.strokeStyle = '#58b368'; ctx.lineWidth = r * 0.17;
    const spots = [[-0.45, -0.3], [0.1, -0.5], [0.5, -0.15], [-0.15, 0.1], [0.35, 0.4], [-0.5, 0.45], [0.05, 0.62]];
    for (const [sx, sy] of spots) {
      ctx.beginPath(); ctx.arc(sx * r, sy * r, r * 0.21, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (id === 'chili') {
    ctx.fillStyle = '#d93a2b';
    ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r * 0.45, r * 0.5, r * 0.3, r * 0.22, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.5, r * 0.55, r * 0.26, r * 0.19, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = r * 0.13;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.45); ctx.quadraticCurveTo(r * 0.15, -r * 0.8, r * 0.45, -r * 0.85); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.05, r * 0.13, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'corn') {
    ctx.fillStyle = '#ffd94d';
    for (let row = -2; row <= 2; row += 1) {
      for (let col = -2; col <= 2; col += 1) {
        if (Math.abs(row) === 2 && Math.abs(col) === 2) continue;
        ctx.beginPath(); ctx.arc(col * r * 0.34, row * r * 0.34, r * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#d9a41b';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawFace(x, y, r, patienceFrac, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ['#ffd9a0', '#f7c08a', '#e8b088', '#f2c894'][seed % 4];
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#402a18';
  const mood = patienceFrac > 0.5 ? 1 : patienceFrac > 0.25 ? 0 : -1;
  ctx.beginPath(); ctx.arc(-r * 0.34, -r * 0.15, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.34, -r * 0.15, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#402a18'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 1) ctx.arc(0, r * 0.18, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === 0) { ctx.moveTo(-r * 0.3, r * 0.42); ctx.lineTo(r * 0.3, r * 0.42); }
  else ctx.arc(0, r * 0.62, r * 0.38, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,110,90,0.55)';
  ctx.beginPath(); ctx.arc(-r * 0.58, r * 0.22, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.58, r * 0.22, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBowlContents(cx, cy, radius, steps) {
  // broth surface
  if (steps.includes('broth')) {
    ctx.fillStyle = '#a34d14';
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * 0.92, radius * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c97a2e';
    ctx.beginPath(); ctx.ellipse(cx - radius * 0.2, cy - radius * 0.12, radius * 0.55, radius * 0.3, -0.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#5d4a68';
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * 0.92, radius * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (steps.includes('noodles')) {
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i += 1) {
      const ox = (i - 4) * radius * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy - radius * 0.3);
      ctx.bezierCurveTo(cx + ox - 12, cy - radius * 0.05, cx + ox + 12, cy + radius * 0.12, cx + ox, cy + radius * 0.32);
      ctx.stroke();
    }
  }
  // toppings in fixed slots, in the order the recipe adds them
  const slots = {
    egg: [-0.48, -0.16], chashu: [0.42, -0.2], nori: [0.05, -0.52],
    scallion: [-0.1, 0.18], chili: [0.3, 0.28], corn: [-0.45, 0.3],
  };
  for (const id of steps) {
    if (id === 'noodles' || id === 'broth') continue;
    const [sx, sy] = slots[id];
    if (id === 'nori') {
      ctx.fillStyle = '#20392e';
      ctx.save();
      ctx.translate(cx + sx * radius, cy + sy * radius);
      ctx.rotate(-0.2);
      roundRect(-radius * 0.16, -radius * 0.42, radius * 0.32, radius * 0.5, 4); ctx.fill();
      ctx.restore();
    } else {
      drawIngredientIcon(id, cx + sx * radius, cy + sy * radius, radius * 0.3);
    }
  }
  if (steps.includes('chili')) {
    ctx.strokeStyle = 'rgba(217,58,43,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * 0.5, radius * 0.3, 0.3, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawBowl(cx, cy, radius, steps, label) {
  // shadow + body
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + radius * 0.78, radius * 1.05, radius * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#274b73';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 1.08, cy - radius * 0.18);
  ctx.quadraticCurveTo(cx, cy + radius * 1.05, cx + radius * 1.08, cy - radius * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#35648f';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 1.08, cy - radius * 0.18);
  ctx.quadraticCurveTo(cx, cy + radius * 0.5, cx + radius * 1.08, cy - radius * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8ecf2';
  ctx.beginPath(); ctx.ellipse(cx, cy - radius * 0.18, radius * 1.08, radius * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  drawBowlContents(cx, cy - radius * 0.18, radius * 0.95, steps);
  // rim shine
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy - radius * 0.18, radius * 1.02, radius * 0.63, 0, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
  if (label) text(label, cx, cy + radius * 1.28, 19, '#f3e9d2', 'center', 700);
}

function drawSteam(x, y, scale) {
  for (const puff of state.steam) {
    const age = puff.t / 2.4;
    const px = puff.x * scale + Math.sin(puff.seed + puff.t * 1.7) * 12;
    const py = y - puff.t * 46;
    ctx.fillStyle = `rgba(255,255,255,${0.24 * (1 - age)})`;
    ctx.beginPath(); ctx.arc(px, py, 12 + age * 22, 0, Math.PI * 2); ctx.fill();
  }
}

function drawKitchen() {
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#2b1e42');
  wall.addColorStop(0.55, '#33224c');
  wall.addColorStop(1, '#1d1430');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // hanging lanterns
  for (const lx of [210, 640, 1070]) {
    const sway = Math.sin(state.time * 0.9 + lx) * 3;
    ctx.strokeStyle = '#120c1e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + sway, 58); ctx.stroke();
    const glow = ctx.createRadialGradient(lx + sway, 92, 6, lx + sway, 92, 90);
    glow.addColorStop(0, 'rgba(255,166,66,0.5)');
    glow.addColorStop(1, 'rgba(255,166,66,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(lx + sway, 92, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2483d';
    ctx.beginPath(); ctx.ellipse(lx + sway, 92, 34, 27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(lx + sway, 92, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7e2015';
    ctx.fillRect(lx + sway - 12, 60, 24, 7);
    ctx.fillRect(lx + sway - 12, 117, 24, 7);
  }
  // back shelf with jars
  ctx.fillStyle = '#4a3220';
  roundRect(392, 128, 496, 14, 6); ctx.fill();
  const jarColors = ['#d96b27', '#58b368', '#d93a2b', '#f2c14e', '#7fb2d9', '#c96f4a'];
  for (let i = 0; i < 6; i += 1) {
    const jx = 420 + i * 78;
    ctx.fillStyle = 'rgba(230,235,240,0.85)';
    roundRect(jx, 92, 44, 38, 7); ctx.fill();
    ctx.fillStyle = jarColors[i];
    roundRect(jx + 5, 104, 34, 22, 5); ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(jx + 10, 86, 24, 8);
  }
  // noren curtain strip
  ctx.fillStyle = '#274b73';
  ctx.fillRect(24, 108, 300, 10);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i === 1 ? '#35648f' : '#274b73';
    ctx.fillRect(30 + i * 100, 118, 92, 44);
    text('ラーメン', 76 + i * 100, 141, 17, '#e8ecf2', 'center', 700);
  }
  // counter
  const counter = ctx.createLinearGradient(0, 470, 0, 800);
  counter.addColorStop(0, '#8a5a2e');
  counter.addColorStop(0.12, '#75501f');
  counter.addColorStop(1, '#54370f');
  ctx.fillStyle = counter;
  ctx.fillRect(0, 486, W, 314);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(0, 540 + i * 52, W, 3);
  ctx.fillStyle = '#a06a35';
  ctx.fillRect(0, 478, W, 10);
}

function drawHeader() {
  ctx.fillStyle = 'rgba(16,10,26,0.88)';
  roundRect(16, 12, W - 32, 66, 12); ctx.fill();
  ctx.strokeStyle = '#e2483d'; ctx.lineWidth = 2;
  roundRect(16, 12, W - 32, 66, 12); ctx.stroke();
  text('RAMEN RUSH', 40, 46, 34, '#ffb347', 'left', 800);
  text('tiny counter · big flavour', 316, 48, 16, '#f3e9d2', 'left', 400);
  // shift clock
  text('SHIFT', 700, 32, 13, '#cbb98f', 'left', 700);
  ctx.fillStyle = '#3a2a1c';
  roundRect(700, 44, 210, 14, 7); ctx.fill();
  ctx.fillStyle = state.shiftLeft < 20 ? '#d93a2b' : '#58b368';
  const frac = Math.max(0, state.shiftLeft / SHIFT_SECONDS);
  if (frac > 0) { roundRect(700, 44, 210 * frac, 14, 7); ctx.fill(); }
  text(`${Math.ceil(state.shiftLeft)}s`, 922, 51, 17, '#f3e9d2', 'left', 700);
  // coins
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath(); ctx.arc(1012, 45, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9a41b';
  ctx.beginPath(); ctx.arc(1012, 45, 8, 0, Math.PI * 2); ctx.fill();
  text(String(state.coins), 1032, 46, 24, '#ffd94d', 'left', 800);
  // stars
  for (let i = 0; i < 3; i += 1) {
    text('★', 1152 + i * 34, 46, 30, i < state.stars ? '#ffd94d' : 'rgba(255,255,255,0.18)', 'center', 800);
  }
}

function drawTickets() {
  text('ORDER BOARD', 40, 196, 17, '#cbb98f', 'left', 800);
  state.orders.forEach((order, idx) => {
    const x = 24; const y = 214 + idx * 128; const w = 300; const h = 118;
    const isTarget = idx === 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(x + 4, y + 5, w, h, 10); ctx.fill();
    ctx.fillStyle = isTarget ? '#fdf6e0' : '#e9dfc8';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = '#e2483d';
    roundRect(x, y, w, 26, 10); ctx.fill();
    ctx.fillRect(x, y + 16, w, 10);
    text(order.recipe.name.toUpperCase(), x + 12, y + 14, 15, '#ffffff', 'left', 800);
    text(`¥${order.recipe.price}`, x + w - 12, y + 14, 15, '#ffffff', 'right', 800);
    drawFace(x + w - 26, y + 56, 15, order.patience / order.maxPatience, order.face);
    // steps as chips
    order.recipe.steps.forEach((step, i) => {
      const cxp = x + 25 + i * 42;
      const cyp = y + 58;
      const done = isTarget && i < state.bowl.length;
      const isNext = isTarget && i === state.bowl.length;
      ctx.fillStyle = done ? '#58b368' : isNext ? '#ffb347' : '#d8cbae';
      ctx.beginPath(); ctx.arc(cxp, cyp, 17, 0, Math.PI * 2); ctx.fill();
      if (isNext) {
        ctx.strokeStyle = '#e2483d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cxp, cyp, 20 + Math.sin(state.time * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#fdf6e0';
      ctx.beginPath(); ctx.arc(cxp, cyp, 12.5, 0, Math.PI * 2); ctx.fill();
      drawIngredientIcon(step, cxp, cyp, 10.5);
    });
    // patience bar
    const frac = Math.max(0, order.patience / order.maxPatience);
    ctx.fillStyle = '#d8cbae';
    roundRect(x + 12, y + h - 20, w - 24, 9, 5); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#58b368' : frac > 0.25 ? '#f0a832' : '#d93a2b';
    if (frac > 0) { roundRect(x + 12, y + h - 20, (w - 24) * frac, 9, 5); ctx.fill(); }
    if (isTarget) text('BUILDING →', x + w - 12, y + 88, 12, '#8f4526', 'right', 800);
  });
  if (state.orders.length === 0) {
    ctx.fillStyle = 'rgba(253,246,224,0.75)';
    roundRect(24, 214, 300, 80, 10); ctx.fill();
    text('No tickets — next customer', 174, 246, 16, '#5b4a2f', 'center', 700);
    text('is on their way…', 174, 270, 16, '#5b4a2f', 'center', 700);
  }
}

function drawPass() {
  ctx.fillStyle = 'rgba(16,10,26,0.35)';
  roundRect(936, 196, 320, 268, 12); ctx.fill();
  text('THE PASS', 1096, 216, 17, '#cbb98f', 'center', 800);
  if (state.passBowl) {
    drawBowl(1096, 330, 74, state.passBowl.steps, '');
    ctx.fillStyle = '#58b368';
    roundRect(1021, 428, 150, 30, 15); ctx.fill();
    text('READY!', 1096, 444, 18, '#ffffff', 'center', 800);
  } else {
    text('Served bowls land here', 1096, 320, 16, 'rgba(243,233,210,0.6)', 'center', 400);
    text('fresh & steaming', 1096, 344, 16, 'rgba(243,233,210,0.6)', 'center', 400);
  }
  // combo meter, in the gap between the pass shelf and the buttons
  text(`Combo x${state.combo} · Best x${state.bestCombo} · Served ${state.served}`, 1096, 476, 15, '#ffb347', 'center', 800);
}

function drawStations() {
  STATION_BOXES.length = 0;
  const y = 616; const w = 148; const h = 128; const gap = 8; const x0 = 20;
  const needed = nextNeeded();
  INGREDIENTS.forEach((g, i) => {
    const x = x0 + i * (w + gap);
    const isNext = needed === g.id;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(x + 3, y + 4, w, h, 12); ctx.fill();
    ctx.fillStyle = isNext ? '#6e4c20' : '#4c3418';
    roundRect(x, y, w, h, 12); ctx.fill();
    if (isNext) {
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3.5;
      roundRect(x, y + Math.sin(state.time * 5) * 2, w, h, 12); ctx.stroke();
    }
    // little bowl under the icon
    ctx.fillStyle = '#e8ecf2';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 52, 42, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g.color;
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 50, 36, 15, 0, 0, Math.PI * 2); ctx.fill();
    drawIngredientIcon(g.id, x + w / 2, y + 46, 24);
    text(g.name, x + w / 2, y + 92, 16, '#f3e9d2', 'center', 700);
    ctx.fillStyle = '#e2483d';
    ctx.beginPath(); ctx.arc(x + 20, y + 20, 11, 0, Math.PI * 2); ctx.fill();
    text(g.key, x + 20, y + 21, 13, '#ffffff', 'center', 800);
    if (isNext) text('NEXT!', x + w - 30, y + 21, 13, '#ffb347', 'center', 800);
    STATION_BOXES.push({ id: g.id, x, y, w, h });
  });
}

function drawButtons() {
  serveBox = { x: 946, y: 492, w: 150, h: 52 };
  trashBox = { x: 1106, y: 492, w: 150, h: 52 };
  const order = targetOrder();
  const complete = order && state.bowl.length === order.recipe.steps.length;
  ctx.fillStyle = complete ? '#58b368' : '#3f6d46';
  roundRect(serveBox.x, serveBox.y, serveBox.w, serveBox.h, 12); ctx.fill();
  text('SERVE ⏎', 1021, 519, 20, '#ffffff', 'center', 800);
  ctx.fillStyle = '#7a3b2e';
  roundRect(trashBox.x, trashBox.y, trashBox.w, trashBox.h, 12); ctx.fill();
  text('TRASH', 1181, 519, 20, '#ffffff', 'center', 800);
}

function drawPlay() {
  drawKitchen();
  drawHeader();
  drawTickets();
  drawPass();
  // centre bowl on a wooden board
  ctx.fillStyle = '#6e4c20';
  roundRect(430, 470, 430, 26, 10); ctx.fill();
  drawSteam(1, 372, 1);
  drawBowl(645, 388, 104, state.bowl, state.bowl.length ? `${state.bowl.length} ingredient(s) in` : 'empty bowl — pick the first ticket item');
  // message bar
  ctx.fillStyle = 'rgba(16,10,26,0.72)';
  roundRect(348, 556, 560, 40, 10); ctx.fill();
  text(state.message, 628, 577, 16.5, '#f3e9d2', 'center', 400);
  drawButtons();
  drawStations();
  // flying coins
  for (const fx of state.coinsFx) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a41b';
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (state.bannerT > 0) {
    const scale = 1 + (1 - Math.min(1, state.bannerT)) * 0.06;
    ctx.save();
    ctx.translate(645, 250);
    ctx.scale(scale, scale);
    text(state.banner, 0, 0, 54, '#ffb347', 'center', 800);
    ctx.restore();
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(217,58,43,${0.22 * state.flash})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawTitle() {
  drawKitchen();
  drawHeader();
  ctx.fillStyle = 'rgba(13,8,22,0.62)';
  ctx.fillRect(0, 84, W, 716);
  drawBowl(640, 330, 92, ['noodles', 'broth', 'egg', 'chashu', 'nori', 'scallion'], '');
  text('RAMEN RUSH', 640, 128, 74, '#ffb347', 'center', 800);
  text('Tiny Counter · Big Flavour', 640, 178, 26, '#f3e9d2', 'center', 400);
  text('Tickets land on the order board. Build each bowl in ticket order,', 640, 486, 21, '#f3e9d2', 'center', 400);
  text('serve it before patience runs out, and chain combos for bonus coins.', 640, 514, 21, '#f3e9d2', 'center', 400);
  startBox = { x: 490, y: 548, w: 300, h: 62 };
  ctx.fillStyle = '#e2483d';
  roundRect(startBox.x, startBox.y, startBox.w, startBox.h, 14); ctx.fill();
  text('START SHIFT', 640, 580, 26, '#ffffff', 'center', 800);
  text('Click ingredients or press 1–8 · Space serves · Backspace trashes', 640, 648, 17, '#cbb98f', 'center', 400);
  text('A 120-second shift. Three stars. How many bowls can you serve?', 640, 678, 17, '#cbb98f', 'center', 400);
}

function drawOver() {
  drawKitchen();
  drawHeader();
  ctx.fillStyle = 'rgba(13,8,22,0.66)';
  ctx.fillRect(0, 84, W, 716);
  text('SHIFT OVER!', 640, 170, 60, '#ffb347', 'center', 800);
  const rating = state.served >= 12 ? 'LEGENDARY COUNTER HAND' : state.served >= 8 ? 'RAMEN PRO' : state.served >= 4 ? 'STEADY COOK' : 'KEEP PRACTISING, COOK';
  text(rating, 640, 222, 24, '#f3e9d2', 'center', 700);
  drawBowl(640, 360, 80, ['noodles', 'broth', 'chashu', 'egg', 'scallion', 'corn'], '');
  text(`Coins earned   ${state.coins}`, 640, 500, 26, '#ffd94d', 'center', 800);
  text(`Bowls served   ${state.served}      Best combo   x${state.bestCombo}`, 640, 540, 22, '#f3e9d2', 'center', 700);
  startBox = { x: 490, y: 584, w: 300, h: 62 };
  ctx.fillStyle = '#e2483d';
  roundRect(startBox.x, startBox.y, startBox.w, startBox.h, 14); ctx.fill();
  text('NEXT SHIFT', 640, 616, 26, '#ffffff', 'center', 800);
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 10 * state.shake, (Math.random() - 0.5) * 8 * state.shake);
  }
  if (state.screen === SCREEN.TITLE) drawTitle();
  else if (state.screen === SCREEN.OVER) drawOver();
  else drawPlay();
  ctx.restore();
}

// ------------------------------------------------------- screenshot scenes
function stageShot(name) {
  const rng = mulberry32(7);
  state.frozen = true;
  if (name === 'play' || name === 'fever') {
    resetGame(rng);
    state.frozen = true;
    const picks = [RECIPES[0], RECIPES[1], RECIPES[2]];
    state.orders = picks.map((recipe, i) => ({
      recipe,
      patience: PATIENCE * [0.8, 0.55, 0.3][i],
      maxPatience: PATIENCE,
      face: i,
    }));
    state.coins = name === 'fever' ? 720 : 380;
    state.combo = name === 'fever' ? 5 : 3;
    state.bestCombo = state.combo;
    state.served = name === 'fever' ? 9 : 6;
    state.shiftLeft = name === 'fever' ? 58 : 74;
    if (name === 'play') {
      state.bowl = ['noodles', 'broth', 'egg'];
      state.passBowl = { steps: RECIPES[3].steps.slice(), t: 1 };
      state.message = 'Nice — next: Chashu.';
    } else {
      state.bowl = RECIPES[0].steps.slice();
      state.passBowl = { steps: RECIPES[2].steps.slice(), t: 1 };
      state.banner = 'COMBO x5!';
      state.bannerT = 5;
      state.message = 'Shoyu Classic served: +67 coins (speed bonus 20).';
      for (let i = 0; i < 10; i += 1) {
        state.coinsFx.push({ x: 840 + i * 16, y: 300 - (i % 4) * 26, vx: 0, vy: 0, t: 0.2 });
      }
    }
    for (let i = 0; i < 7; i += 1) {
      state.steam.push({ x: 600 + i * 14, y: 356, t: 0.3 + i * 0.27, seed: i * 1.7 });
    }
    state.screen = SCREEN.PLAY;
    return;
  }
  if (name === 'end') {
    resetGame(rng);
    state.coins = 1240;
    state.served = 14;
    state.bestCombo = 7;
    state.stars = 2;
    state.shiftLeft = 0;
    state.screen = SCREEN.OVER;
    state.frozen = true;
    return;
  }
  state.screen = SCREEN.TITLE;
}

// --------------------------------------------------------------------- boot
function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) stageShot(shot);
  canvas.addEventListener('click', onTap);
  window.addEventListener('keydown', onKey);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
