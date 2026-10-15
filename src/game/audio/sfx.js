/**
 * Procedural audio: every sound effect and the background music are synthesized
 * with the Web Audio API, so the game ships zero audio files and nothing can
 * 404. Browsers only allow audio after a user gesture - call `unlock()` from a
 * pointer/key handler (AudioDirector does this).
 */

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12)

class AudioEngine {
  constructor() {
    this.ctx = null
    this.musicVolume = 0.45
    this.sfxVolume = 0.8
    this.musicWanted = true
    this.musicTimer = null
    this.step = 0
    this.nextNoteTime = 0
    this.lastStepTick = 0
  }

  get ready() {
    return Boolean(this.ctx) && this.ctx.state === 'running'
  }

  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      const ctx = this.ctx

      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -14
      compressor.knee.value = 12
      compressor.ratio.value = 4
      compressor.connect(ctx.destination)

      this.master = ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(compressor)

      this.sfxBus = ctx.createGain()
      this.sfxBus.connect(this.master)
      this.musicBus = ctx.createGain()
      this.musicBus.connect(this.master)
      this.applyVolumes()

      // One second of white noise, reused by every noisy sound.
      const length = ctx.sampleRate
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const channel = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) channel[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    if (this.musicWanted) this.startMusic()
  }

  setVolumes(music, sfx) {
    this.musicVolume = music
    this.sfxVolume = sfx
    this.applyVolumes()
    if (music <= 0.001) this.stopMusic()
    else if (this.musicWanted && this.ctx) this.startMusic()
  }

  applyVolumes() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.05)
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.55, t, 0.05)
  }

  /** Pause everything while the tab is hidden; resume cleanly after. */
  setHidden(hidden) {
    if (!this.ctx) return
    if (hidden) {
      this.ctx.suspend().catch(() => {})
    } else {
      this.ctx.resume().catch(() => {})
      this.nextNoteTime = this.ctx.currentTime + 0.1
    }
  }

  /* ------------------------------------------------------------ primitives */

  tone({
    freq,
    to = null,
    type = 'sine',
    dur = 0.1,
    vol = 0.2,
    attack = 0.004,
    delay = 0,
    filter = null,
    bus = null,
  }) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(vol, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    let node = osc
    if (filter) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = filter
      osc.connect(f)
      node = f
    }
    node.connect(gain)
    gain.connect(bus || this.sfxBus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  noise({ dur = 0.1, vol = 0.1, type = 'highpass', freq = 2000, to = null, q = 1, delay = 0, bus = null }) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const f = ctx.createBiquadFilter()
    f.type = type
    f.Q.value = q
    f.frequency.setValueAtTime(freq, t)
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(vol, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(gain)
    gain.connect(bus || this.sfxBus)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  arp(notes, { type = 'square', gap = 0.07, dur = 0.12, vol = 0.07, filter = 3200, delay = 0 } = {}) {
    notes.forEach((freq, i) => this.tone({ freq, type, dur, vol, filter, delay: delay + i * gap }))
  }

  /* ---------------------------------------------------------------- sounds */

  play(name, opts = {}) {
    if (!this.ready || this.sfxVolume <= 0.001) return
    switch (name) {
      case 'click': {
        const p = 1 + Math.min(opts.combo || 0, 30) * 0.022
        this.tone({ freq: 640 * p, to: 980 * p, type: 'triangle', dur: 0.07, vol: 0.16 })
        this.tone({ freq: 1320 * p, type: 'sine', dur: 0.06, vol: 0.05, delay: 0.012 })
        if (opts.combo && opts.combo % 10 === 0) {
          this.arp([1568, 2093], { type: 'triangle', vol: 0.06, gap: 0.05, dur: 0.12 })
        }
        break
      }
      case 'crit':
        this.tone({ freq: 1568, to: 2637, type: 'square', dur: 0.12, vol: 0.06, filter: 4200 })
        this.arp([2093, 2637, 3136], { type: 'triangle', gap: 0.04, dur: 0.1, vol: 0.06, delay: 0.05 })
        this.noise({ dur: 0.18, vol: 0.06, type: 'highpass', freq: 6000 })
        break
      case 'coin':
        this.tone({ freq: 1976, type: 'square', dur: 0.05, vol: 0.035, filter: 5000 })
        this.tone({ freq: 2637, type: 'triangle', dur: 0.12, vol: 0.05, delay: 0.045 })
        break
      case 'winTick': {
        // Each trophy landing in the Wins counter rings a little higher.
        const f = 880 * Math.pow(2, Math.min(opts.index || 0, 14) / 12)
        this.tone({ freq: f, type: 'triangle', dur: 0.09, vol: 0.07 })
        this.tone({ freq: f * 1.5, type: 'sine', dur: 0.12, vol: 0.04, delay: 0.03 })
        break
      }
      case 'step': {
        // Footstep-ish coin tick; alternate pitch like left/right feet.
        this.lastStepTick = 1 - this.lastStepTick
        const f = this.lastStepTick ? 1700 : 1500
        this.tone({ freq: f, to: f * 1.15, type: 'sine', dur: 0.035, vol: 0.03 })
        break
      }
      case 'afk':
        this.tone({ freq: 1046, type: 'triangle', dur: 0.06, vol: 0.045 })
        this.tone({ freq: 1568, type: 'triangle', dur: 0.12, vol: 0.045, delay: 0.055 })
        break
      case 'levelUp':
        this.arp([523, 659, 784, 1047, 1319], { gap: 0.065, dur: 0.1, vol: 0.08, filter: 3500 })
        ;[523, 784, 1047].forEach((freq) =>
          this.tone({ freq, type: 'triangle', dur: 0.6, vol: 0.05, delay: 0.33 }),
        )
        this.noise({ dur: 0.5, vol: 0.04, type: 'highpass', freq: 6000, delay: 0.33 })
        break
      case 'title':
        this.arp([392, 523, 659, 784, 1047, 1319, 1568], { gap: 0.06, dur: 0.14, vol: 0.08, delay: 0.7 })
        break
      case 'rebirth':
        this.noise({ dur: 0.9, vol: 0.14, type: 'bandpass', freq: 300, to: 5000, q: 2 })
        this.tone({ freq: 80, to: 38, type: 'sine', dur: 0.7, vol: 0.45, delay: 0.75 })
        ;[262, 330, 392, 523, 659].forEach((freq) =>
          this.tone({ freq, type: 'sawtooth', dur: 1.4, vol: 0.035, filter: 1800, delay: 0.75, attack: 0.02 }),
        )
        this.arp([1047, 1319, 1568, 2093], { type: 'triangle', gap: 0.06, vol: 0.06, delay: 0.9 })
        break
      case 'buy':
        this.noise({ dur: 0.04, vol: 0.12, type: 'highpass', freq: 3000 })
        this.tone({ freq: 1760, type: 'triangle', dur: 0.25, vol: 0.1, delay: 0.03 })
        this.tone({ freq: 2637, type: 'triangle', dur: 0.4, vol: 0.08, delay: 0.09 })
        break
      case 'equip':
        this.tone({ freq: 500, to: 820, type: 'sine', dur: 0.09, vol: 0.14 })
        break
      case 'deny':
        this.tone({ freq: 190, to: 130, type: 'square', dur: 0.16, vol: 0.06, filter: 1200 })
        this.tone({ freq: 150, to: 95, type: 'square', dur: 0.2, vol: 0.06, filter: 1200, delay: 0.12 })
        break
      case 'gateOpen':
        this.tone({ freq: 300, to: 1200, type: 'sine', dur: 0.35, vol: 0.12 })
        this.tone({ freq: 1319, type: 'triangle', dur: 0.3, vol: 0.09, delay: 0.25 })
        this.tone({ freq: 1760, type: 'triangle', dur: 0.45, vol: 0.08, delay: 0.33 })
        this.noise({ dur: 0.35, vol: 0.05, type: 'highpass', freq: 5000, delay: 0.25 })
        break
      case 'gateDenied':
        this.tone({ freq: 120, to: 55, type: 'sine', dur: 0.18, vol: 0.32 })
        this.play('deny')
        break
      case 'win':
        ;[
          [523, 0, 0.1],
          [659, 0.1, 0.1],
          [784, 0.2, 0.1],
          [1047, 0.32, 0.5],
        ].forEach(([freq, delay, dur]) =>
          this.tone({ freq, type: 'square', dur, vol: 0.08, filter: 3000, delay }),
        )
        this.tone({ freq: 131, type: 'triangle', dur: 0.7, vol: 0.14, delay: 0.32 })
        this.noise({ dur: 0.6, vol: 0.06, type: 'highpass', freq: 7000, delay: 0.32 })
        break
      case 'teleport':
        this.noise({ dur: 0.45, vol: 0.07, type: 'bandpass', freq: 4000, to: 400, q: 3 })
        this.tone({ freq: 1200, to: 300, type: 'sine', dur: 0.4, vol: 0.05 })
        break
      case 'hatchShake':
        this.tone({ freq: 720, to: 360, type: 'sine', dur: 0.07, vol: 0.16 })
        break
      case 'hatchCrack':
        this.noise({ dur: 0.14, vol: 0.22, type: 'bandpass', freq: 2500, q: 1.5 })
        this.tone({ freq: 300, to: 120, type: 'triangle', dur: 0.12, vol: 0.12 })
        break
      case 'hatchReveal': {
        const rank = opts.rank || 0
        const scale = [523, 659, 784, 1047, 1319, 1568, 2093, 2637]
        this.arp(scale.slice(0, 3 + rank), { gap: 0.06, dur: 0.14, vol: 0.075 })
        ;[523, 659, 784].forEach((freq) =>
          this.tone({ freq: freq * (rank >= 3 ? 2 : 1), type: 'triangle', dur: 0.8, vol: 0.045, delay: 0.06 * (3 + rank) }),
        )
        if (rank >= 3) this.noise({ dur: 1, vol: 0.05, type: 'highpass', freq: 7000, delay: 0.2 })
        break
      }
      case 'reward':
        this.arp([1047, 1319, 1568, 2093], { type: 'triangle', gap: 0.05, dur: 0.14, vol: 0.07 })
        break
      case 'stepDone':
        this.tone({ freq: 880, type: 'triangle', dur: 0.12, vol: 0.09 })
        this.tone({ freq: 1320, type: 'triangle', dur: 0.22, vol: 0.09, delay: 0.1 })
        break
      case 'ui':
        this.tone({ freq: 900, type: 'sine', dur: 0.035, vol: 0.06 })
        break
      case 'open':
        this.tone({ freq: 420, to: 760, type: 'sine', dur: 0.09, vol: 0.08 })
        break
      case 'close':
        this.tone({ freq: 760, to: 420, type: 'sine', dur: 0.09, vol: 0.07 })
        break
      case 'jump':
        this.tone({ freq: 260, to: 540, type: 'sine', dur: 0.12, vol: 0.05 })
        break
      case 'luckyBag':
        this.arp([1319, 1760, 2093, 2637], { type: 'square', gap: 0.05, dur: 0.1, vol: 0.06, filter: 4000 })
        this.noise({ dur: 0.3, vol: 0.06, type: 'highpass', freq: 5000 })
        break
      case 'boost':
        this.tone({ freq: 200, to: 1600, type: 'sawtooth', dur: 0.5, vol: 0.05, filter: 2400 })
        this.arp([1047, 1568, 2093], { type: 'triangle', gap: 0.07, vol: 0.06, delay: 0.4 })
        break
      case 'toast':
        this.tone({ freq: 988, type: 'sine', dur: 0.06, vol: 0.05 })
        break
      default:
        break
    }
  }

  /* ----------------------------------------------------------------- music */

  startMusic() {
    this.musicWanted = true
    if (!this.ctx || this.musicTimer || this.musicVolume <= 0.001) return
    this.nextNoteTime = this.ctx.currentTime + 0.15
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25)
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer)
    this.musicTimer = null
  }

  scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return
    const sixteenth = 60 / MUSIC.bpm / 4
    // After a long stall (tab throttling) skip ahead instead of bursting notes.
    if (this.nextNoteTime < this.ctx.currentTime - 0.3) this.nextNoteTime = this.ctx.currentTime + 0.05
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextNoteTime - this.ctx.currentTime)
      this.nextNoteTime += sixteenth
      this.step = (this.step + 1) % (16 * MUSIC.melody.length)
    }
  }

  scheduleStep(step, delay) {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const chord = MUSIC.chords[bar % MUSIC.chords.length]
    const bus = this.musicBus

    // Drums.
    if (s === 0 || s === 8 || (bar % 2 === 1 && s === 10)) {
      this.tone({ freq: 150, to: 42, type: 'sine', dur: 0.2, vol: 0.32, delay, bus })
    }
    if (s === 4 || s === 12) {
      this.noise({ dur: 0.13, vol: 0.1, type: 'bandpass', freq: 1800, q: 0.8, delay, bus })
      this.tone({ freq: 210, to: 120, type: 'triangle', dur: 0.08, vol: 0.07, delay, bus })
    }
    if (s % 2 === 0) this.noise({ dur: 0.03, vol: s === 14 ? 0.035 : 0.018, type: 'highpass', freq: 8000, delay, bus })

    // Bass.
    const bassPattern = { 0: 0, 6: 0, 8: 12, 14: 7 }
    if (s in bassPattern) {
      this.tone({ freq: midiToFreq(chord.root + bassPattern[s]), type: 'triangle', dur: 0.22, vol: 0.13, delay, bus })
    }

    // Chord stabs on the off-beats.
    if (s === 4 || s === 12) {
      for (const n of chord.tones) {
        this.tone({ freq: midiToFreq(n), type: 'triangle', dur: 0.16, vol: 0.022, delay, bus })
      }
    }

    // Lead melody.
    const note = MUSIC.melody[bar][s]
    if (note) this.tone({ freq: midiToFreq(note), type: 'square', dur: 0.17, vol: 0.035, filter: 2600, delay, bus })
  }
}

