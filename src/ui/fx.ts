const GLYPHS = "01·:+-*#%&@$";
const FIELD_GLYPHS = "01·:+-*";

/**
 * Resolves `text` into `el` through a brief scramble of cipher glyphs.
 * Safe to call repeatedly; re-runs only when the target text changes.
 */
export function decode(el: HTMLElement, text: string, duration = 600): void {
  if (el.dataset.decoded === text) return;
  el.dataset.decoded = text;
  const start = performance.now();
  const tick = (now: number) => {
    if (el.dataset.decoded !== text) return;
    const t = Math.min(1, (now - start) / duration);
    const settled = Math.floor(text.length * t);
    el.textContent = text.slice(0, settled) + scramble(text.length - settled);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function scramble(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

/**
 * Fills `el` (positioned, overflow hidden, styled via .cipher-field) with a
 * sparse grid of glyphs and slowly mutates a few cells at a time.
 */
export function cipherField(el: HTMLElement, density = 0.16): void {
  let grid: string[][] = [];

  const cell = (): string =>
    Math.random() < density
      ? FIELD_GLYPHS.charAt(Math.floor(Math.random() * FIELD_GLYPHS.length))
      : " ";

  const paint = (): void => {
    el.textContent = grid.map((row) => row.join(" ")).join("\n");
  };

  const build = (): void => {
    const cols = Math.max(8, Math.ceil(el.clientWidth / 14));
    const rows = Math.max(3, Math.ceil(el.clientHeight / 24));
    grid = Array.from({ length: rows }, () => Array.from({ length: cols }, cell));
    paint();
  };

  build();
  new ResizeObserver(build).observe(el);
  setInterval(() => {
    if (grid.length === 0) return;
    for (let i = 0; i < 6; i += 1) {
      const row = grid[Math.floor(Math.random() * grid.length)];
      if (row) row[Math.floor(Math.random() * row.length)] = cell();
    }
    paint();
  }, 180);
}
