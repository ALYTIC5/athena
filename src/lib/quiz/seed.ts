/**
 * Random seed for selection. `?seed=N` in the URL fixes it so end-to-end tests are repeatable;
 * normally it is the current time.
 */
export function getSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const n = param === null ? NaN : Number(param);
  return Number.isFinite(n) ? n >>> 0 : Date.now() >>> 0;
}
