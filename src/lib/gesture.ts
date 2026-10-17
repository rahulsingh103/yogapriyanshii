/** Gesture maths shared by the sheet drag and the carousel drag (apple-design §2, §5, §6, §9, §10). */

/** px of movement before a press becomes a drag. */
export const DRAG_THRESHOLD = 10;
/** ms of pointer history that make up the release velocity. */
export const VELOCITY_WINDOW = 100;
const RUBBER_BAND = 0.55;
const DECELERATION = 0.998; // scroll-like momentum

export type Sample = { t: number; v: number };

/** Progressive resistance past a boundary: the further past, the less it follows. */
export const rubberBand = (overshoot: number, dimension: number) =>
  (overshoot * dimension * RUBBER_BAND) / (dimension + RUBBER_BAND * Math.abs(overshoot));

/** How far a release at `velocity` (px/s) would travel before coming to rest. */
export const project = (velocity: number) => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);

/** Records a sample and drops the ones older than the window. */
export function recordSample(history: Sample[], t: number, v: number) {
  history.push({ t, v });
  while (history.length > 2 && t - history[0].t > VELOCITY_WINDOW) history.shift();
}

/** px/s over the last VELOCITY_WINDOW ms before `now`; 0 if the pointer had come to rest. */
export function releaseVelocity(history: Sample[], now: number) {
  const last = history[history.length - 1];
  if (!last || now - last.t > VELOCITY_WINDOW) return 0; // held still before letting go
  const i = history.findIndex((s) => last.t - s.t <= VELOCITY_WINDOW);
  const first = history[i === history.length - 1 ? Math.max(i - 1, 0) : i];
  const dt = last.t - first.t;
  return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
}
