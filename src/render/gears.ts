// Gears. Each gear's outline (teeth, rim, spokes or holes) is built once per scale in its own
// coordinates; every frame places it at its angle with Path2D.addPath, and each pass (shadow, dark rim,
// lit rim, body, details) is one fill for all gears of one tone.

import { TAU } from "../engine/geometry.js";
import { teethAdvanced, type Clock } from "../engine/rhythm.js";
import type { Gear, Train } from "../world/gears.js";
import type { Metal } from "../world/palette.js";
import type { World } from "../world/world.js";
import { circle, hole, Pen, placed, polygon, ring, worldPath } from "./shapes.js";
import { pixels, seesDisc, type View } from "./view.js";

interface GearShape {
  body: Path2D;
  /** Dark details: axle, hub groove, bolts. */
  detail: Path2D;
  /** A lit ring on the rim. */
  shine: Path2D;
}

/** Gear shapes of one world at one scale, built as gears come into view. */
export type GearShapes = Map<Gear, GearShape>;

/** Radii of a gear's body: hub and inner rim. */
function bodyRadii(g: Gear): { hub: number; rim: number; open: boolean } {
  const hub = Math.max(2.2 * g.module, 0.24 * g.pitch);
  const rim = g.root - Math.max(1.7 * g.module, 0.11 * g.pitch);
  return { hub, rim, open: g.style !== "solid" && rim - hub > 3 * g.module };
}

function gearShape(g: Gear, step: number): GearShape {
  const body = new Pen(step, true);
  const p = Math.PI / g.teeth;
  const at = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  body.move(...at(g.root, -0.64 * p));
  for (let i = 0; i < g.teeth; i++) {
    const a = 2 * p * i;
    body.line(...at(g.pitch, a - 0.47 * p));
    body.line(...at(g.outer, a - 0.27 * p));
    body.line(...at(g.outer, a + 0.27 * p));
    body.line(...at(g.pitch, a + 0.47 * p));
    body.line(...at(g.root, a + 0.64 * p));
    body.arc(0, 0, g.root, a + 0.64 * p, a + 1.36 * p);
  }
  body.close();

  const { hub, rim, open } = bodyRadii(g);
  const s = g.symmetry;
  if (open && g.style === "holes") {
    const rc = (hub + rim) / 2;
    const rr = Math.min((rim - hub) * 0.36, rc * Math.sin(Math.PI / s) * 0.62);
    for (let j = 0; j < s; j++) hole(body, rc * Math.cos((j * TAU) / s), rc * Math.sin((j * TAU) / s), rr);
  } else if (open) {
    // Windows between constant-width spokes, wound anticlockwise so that they cut through.
    const spoke = Math.max(1.4 * g.module, 0.09 * g.pitch);
    const inner = hub + 0.8 * g.module;
    for (let j = 0; j < s; j++) {
      const a0 = (j * TAU) / s, a1 = ((j + 1) * TAU) / s;
      const dOut = Math.asin(Math.min(0.95, spoke / 2 / rim)), dIn = Math.asin(Math.min(0.95, spoke / 2 / inner));
      if (a1 - a0 - 2 * dIn < 0.15) continue;
      body.move(...at(rim, a1 - dOut));
      body.arc(0, 0, rim, a1 - dOut, a0 + dOut);
      body.arc(0, 0, inner, a0 + dIn, a1 - dIn);
      body.close();
    }
  }

  const detail = new Pen(step, true);
  circle(detail, 0, 0, Math.max(1.1, hub * 0.36));
  if (open) {
    ring(detail, 0, 0, hub * 0.9, hub);
    if (hub > 5) {
      const bolt = Math.max(0.55, hub * 0.1);
      for (let j = 0; j < s; j++) circle(detail, ...at(hub * 0.64, ((j + 0.5) * TAU) / s), bolt);
    }
  } else {
    ring(detail, 0, 0, g.pitch * 0.5, g.pitch * 0.5 + Math.max(0.5, g.module * 0.3));
  }
  const shine = new Pen(step, true);
  if (open) ring(shine, 0, 0, rim, rim + Math.max(0.5, g.module * 0.32));
  else ring(shine, 0, 0, g.pitch * 0.62, g.pitch * 0.62 + Math.max(0.4, g.module * 0.22));
  return { body: body.path, detail: detail.path, shine: shine.path };
}

