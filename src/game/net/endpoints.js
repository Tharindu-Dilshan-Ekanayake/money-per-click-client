import { getSDK, safeCall } from '../../bloxity/sdk'

/**
 * Where this build talks to.
 *
 * Boxity Legion serves the frontend at <gameId>.play.bloxity.io (prod) and
 * <gameId>.dev.play.bloxity.io (dev); the matching backend for plain HTTP (the
 * leaderboard API) is <gameId>.host.bloxity.io / <gameId>.dev.host.bloxity.io.
 * Multiplayer sockets never use those hosts - they go through the matchmaker
 * (see multiplayer.js).
 */
export const GAME_ID = import.meta.env.VITE_LEGION_GAME_ID || '1-money-per-click'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ''])

/** Base URL of the game server's HTTP API, or '' when there is none (offline). */
export function apiBase() {
  const host = typeof window === 'undefined' ? '' : window.location.hostname
  if (host.endsWith('.dev.play.bloxity.io')) return `https://${GAME_ID}.dev.host.bloxity.io`
  if (host.endsWith('.play.bloxity.io')) return `https://${GAME_ID}.host.bloxity.io`
  const configured = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (configured) return configured
  // Any other real site (e.g. a custom domain) talks to the prod backend.
  return LOCAL_HOSTS.has(host) ? '' : `https://${GAME_ID}.host.bloxity.io`
}

/** The signed-in player's Boxity token, or null for guests. */
export const authToken = () => safeCall(getSDK()?.auth?.getToken?.bind(getSDK().auth)) || null
