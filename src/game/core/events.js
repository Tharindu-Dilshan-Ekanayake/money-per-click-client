/**
 * Fire-and-forget event bus for presentation: sounds, particles, floating
 * text, camera shake. Game logic emits; the presentation layer listens. Keeps
 * side effects out of the zustand store and lets effects skip React renders.
 *
 * Events (payloads):
 *   click      { x, y, amount, combo }      screen-space click position
 *   step       { amount }
 *   afk        { amount }
 *   levelUp    { from, to, titleChanged, title }
 *   gateOpen   { index }
 *   gateDenied { index, missing }
 *   win        { index, wins }
 *   buy        { kind, key }
 *   deny       { reason }
 *   rebirth    { rebirths }
 *   hatch      { results }
 *   reward     { kind }
 *   boost      { seconds }
 *   teleport   { position }
 *   luckyBag   { amount }
 *   jump       {}
 *   shake      { strength }
 */
const listeners = new Map()

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
  return () => listeners.get(type)?.delete(fn)
}

export function emit(type, payload = {}) {
  const set = listeners.get(type)
  if (!set) return
  for (const fn of set) {
    try {
      fn(payload)
    } catch (err) {
      console.warn(`[fx] listener for "${type}" failed`, err)
    }
  }
}

export const fx = { on, emit }
export default fx
