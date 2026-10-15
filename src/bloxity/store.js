import { create } from 'zustand'

/**
 * Raw Bloxity state, kept in zustand rather than only in React context so that
 * non-React code — most importantly the `useFrame` loop in the game — can read it
 * without subscribing to a re-render (`useBloxityStore.getState()`).
 *
 * `BloxityProvider` is the only writer. Everything else reads.
 */
export const DEFAULT_PROPORTIONS = Object.freeze({
  height: 1.0,
  shoulderWidth: 1.0,
  armLength: 1.0,
  legOffsetX: 1.0,
  torsoScaleX: 1.0,
  neckHeight: 1.0,
  headScale: 1.0,
})

/**
 * Portal-synced settings (Legion.SDK.settings). All SDK values are strings;
 * these are the SDK's documented defaults. Applied only when embedded on
 * bloxity.io - standalone, the game's own settings are used as-is.
 */
export const DEFAULT_PORTAL_SETTINGS = Object.freeze({
  master_volume: '80',
  music_volume: '80',
  graphics_quality: 'High',
  camera_sensitivity: '1',
  show_fps: 'false',
})
export const PORTAL_SETTING_KEYS = Object.keys(DEFAULT_PORTAL_SETTINGS)

export const useBloxityStore = create((set) => ({
  /** @type {'idle'|'loading'|'ready'|'error'} */
  status: 'idle',
  /** @type {Error|null} */
  error: null,

  /** Logged-in user, or null when signed out. Set only from `auth.onUserChanged`. */
  user: null,
  /** Guest identity from `auth.getGuest()`; used for the HUD before login. */
  guest: null,

  /** Equipped cosmetic IDs from `avatar.getEquipped()`. */
  equipped: null,
  /** Body proportions from `avatar.getProportions()`. */
  proportions: DEFAULT_PROPORTIONS,

  /** True when running in the bloxity.io iframe (portal settings apply). */
  embedded: false,
  portalSettings: DEFAULT_PORTAL_SETTINGS,

  setStatus: (status, error = null) => set({ status, error }),
  setUser: (user) => set({ user }),
  setGuest: (guest) => set({ guest }),
  setEquipped: (equipped) => set({ equipped }),
  setProportions: (proportions) =>
    set({ proportions: { ...DEFAULT_PROPORTIONS, ...(proportions || {}) } }),
  setEmbedded: (embedded) => set({ embedded }),
  setPortalSetting: (key, value) =>
    set((s) => ({ portalSettings: { ...s.portalSettings, [key]: String(value ?? DEFAULT_PORTAL_SETTINGS[key]) } })),
}))

/**
 * Portal settings as numbers/flags. Standalone (not embedded) everything is
 * neutral so the game's own settings decide.
 */
export function portalMultipliers(state) {
  if (!state.embedded) return { master: 1, music: 1, quality: 'High', cameraSensitivity: 1, showFps: false }
  const s = state.portalSettings
  const pct = (v, d) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : d
  }
  const sens = Number(s.camera_sensitivity)
  return {
    master: pct(s.master_volume, 0.8),
    music: pct(s.music_volume, 0.8),
    quality: ['Low', 'Medium', 'High', 'Ultra'].includes(s.graphics_quality) ? s.graphics_quality : 'High',
    cameraSensitivity: Number.isFinite(sens) ? Math.min(5, Math.max(0.1, sens)) : 1,
    showFps: s.show_fps === 'true',
  }
}

/** Non-reactive snapshot, safe to call inside `useFrame`. */
export const getBloxityState = () => useBloxityStore.getState()
