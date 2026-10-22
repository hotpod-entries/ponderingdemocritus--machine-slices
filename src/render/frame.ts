// One frame, back to front: ground, the heart's light, deep gears, working gears, vessels, couplings,
// organs, pulses, tips, heart. Everything is drawn in world units under one viewport transform,
// and the canvas state is saved and restored around the frame.
//
// What never moves is kept between frames: the ground and the vessels as bitmap layers of the canvas's
// size (copied in at whole pixels, so they are exactly what drawing them would give), the heart's
// casting and the gears' shapes and sprites per scale.

import type { Clock } from "../engine/rhythm.js";
import type { Viewport } from "../engine/validate.js";
import type { World } from "../world/world.js";
import { drawCouplings, drawGears, newGearCache, type GearCache, type MakeCanvas } from "./gears.js";
import { buildGroundArt, drawGround, drawHeartLight, drawVeil } from "./ground.js";
import { buildHeartArt, drawHeart, type HeartArt } from "./heart.js";
import { drawOrgans } from "./organs.js";
import { MAX_EDGE_PX } from "./shapes.js";
import { buildVesselArt, drawPulses, drawTips, drawVessels } from "./vessels.js";
import { viewOf, type View } from "./view.js";

/** The still layers for one viewport on one canvas size. */
interface Layers {
  key: string;
  ground: HTMLCanvasElement;
  vessels: HTMLCanvasElement;
}

/** What a world keeps between frames. */
interface Cache {
  layers: Layers[];
  gears: Map<number, GearCache>;
  hearts: Map<number, HeartArt>;
}

const caches = new WeakMap<World, Cache>();
/** How many viewports and scales a world remembers. */
const KEEP = 3;

function cacheFor(world: World): Cache {
  let cache = caches.get(world);
  if (!cache) caches.set(world, (cache = { layers: [], gears: new Map(), hearts: new Map() }));
  return cache;
}

function perScale<T>(map: Map<number, T>, key: number, make: () => T): T {
  let value = map.get(key);
  if (value === undefined) {
    if (map.size >= KEEP) map.delete(map.keys().next().value!);
    map.set(key, (value = make()));
  }
  return value;
}

/** Sets a context to the Canvas 2D defaults a frame relies on, under transform (sx, sy, dx, dy). */
function begin(ctx: CanvasRenderingContext2D, sx: number, sy: number, dx: number, dy: number): void {
  ctx.setTransform(sx, 0, 0, sy, dx, dy);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.imageSmoothingEnabled = true;
}

interface Frame {
  world: World;
  viewport: Viewport;
  width: number;
  height: number;
  sx: number;
  sy: number;
  view: View;
  step: number;
  make: MakeCanvas;
}

/** The ground (opaque) and the vessels (on transparency), rendered once for this viewport and size. */
function layersFor(f: Frame, cache: Cache): Layers {
  const key = `${f.width}x${f.height}|${f.viewport.x},${f.viewport.y},${f.viewport.width},${f.viewport.height}`;
  let layers = cache.layers.find((l) => l.key === key);
  if (layers) return layers;
  const layer = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = f.make(f.width, f.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    begin(ctx, f.sx, f.sy, -f.viewport.x * f.sx, -f.viewport.y * f.sy);
    paint(ctx);
    return canvas;
  };
  layers = {
    key,
    ground: layer((ctx) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = f.world.palette.ground[2];
      ctx.fillRect(0, 0, f.width, f.height);
      ctx.restore();
      drawGround(ctx, f.world, buildGroundArt(f.world, f.view, f.step), f.view);
      drawVeil(ctx, f.world, f.view);
    }),
    vessels: layer((ctx) => {
      drawVessels(ctx, f.world, buildVesselArt(f.world, f.view, f.step), f.view);
      drawVeil(ctx, f.world, f.view, "source-atop");
    }),
  };
  cache.layers.unshift(layers);
  cache.layers.length = Math.min(cache.layers.length, KEEP);
  return layers;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  clock: Clock,
  viewport: Viewport,
  width: number,
  height: number,
  make: MakeCanvas,
): void {
  const sx = width / viewport.width, sy = height / viewport.height;
  const scale = Math.max(sx, sy);
  // The longest edge any path may have, in world units (see shapes.ts).
  const step = MAX_EDGE_PX / scale;
  const f: Frame = { world, viewport, width, height, sx, sy, view: viewOf(viewport, width, height), step, make };
  const cache = cacheFor(world);
  const layers = layersFor(f, cache);
  const gears = perScale(cache.gears, step, newGearCache);
  const heart = perScale(cache.hearts, step, () => buildHeartArt(world, step));
  const { view } = f;

  ctx.save();
  begin(ctx, 1, 1, 0, 0);
  ctx.drawImage(layers.ground, 0, 0);
  ctx.setTransform(sx, 0, 0, sy, -viewport.x * sx, -viewport.y * sy);
  drawHeartLight(ctx, world, clock, view);
  drawGears(ctx, world, gears, clock, view, step, scale, make, "deep");
  drawGears(ctx, world, gears, clock, view, step, scale, make, "working");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layers.vessels, 0, 0);
  ctx.restore();
  drawCouplings(ctx, world, clock, view, step);
  drawOrgans(ctx, world, clock, view, step);
  drawPulses(ctx, world, clock, view, step);
  drawTips(ctx, world, clock, view, step);
  drawHeart(ctx, world, heart, clock, view, step);
  ctx.restore();
}