/** A gear's angle at this moment. */
export function gearAngle(g: Gear, train: Train, clock: Clock): number {
  return g.phase + g.turn * (TAU / g.teeth) * teethAdvanced(clock, train.perBeat, train.clicks, train.delay);
}

const passes = () => ({ dark: worldPath(), light: worldPath(), body: worldPath(), detail: worldPath(), shine: worldPath() });

export function drawGears(
  ctx: CanvasRenderingContext2D,
  world: World,
  shapes: GearShapes,
  clock: Clock,
  view: View,
  step: number,
  layer: Train["layer"],
): void {
  const { works, palette } = world;
  const deep = layer === "deep";
  const metals: readonly Metal[] = deep ? [palette.deep] : palette.metals;
  const shadow = worldPath();
  const byTone = metals.map(passes);
  const rim = Math.min(2.2, pixels(view, 0.9, 0.35));
  const drop = deep ? pixels(view, 5, 7) : pixels(view, 2.6, 2.8);
  for (const train of works.trains) {
    if (train.layer !== layer) continue;
    const tone = byTone[deep ? 0 : train.tone]!;
    for (const index of train.gears) {
      const g = works.gears[index]!;
      if (!seesDisc(view, g.x + drop / 2, g.y + drop / 2, g.outer + drop)) continue;
      let shape = shapes.get(g);
      if (!shape) shapes.set(g, (shape = gearShape(g, step)));
      const angle = gearAngle(g, train, clock);
      shadow.addPath(shape.body, placed(g.x + drop * 0.8, g.y + drop, angle));
      tone.dark.addPath(shape.body, placed(g.x + rim, g.y + rim, angle));
      tone.light.addPath(shape.body, placed(g.x - rim, g.y - rim, angle));
      tone.body.addPath(shape.body, placed(g.x, g.y, angle));
      tone.detail.addPath(shape.detail, placed(g.x, g.y, angle));
      tone.shine.addPath(shape.shine, placed(g.x, g.y, angle));
    }
  }
  ctx.fillStyle = palette.shade;
  ctx.globalAlpha = deep ? 0.6 : 1;
  ctx.fill(shadow);
  ctx.globalAlpha = 1;
  byTone.forEach((p, i) => {
    const metal = metals[i]!;
    ctx.fillStyle = metal.dark;
    ctx.fill(p.dark);
    ctx.fillStyle = metal.light;
    ctx.fill(p.light);
    ctx.fillStyle = metal.base;
    ctx.fill(p.body);
    ctx.fillStyle = metal.dark;
    ctx.fill(p.detail);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = metal.shine;
    ctx.fill(p.shine);
    ctx.globalAlpha = 1;
  });
}

/** The hub where a working train meets its vessel: a capped coupling that turns with the driver. */
export function drawCouplings(ctx: CanvasRenderingContext2D, world: World, clock: Clock, view: View, step: number): void {
  const { works, palette } = world;
  const edge = new Pen(step), cap = new Pen(step), nut = new Pen(step), dots = new Pen(step);
  for (const train of works.trains) {
    const j = train.junction;
    if (!j) continue;
    const r = j.width * 0.62 + 1.5;
    if (!seesDisc(view, j.x, j.y, r + 2)) continue;
    const driver = works.gears[train.gears[0]!]!;
    const angle = gearAngle(driver, train, clock);
    circle(edge, j.x, j.y, r + 1.3);
    circle(cap, j.x, j.y, r);
    polygon(nut, j.x, j.y, r * 0.52, 6, angle);
    circle(dots, j.x, j.y, Math.max(0.6, r * 0.18));
    for (let k = 0; k < driver.symmetry; k++) {
      const a = angle + ((k + 0.5) * TAU) / driver.symmetry;
      circle(dots, j.x + r * 0.78 * Math.cos(a), j.y + r * 0.78 * Math.sin(a), Math.max(0.45, r * 0.08));
    }
  }
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(edge.path);
  ctx.fillStyle = palette.vessel.collar;
  ctx.fill(cap.path);
  ctx.fillStyle = palette.metals[0]!.light;
  ctx.fill(nut.path);
  ctx.fillStyle = palette.vessel.edge;
  ctx.fill(dots.path);
}
