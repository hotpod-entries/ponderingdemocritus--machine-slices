// One frame, back to front: ground, deep gears, working gears, vessels, couplings, pulses, tips, heart,
// veil. The canvas state is saved and restored around the frame, and everything is drawn in world
// units under a single viewport transform.

import type { Clock } from "../engine/rhythm.js";
import type { Viewport } from "../engine/validate.js";
import type { World } from "../world/world.js";
import { drawCouplings, drawGears, type GearShapes } from "./gears.js";
import { buildGroundArt, drawGround, drawVeil } from "./ground.js";
import { buildHeartArt, drawHeart, type HeartArt } from "./heart.js";
import { MAX_EDGE_PX } from "./shapes.js";
import { buildVesselArt, drawPulses, drawTips, drawVessels, type VesselArt } from "./vessels.js";
import { viewOf, type View } from "./view.js";

/** The shapes that never move, for one view at one scale. */
interface StillArt {
  key: string;
  marks: Path2D;
  vessels: VesselArt;
}

/** What a world keeps between frames: still art for the last few views, shapes per scale. */
interface Cache {
  stills: StillArt[];
  gears: Map<number, GearShapes>;
  hearts: Map<number, HeartArt>;
}

const caches = new WeakMap<World, Cache>();
const KEEP_STILLS = 3;

function cacheFor(world: World): Cache {
  let cache = caches.get(world);
  if (!cache) caches.set(world, (cache = { stills: [], gears: new Map(), hearts: new Map() }));
  return cache;
}

function stillArt(world: World, cache: Cache, view: View, step: number): StillArt {
  const key = `${step}|${view.x0}|${view.y0}|${view.x1}|${view.y1}`;
  let art = cache.stills.find((a) => a.key === key);
  if (!art) {
    art = { key, marks: buildGroundArt(world, view, step), vessels: buildVesselArt(world, view, step) };
    cache.stills.unshift(art);
    cache.stills.length = Math.min(cache.stills.length, KEEP_STILLS);
  }
  return art;
}

function perScale<T>(map: Map<number, T>, step: number, make: () => T): T {
  let value = map.get(step);
  if (value === undefined) {
    if (map.size >= KEEP_STILLS) map.delete(map.keys().next().value!);
    map.set(step, (value = make()));
  }
  return value;
}

/** Puts every piece of state a frame relies on back to the Canvas 2D defaults. */
function resetState(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.imageSmoothingEnabled = true;
}

export function drawFrame(ctx: CanvasRenderingContext2D, world: World, clock: Clock, viewport: Viewport, width: number, height: number): void {
  const view = viewOf(viewport, width, height);
  const sx = width / viewport.width, sy = height / viewport.height;
  // The longest edge any path may have, in world units (see shapes.ts).
  const step = MAX_EDGE_PX / Math.max(sx, sy);
  const cache = cacheFor(world);
  const still = stillArt(world, cache, view, step);
  const gearShapes = perScale(cache.gears, step, () => new Map());
  const heart = perScale(cache.hearts, step, () => buildHeartArt(world, step));

  ctx.save();
  resetState(ctx);
  // An opaque base under everything, in device pixels, so that no pixel can stay translucent.
  ctx.fillStyle = world.palette.ground[2];
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(sx, 0, 0, sy, -viewport.x * sx, -viewport.y * sy);
  drawGround(ctx, world, still.marks, clock, view);
  drawGears(ctx, world, gearShapes, clock, view, step, "deep");
  drawGears(ctx, world, gearShapes, clock, view, step, "working");
  drawVessels(ctx, world, still.vessels, view);
  drawCouplings(ctx, world, clock, view, step);
  drawPulses(ctx, world, clock, view, step);
  drawTips(ctx, world, clock, view, step);
  drawHeart(ctx, world, heart, clock, view, step);
  drawVeil(ctx, world, view);
  ctx.restore();
}
