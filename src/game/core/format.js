/**
 * Big-number formatting: 999, 1.23K, 45.6M, 789B, 1.5T, then 1aa, 1ab ... 1az,
 * 1ba ... (spec). Values are floored, never rounded up, so the HUD can't claim
 * you have money you don't.
 */

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T']

function suffixFor(tier) {
  if (tier < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[tier]
  const idx = tier - NAMED_SUFFIXES.length
  const first = String.fromCharCode(97 + (Math.floor(idx / 26) % 26))
  const second = String.fromCharCode(97 + (idx % 26))
  return first + second
}

function trimZeros(text) {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

export function formatNumber(value) {
  if (value === Infinity) return '∞'
  if (!Number.isFinite(value)) return '0'
  const sign = value < 0 ? '-' : ''
  const n = Math.abs(value)

  if (n < 1000) {
    // Keep one decimal for small fractional values ("929.5 Money").
    if (Number.isInteger(n)) return sign + n
    return sign + trimZeros((Math.floor(n * 10) / 10).toFixed(1))
  }

  let tier = Math.floor(Math.log10(n) / 3)
  let scaled = n / 10 ** (tier * 3)
  // log10 can land a hair under an exact power of 1000.
  if (scaled >= 1000) {
    tier += 1
    scaled /= 1000
  } else if (scaled < 1) {
    tier -= 1
    scaled *= 1000
  }

  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  const factor = 10 ** digits
  const floored = Math.floor(scaled * factor + 1e-9) / factor
  return sign + trimZeros(floored.toFixed(digits)) + suffixFor(tier)
}

export const formatMoney = (value) => `$${formatNumber(value)}`

/** "x2.5", "x1.2K" */
export const formatMult = (value) => `x${formatNumber(Math.floor(value * 100) / 100)}`

/** 75 -> "1:15", 4000 -> "1h 06m" */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** "+150%" for a 1.5 bonus. */
export const formatPercent = (fraction) => `+${formatNumber(Math.round(fraction * 1000) / 10)}%`
