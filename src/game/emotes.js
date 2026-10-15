/**
 * Boxity emote clips: { len, loop, tracks }, where tracks maps a bone name to
 * keys [[timeSeconds, xDeg, yDeg, zDeg], ...]. Pure sampling helpers - the rig
 * side lives in avatarRig.applyEmote(). Malformed data is skipped, never thrown.
 */

const smoothstep = (s) => s * s * (3 - 2 * s)

/** [x, y, z] degrees at time `t`, smoothstepped between keys, clamped at the ends. */
export function sampleTrack(keys, t) {
  if (!Array.isArray(keys) || keys.length === 0) return null
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (t <= first[0]) return [first[1], first[2], first[3]]
  if (t >= last[0]) return [last[1], last[2], last[3]]
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const span = b[0] - a[0]
      const s = span > 0 ? smoothstep((t - a[0]) / span) : 1
      return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s]
    }
  }
  return [last[1], last[2], last[3]]
}

/**
 * Samples every track at `elapsed` seconds. Looping clips wrap on time % len;
 * one-shot clips report `done` once they reach the end.
 */
export function sampleClip(clip, elapsed) {
  const len = Number(clip?.len) > 0 ? Number(clip.len) : 1
  const loop = Boolean(clip?.loop)
  const t = loop ? elapsed % len : Math.min(elapsed, len)
  const values = {}
  for (const [bone, keys] of Object.entries(clip?.tracks || {})) {
    const v = sampleTrack(keys, t)
    if (v && v.every(Number.isFinite)) values[bone] = v
  }
  return { t, done: !loop && elapsed >= len, values }
}

/** id -> clip, filled from Legion.SDK.avatar.getEmoteCatalog(). */
const catalogue = new Map()

export function setEmoteCatalogue(emotes) {
  if (!Array.isArray(emotes)) return
  for (const emote of emotes) {
    if (emote?.id && emote.clip?.tracks) catalogue.set(String(emote.id), emote.clip)
  }
}

export const getEmoteClip = (id) => catalogue.get(String(id)) || null
