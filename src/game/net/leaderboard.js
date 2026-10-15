import { create } from 'zustand'

import { apiBase, authToken } from './endpoints'

/**
 * Client for the leaderboard API in money-per-click-server. On Boxity hosting it
 * finds the backend from the page's host; locally set VITE_API_URL (e.g.
 * http://localhost:2567). With no backend the boards show only your own stats.
 * Failures are silent (console.debug only) - nothing is ever shown on screen.
 */
const API_URL = apiBase()

export const leaderboardEnabled = Boolean(API_URL)

export const useLeaderboard = create(() => ({
  /** 'off' | 'loading' | 'ok' | 'error' */
  status: leaderboardEnabled ? 'loading' : 'off',
  boards: { money: [], level: [], rebirths: [], wins: [] },
  updatedAt: 0,
}))

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const token = authToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function submitScore(entry) {
  // In production the server ranks verified Boxity players only (guests get a
  // quiet 401); a local server accepts everyone for testing.
  if (!leaderboardEnabled) return
  try {
    await request('/api/leaderboard', { method: 'POST', body: JSON.stringify(entry) })
  } catch (err) {
    console.debug('[leaderboard] submit failed', err)
  }
}

export async function refreshLeaderboard() {
  if (!leaderboardEnabled) return
  try {
    const boards = await request('/api/leaderboard?limit=10')
    useLeaderboard.setState({ status: 'ok', boards: { ...useLeaderboard.getState().boards, ...boards }, updatedAt: Date.now() })
  } catch (err) {
    console.debug('[leaderboard] refresh failed', err)
    useLeaderboard.setState({ status: 'error' })
  }
}
