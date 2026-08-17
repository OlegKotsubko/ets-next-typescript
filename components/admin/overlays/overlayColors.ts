// UI tag swatches for overlay color 1..7 (admin listing only — broadcast
// colors come from the tournament theme). Index 0 === color 1.
export const OVERLAY_COLORS = [
  '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#607d8b',
]

export function overlayColor(n: number): string {
  const i = Math.min(Math.max(Math.trunc(n) - 1, 0), OVERLAY_COLORS.length - 1)
  return OVERLAY_COLORS[i]
}
