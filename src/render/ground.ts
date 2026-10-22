// The ground the machine lies on: a deep radial gradient, dotted construction rings and rays centred
// on the heart, the light the heart throws around itself, and a veil that darkens the far corners.

import { TAU } from "../engine/geometry.js";
import type { Clock } from "../engine/rhythm.js";
import { rgba } from "../world/palette.js";
import type { World } from "../world/world.js";
import { circle, Pen } from "./shapes.js";
import { seesDisc, type View } from "./view.js";

/** Distance between the dots of a construction line, and their radius. */
const DOT_STEP = 15;
const DOT_RADIUS = 1.15;

export function buildGroundArt(world: World, view: View, step: number): Path2D {
  const { heart } = world;
  const pen = new Pen(step);
  const dot = (x: number, y: number) => {
    if (seesDisc(view, x, y, DOT_RADIUS)) circle(pen, x, y, DOT_RADIUS);
  };
  const inner = heart.radius + 34;
  for (let r = inner; r < 1480; r += 92) {
    const count = Math.round((TAU * r) / DOT_STEP);
    for (let k = 0; k < count; k++) dot(heart.cx + r * Math.cos((k * TAU) / count), heart.cy + r * Math.sin((k * TAU) / count));
  }
  const rays = heart.cylinders * 4;
  for (let i = 0; i < rays; i++) {
    const a = heart.axes[0]! + ((i + 0.5) * TAU) / rays;
    for (let r = inner + DOT_STEP; r < 1480; r += DOT_STEP) dot(heart.cx + r * Math.cos(a), heart.cy + r * Math.sin(a));
  }
  return pen.path;
}

function fillView(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.fillRect(view.x0 - 4, view.y0 - 4, view.x1 - view.x0 + 8, view.y1 - view.y0 + 8);
}

export function drawGround(ctx: CanvasRenderingContext2D, world: World, marks: Path2D, clock: Clock, view: View): void {
  const { palette, heart } = world;
  const ground = ctx.createRadialGradient(heart.cx, heart.cy, 0, heart.cx, heart.cy, 1450);
  ground.addColorStop(0, palette.ground[0]);
  ground.addColorStop(0.42, palette.ground[1]);
  ground.addColorStop(1, palette.ground[2]);
  ctx.fillStyle = ground;
  fillView(ctx, view);

  ctx.fillStyle = palette.grid;
  ctx.fill(marks);

  // The heart's light: it swells with each contraction and, slower, with the breath.
  const reach = heart.radius * (1.9 + 0.25 * clock.breath);
  const light = ctx.createRadialGradient(heart.cx, heart.cy, heart.radius * 0.4, heart.cx, heart.cy, reach);
  const strength = 0.1 + 0.05 * clock.breath + 0.12 * clock.contraction;
  light.addColorStop(0, rgba(palette.glow, strength));
  light.addColorStop(0.5, rgba(palette.glow, strength * 0.3));
  light.addColorStop(1, rgba(palette.glow, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = light;
  fillView(ctx, view);
  ctx.globalCompositeOperation = "source-over";
}

/** Darkens the corners, last of all, so that the eye settles on the heart. */
export function drawVeil(ctx: CanvasRenderingContext2D, world: World, view: View): void {
  const { heart } = world;
  const veil = ctx.createRadialGradient(heart.cx, heart.cy, 640, heart.cx, heart.cy, 1500);
  veil.addColorStop(0, "rgba(0, 0, 0, 0)");
  veil.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = veil;
  fillView(ctx, view);
}
