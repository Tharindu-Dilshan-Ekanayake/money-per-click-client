import { COLORS } from './materials'

/**
 * How each Better Cash tier looks (index = tier in config CASH_TIERS): from a
 * single green bill to glowing diamond stacks. Used on the pedestals and for
 * the cash in the player's hand.
 */
export const CASH_LOOKS = [
  { color: COLORS.cash, band: '#facc15', layers: 1, height: 0.12 },
  { color: COLORS.cash, band: '#facc15', layers: 2, height: 0.12 },
  { color: COLORS.cash, band: '#facc15', layers: 3, height: 0.12 },
  { color: '#16a34a', band: '#fde047', layers: 4, height: 0.12 },
  { color: '#15803d', band: '#fde047', layers: 5, height: 0.12 },
  { color: '#0ea5e9', band: '#f8fafc', layers: 5, height: 0.13 },
  { color: '#2563eb', band: '#f8fafc', layers: 6, height: 0.13 },
  { color: '#9333ea', band: '#fde047', layers: 6, height: 0.13 },
  { color: '#7e22ce', band: '#fde047', layers: 7, height: 0.13, emissive: '#3b0764' },
  { color: '#facc15', band: '#f97316', layers: 7, height: 0.13, emissive: '#a16207' },
  { color: '#eab308', band: '#ef4444', layers: 8, height: 0.13, emissive: '#a16207' },
  { color: '#e11d48', band: '#fde047', layers: 8, height: 0.13, emissive: '#881337' },
  { color: '#10b981', band: '#f0fdf4', layers: 8, height: 0.14, emissive: '#047857' },
  { color: '#67e8f9', band: '#e0f2fe', layers: 9, height: 0.14, emissive: '#0891b2' },
  { color: '#f472b6', band: '#fef9c3', layers: 10, height: 0.14, emissive: '#be185d' },
]

export const cashLook = (index) => CASH_LOOKS[Math.min(Math.max(0, Math.floor(index)), CASH_LOOKS.length - 1)]
