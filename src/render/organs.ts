// Organs: the iris breathes, opening and closing its blades with the breath and flashing when the pulse
// arrives; the escapement keeps time, its anchor and pendulum rocking once every two beats while the
// escape wheel clicks forward half a tooth on each beat as the pulse arrives.

import { TAU } from "../engine/geometry.js";
import { BEAT_MS, ratchet, wrap, type Clock } from "../engine/rhythm.js";
import type { Organ } from "../world/organs.js";
import { rgba } from "../world/palette.js";
import type { World } from "../world/world.js";
import { heartLit } from "./ground.js";
import { bar, circle, Glow, LEVELS, LIGHT_X, LIGHT_Y, Pen, ring } from "./shapes.js";
import { seesDisc, type View } from "./view.js";

/** Adds a closed polygon, reversed if needed so that it is wound clockwise on screen. */
function polygon(pen: Pen, xs: number[], ys: number[]): void {
  let area = 0;
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    area += xs[i]! * ys[j]! - xs[j]! * ys[i]!;
  }
  const order = area >= 0 ? xs.map((_, i) => i) : xs.map((_, i) => xs.length - 1 - i);
  pen.move(xs[order[0]!]!, ys[order[0]!]!);
  for (let k = 1; k < order.length; k++) pen.line(xs[order[k]!]!, ys[order[k]!]!);
  pen.close();
}

/** Every pass of the organs' drawing, filled in this order. */
class OrganPasses {
  readonly plate: Pen;
  readonly rim: Pen;
  readonly bolts: Pen;
  readonly blades: [Pen, Pen, Pen];
  readonly seams: Pen;
  readonly steel: Pen;
  /** Engine-turned rings on a plate. */
  readonly turned: Pen;
  /** The pendulum, behind the wheel. */
  readonly backSteel: Pen;
  readonly backBrass: Pen;
  readonly backDark: Pen;
  readonly brass: Pen;
  readonly dark: Pen;
  /** Parts in front of the anchor: the pivot cap and jewel settings. */
  readonly front: Pen;
  readonly frontDark: Pen;
  readonly glow: Glow;
  readonly jewels: Glow;

  constructor(step: number) {
    const pen = () => new Pen(step);
    this.plate = pen();
    this.rim = pen();
    this.bolts = pen();
    this.blades = [pen(), pen(), pen()];
    this.seams = pen();
    this.steel = pen();
    this.turned = pen();
    this.backSteel = pen();
    this.backBrass = pen();
    this.backDark = pen();
    this.brass = pen();
    this.dark = pen();
    this.front = pen();
    this.frontDark = pen();
    this.glow = new Glow(step);
    this.jewels = new Glow(step);
  }
}

/** How strongly the pulse that reached the organ last still shows, 1 on arrival. */
const pulseFlash = (o: Organ, clock: Clock) => Math.exp(-(wrap(clock.beats - o.delay, 1) * BEAT_MS) / 240);

function housing(p: OrganPasses, o: Organ, inner: number, bolts: number): void {
  circle(p.plate, o.x, o.y, o.radius);
  ring(p.rim, o.x, o.y, inner, o.radius);
  for (let k = 0; k < bolts; k++) {
    const a = o.angle + ((k + 0.5) * TAU) / bolts;
    circle(p.bolts, o.x + (inner + o.radius) * 0.5 * Math.cos(a), o.y + (inner + o.radius) * 0.5 * Math.sin(a), o.radius * 0.03);
  }
  if (o.inlet) {
    const a = Math.atan2(o.inlet.y - o.y, o.inlet.x - o.x);
    const w = Math.max(3, o.inlet.width);
    bar(p.rim, o.x + o.radius * 0.9 * Math.cos(a), o.y + o.radius * 0.9 * Math.sin(a), o.inlet.x, o.inlet.y, w + 3);
  }
}

/** The iris: blades tiling the ring around an aperture that opens with the breath. */
function iris(p: OrganPasses, o: Organ, clock: Clock): void {
  const inner = o.radius * 0.74;
  housing(p, o, inner, 2 * o.count);
  const breath = 0.5 - 0.5 * Math.cos(TAU * (clock.breathPhase - o.delay / 6));
  const flash = pulseFlash(o, clock);
  const level = Math.round(LEVELS * Math.min(1, 0.25 + 0.45 * breath + 0.5 * flash));
  circle(p.glow.at(level), o.x, o.y, inner);
  circle(p.jewels.at(Math.round(LEVELS * flash)), o.x, o.y, inner * 0.3);

  const n = o.count;
  const a = inner * (0.1 + 0.62 * breath);
  const reach = inner + o.radius * 0.03;
  const out = Math.sqrt(reach * reach - a * a);
  const turn = o.angle + 0.95 * breath;
  const phi = (k: number) => turn + (k * TAU) / n;
  const vertex = (k: number): [number, number] => {
    const m = (phi(k - 1) + phi(k)) / 2, r = a / Math.cos(Math.PI / n);
    return [o.x + r * Math.cos(m), o.y + r * Math.sin(m)];
  };
  // The point where the line of blade k (tangent to the aperture) meets the housing.
  const meet = (k: number): [number, number] => {
    const f = phi(k);
    return [o.x + a * Math.cos(f) - out * Math.sin(f), o.y + a * Math.sin(f) + out * Math.cos(f)];
  };
  for (let k = 0; k < n; k++) {
    const [vx, vy] = vertex(k), [ax, ay] = meet(k), [bx, by] = meet(k - 1);
    const xs = [vx, ax], ys = [vy, ay];
    const a0 = Math.atan2(ay - o.y, ax - o.x);
    let a1 = Math.atan2(by - o.y, bx - o.x);
    while (a1 > a0) a1 -= TAU;
    const steps = Math.max(2, Math.ceil(((a0 - a1) * reach) / 6));
    for (let i = 1; i <= steps; i++) {
      const t = a0 + ((a1 - a0) * i) / steps;
      xs.push(o.x + reach * Math.cos(t));
      ys.push(o.y + reach * Math.sin(t));
    }
    // Blades facing the light are brighter.
    const facing = Math.cos(phi(k)) * LIGHT_X + Math.sin(phi(k)) * LIGHT_Y;
    polygon(p.blades[facing > 0.35 ? 2 : facing < -0.35 ? 0 : 1], xs, ys);
    const [wx, wy] = vertex(k + 1);
    bar(p.seams, wx, wy, ax, ay, Math.max(0.8, o.radius * 0.016));
  }
}