/* Upbeat I-V-vi-IV loop in C major, 8 bars, 16th-note grid (null = rest). */
const _ = null
const MUSIC = {
  bpm: 116,
  chords: [
    { root: 36, tones: [60, 64, 67] }, // C
    { root: 43, tones: [59, 62, 67] }, // G
    { root: 45, tones: [57, 60, 64] }, // Am
    { root: 41, tones: [57, 60, 65] }, // F
  ],
  melody: [
    [76, _, 79, _, 84, _, 79, _, 81, _, 79, _, 76, _, 74, _],
    [74, _, 79, _, 83, _, 79, _, 81, _, 83, _, 86, _, 83, _],
    [84, _, 81, _, 76, _, 81, _, 79, _, 76, _, 72, _, 76, _],
    [77, _, 81, _, 84, _, 81, _, 79, _, 77, _, 76, _, 74, _],
    [79, _, _, _, 76, _, 79, _, 84, _, _, _, 86, _, 88, _],
    [86, _, _, _, 83, _, 79, _, 86, _, _, _, 83, _, 81, _],
    [84, _, _, _, 81, _, 76, _, 81, _, 83, _, 84, _, 88, _],
    [86, _, 84, _, 81, _, _, _, 79, _, 81, _, 84, _, 83, _],
  ],
}

export const audio = new AudioEngine()
export default audio