/** The escapement: escape wheel, anchor and pendulum on a turned plate, hanging as gravity wants. */
function escapement(p: OrganPasses, o: Organ, clock: Clock): void {
  const R = o.radius;
  housing(p, o, R * 0.93, 8);
  for (let r = R * 0.14; r < R * 0.9; r += R * 0.036) ring(p.turned, o.x, o.y, r, r + R * 0.009);
  const x = clock.beats - o.delay;
  const swing = 0.16 * Math.sin(Math.PI * x);
  const [px, py] = [o.x, o.y - 0.55 * R];
  const wheelR = 0.3 * R, wx = o.x, wy = o.y - 0.05 * R;
  // Anchor and pendulum are one rigid piece rocking about the pivot.
  const c = Math.cos(swing), s = Math.sin(swing);
  const rocked = (dx: number, dy: number): [number, number] => [px + dx * c - dy * s, py + dx * s + dy * c];

  // The pendulum hangs behind the wheel.
  const [bx, by] = rocked(0, 1.25 * R);
  bar(p.backSteel, px, py, bx, by, R * 0.04);
  circle(p.backBrass, bx, by, R * 0.16);
  circle(p.backDark, bx, by, R * 0.055);

  // Escape wheel: ratchet teeth and four windows; half a tooth per beat, as the pulse arrives.
  const n = o.count;
  const base = (TAU / n) * 0.5 * (Math.floor(x) + ratchet(x - Math.floor(x)));
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = base + (i * TAU) / n;
    for (const [r, t] of [[wheelR * 0.78, t0], [wheelR, t0 + (0.6 * TAU) / n], [wheelR * 0.78, t0 + (0.66 * TAU) / n]] as const) {
      xs.push(wx + r * Math.cos(t));
      ys.push(wy + r * Math.sin(t));
    }
  }
  polygon(p.brass, xs, ys);
  for (let j = 0; j < 4; j++) {
    const t0 = base + (j * TAU) / 4 + 0.22, t1 = base + ((j + 1) * TAU) / 4 - 0.22;
    const hx: number[] = [], hy: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = t0 + ((t1 - t0) * i) / 8;
      hx.push(wx + wheelR * 0.62 * Math.cos(t));
      hy.push(wy + wheelR * 0.62 * Math.sin(t));
    }
    for (let i = 8; i >= 0; i--) {
      const t = t0 + ((t1 - t0) * i) / 8;
      hx.push(wx + wheelR * 0.24 * Math.cos(t));
      hy.push(wy + wheelR * 0.24 * Math.sin(t));
    }
    polygon(p.dark, hx, hy);
  }

  // The anchor's arms reach down to pallets on either side of the wheel's top.
  const reach = 0.5 * R - wheelR * Math.cos(0.66);
  for (const side of [-1, 1]) {
    const [ex, ey] = rocked(side * wheelR * Math.sin(0.66), reach);
    bar(p.steel, px, py, ex, ey, R * 0.065);
    circle(p.steel, ex, ey, R * 0.045);
  }
  circle(p.front, px, py, R * 0.085);
  const flash = pulseFlash(o, clock);
  for (const [jx, jy] of [[px, py], [wx, wy]] as const) {
    circle(p.frontDark, jx, jy, R * 0.045);
    circle(p.jewels.at(Math.round(LEVELS * (0.3 + 0.7 * flash))), jx, jy, R * 0.03);
  }
}

export function drawOrgans(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { palette } = world;
  const p = new OrganPasses(step);
  for (const o of world.organs) {
    if (!seesDisc(view, o.x, o.y, o.radius + 40)) continue;
    if (o.kind === "iris") iris(p, o, clock);
    else escapement(p, o, clock);
  }
  const { body, steel } = palette.heart;
  ctx.fillStyle = palette.ink;
  ctx.fill(p.plate.path);
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = body.shine;
  ctx.fill(p.turned.path);
  ctx.globalAlpha = 1;
  p.glow.fill(ctx, rgba(palette.glow, 1), 0.55);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.rim.path);
  ctx.fillStyle = body.shine;
  ctx.fill(p.bolts.path);
  const tones = [steel.dark, steel.base, steel.light];
  p.blades.forEach((pen, i) => {
    ctx.fillStyle = tones[i]!;
    ctx.fill(pen.path);
  });
  ctx.fillStyle = palette.ink;
  ctx.fill(p.seams.path);
  ctx.fillStyle = steel.base;
  ctx.fill(p.backSteel.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.backBrass.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.backDark.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.brass.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.dark.path);
  ctx.fillStyle = steel.light;
  ctx.fill(p.steel.path);
  ctx.fillStyle = heartLit(ctx, world, body.light, body.base, body.dark);
  ctx.fill(p.front.path);
  ctx.fillStyle = palette.ink;
  ctx.fill(p.frontDark.path);
  p.jewels.fill(ctx, rgba(palette.spark, 1), 0.9);
}
