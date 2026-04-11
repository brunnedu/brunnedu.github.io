/** Convert decibels to linear gain (Web Audio `GainNode.gain`). */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Paul Kellet-style pink noise into an `AudioBuffer`, peak-normalized for headroom.
 */
export function createPinkNoiseBuffer(ctx: BaseAudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const frames = Math.floor(sampleRate * durationSec)
  const buffer = ctx.createBuffer(1, frames, sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    b6 = white * 0.115926
    data[i] = out
  }
  let peak = 0
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(data[i]))
  if (peak > 0) {
    const scale = 0.2 / peak
    for (let i = 0; i < frames; i++) data[i] *= scale
  }
  return buffer
}

/** Looping white noise for narrowband loudness stimuli (peak-normalized). */
export function createWhiteNoiseBuffer(ctx: BaseAudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const frames = Math.floor(sampleRate * durationSec)
  const buffer = ctx.createBuffer(1, frames, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  let peak = 0
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(data[i]))
  if (peak > 0) {
    const scale = 0.25 / peak
    for (let i = 0; i < frames; i++) data[i] *= scale
  }
  return buffer
}

import { preampDbFromCascadePeak } from '../eq/biquadMagnitude'
import {
  allBandsForChain,
  defaultLoudnessMatchDb,
  type CanonicalEq,
  type EqBand,
} from '../eq/canonicalEq'
import {
  LOUDNESS_REFERENCE_HZ,
  thirdOctaveBandpassQ,
  type LoudnessCalUi,
} from '../eq/loudness'
import {
  DEFAULT_SWEEP_DURATION_SEC,
  logSweepFreqAtElapsed,
  SWEEP_F0_HZ,
  SWEEP_F1_HZ,
} from '../eq/sweep'
import { applyBandToBiquad } from '../eq/applyBandToBiquad'

/**
 * Preview: pink + optional calibration tones → preamp → PEQ → master (or bypass).
 */
export class PreviewAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private preampGain: GainNode | null = null
  private pinkMute: GainNode | null = null
  private pinkSource: AudioBufferSourceNode | null = null
  private eqNodes: BiquadFilterNode[] = []

  private whiteSource: AudioBufferSourceNode | null = null
  private bpFilter: BiquadFilterNode | null = null
  private whiteTrim: GainNode | null = null
  private nbGate: GainNode | null = null
  private osc: OscillatorNode | null = null
  private toneTrim: GainNode | null = null
  private toneGate: GainNode | null = null
  private lmMerge: GainNode | null = null
  private calMute: GainNode | null = null

  private sweepOsc: OscillatorNode | null = null
  private sweepMute: GainNode | null = null
  private sweepT0: number | null = null
  /** True while log sweep is running (mutes pink). */
  private sweepIsActive = false
  private sweepEndTimer: ReturnType<typeof setTimeout> | null = null
  /** Active auto-sweep length in seconds (may be any positive value from UI). */
  private sweepDurationActive: number = DEFAULT_SWEEP_DURATION_SEC
  /** Sine at scrubbed frequency while sweep is not auto-playing (explore band). */
  private sweepManualAudible = false

  private musicMute: GainNode | null = null
  private musicSource: AudioBufferSourceNode | null = null

  private masterGainDb = 0
  private levelLocked = false
  private pinkAudible = false
  /** While true, pink is forced silent so calibration tones are audible. */
  private pinkSuppressedForCal = false

  getMasterGainDb(): number {
    return this.masterGainDb
  }

  isLevelLocked(): boolean {
    return this.levelLocked
  }

  isPinkAudible(): boolean {
    return this.pinkAudible
  }

  getContextState(): AudioContextState {
    return this.ctx?.state ?? 'suspended'
  }

  /** Sample rate for magnitude plot / export notes (default 48 kHz before context exists). */
  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 48000
  }

  async decodeMusicFile(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    await this.ensureReady()
    if (!this.ctx) throw new Error('AudioContext missing')
    return await this.ctx.decodeAudioData(arrayBuffer.slice(0))
  }

  async ensureReady(): Promise<void> {
    const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) throw new Error('Web Audio API not supported')
    if (!this.ctx) {
      this.ctx = new AC()
      this.buildGraph()
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  private buildGraph(): void {
    if (!this.ctx) return

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = dbToLinear(this.masterGainDb)
    this.masterGain.connect(this.ctx.destination)

    this.preampGain = this.ctx.createGain()
    this.preampGain.gain.value = 1
    this.preampGain.connect(this.masterGain)

    this.pinkMute = this.ctx.createGain()
    this.pinkMute.gain.value = 0
    this.pinkMute.connect(this.preampGain)

    const pinkBuffer = createPinkNoiseBuffer(this.ctx, 4)
    const pinkSrc = this.ctx.createBufferSource()
    pinkSrc.buffer = pinkBuffer
    pinkSrc.loop = true
    pinkSrc.connect(this.pinkMute)
    pinkSrc.start(0)
    this.pinkSource = pinkSrc

    const qBp = thirdOctaveBandpassQ()
    const whiteBuf = createWhiteNoiseBuffer(this.ctx, 2)
    this.whiteSource = this.ctx.createBufferSource()
    this.whiteSource.buffer = whiteBuf
    this.whiteSource.loop = true

    this.bpFilter = this.ctx.createBiquadFilter()
    this.bpFilter.type = 'bandpass'
    this.bpFilter.frequency.value = LOUDNESS_REFERENCE_HZ
    this.bpFilter.Q.value = qBp

    this.whiteTrim = this.ctx.createGain()
    this.whiteTrim.gain.value = 0.38

    this.nbGate = this.ctx.createGain()
    this.nbGate.gain.value = 1

    this.whiteSource.connect(this.bpFilter)
    this.bpFilter.connect(this.whiteTrim)
    this.whiteTrim.connect(this.nbGate)

    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sine'
    this.osc.frequency.value = LOUDNESS_REFERENCE_HZ
    this.osc.start(0)

    this.toneTrim = this.ctx.createGain()
    this.toneTrim.gain.value = 0.14

    this.toneGate = this.ctx.createGain()
    this.toneGate.gain.value = 0

    this.osc.connect(this.toneTrim)
    this.toneTrim.connect(this.toneGate)

    this.lmMerge = this.ctx.createGain()
    this.lmMerge.gain.value = 1
    this.nbGate.connect(this.lmMerge)
    this.toneGate.connect(this.lmMerge)

    this.calMute = this.ctx.createGain()
    this.calMute.gain.value = 0
    this.lmMerge.connect(this.calMute)
    this.calMute.connect(this.preampGain)

    this.sweepOsc = this.ctx.createOscillator()
    this.sweepOsc.type = 'sine'
    this.sweepOsc.frequency.value = SWEEP_F0_HZ
    this.sweepOsc.start(0)

    this.sweepMute = this.ctx.createGain()
    this.sweepMute.gain.value = 0
    this.sweepOsc.connect(this.sweepMute)
    this.sweepMute.connect(this.preampGain)

    this.musicMute = this.ctx.createGain()
    this.musicMute.gain.value = 0
    this.musicMute.connect(this.preampGain)

    this.whiteSource.start(0)
  }

  /**
   * Rebuilds routing: bypass → pink + cal → master; else → preamp → EQ → master, with pink + cal into preamp.
   */
  applyCanonicalEq(eq: CanonicalEq): void {
    if (!this.ctx || !this.preampGain || !this.masterGain || !this.pinkMute || !this.calMute || !this.sweepMute) return

    for (const n of this.eqNodes) {
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    this.eqNodes = []

    try {
      this.pinkMute.disconnect()
    } catch {
      /* noop */
    }
    try {
      this.calMute.disconnect()
    } catch {
      /* noop */
    }
    try {
      this.sweepMute.disconnect()
    } catch {
      /* noop */
    }
    try {
      this.musicMute?.disconnect()
    } catch {
      /* noop */
    }
    this.preampGain.disconnect()
    this.masterGain.disconnect()
    this.masterGain.connect(this.ctx.destination)

    if (eq.eqBypass) {
      this.pinkMute.connect(this.masterGain)
      this.calMute.connect(this.masterGain)
      this.sweepMute.connect(this.masterGain)
      this.musicMute?.connect(this.masterGain)
      return
    }

    const sorted = allBandsForChain(eq)
    this.preampGain.gain.value = dbToLinear(eq.preampDb)

    this.pinkMute.connect(this.preampGain)
    this.calMute.connect(this.preampGain)
    this.sweepMute.connect(this.preampGain)
    this.musicMute?.connect(this.preampGain)

    let previous: AudioNode = this.preampGain
    for (const band of sorted) {
      const node = this.ctx.createBiquadFilter()
      applyBandToBiquad(node, band)
      previous.connect(node)
      previous = node
      this.eqNodes.push(node)
    }
    previous.connect(this.masterGain)
  }

  applyBands(bands: EqBand[]): void {
    const preampDb = preampDbFromCascadePeak({
      version: 1,
      meta: {},
      preampDb: 0,
      userMasterGainDb: this.masterGainDb,
      tiltDb: 0,
      eqBypass: false,
      loudnessSignalMode: 'narrowband',
      loudnessMatchQMode: 'standard',
      loudnessMatchDb: defaultLoudnessMatchDb(),
      sweepNotches: [],
      bands,
    })
    this.applyCanonicalEq({
      version: 1,
      meta: {},
      preampDb,
      userMasterGainDb: this.masterGainDb,
      tiltDb: 0,
      eqBypass: false,
      loudnessSignalMode: 'narrowband',
      loudnessMatchQMode: 'standard',
      loudnessMatchDb: defaultLoudnessMatchDb(),
      sweepNotches: [],
      bands,
    })
  }

  /**
   * Phase 4 loudness calibration: reference 1 kHz vs test bands, narrowband or sine.
   * Tones are summed with pink at the preamp input and run through the same EQ as pink.
   */
  applyLoudnessCal(ui: LoudnessCalUi): void {
    if (!this.ctx || !this.bpFilter || !this.osc || !this.nbGate || !this.toneGate || !this.calMute) return

    const now = this.ctx.currentTime
    const freqHz = ui.route === 'reference' ? LOUDNESS_REFERENCE_HZ : ui.testFreq

    this.bpFilter.frequency.setTargetAtTime(freqHz, now, 0.02)
    this.osc.frequency.setTargetAtTime(freqHz, now, 0.02)

    const wantNb = ui.signalMode === 'narrowband' ? 1 : 0
    const wantTone = ui.signalMode === 'tone' ? 1 : 0
    this.nbGate.gain.setTargetAtTime(wantNb, now, 0.025)
    this.toneGate.gain.setTargetAtTime(wantTone, now, 0.025)

    this.pinkSuppressedForCal = ui.playing
    this.rampPinkMute()

    const calTarget = ui.playing ? 1 : 0
    this.calMute.gain.cancelScheduledValues(now)
    this.calMute.gain.setValueAtTime(this.calMute.gain.value, now)
    this.calMute.gain.linearRampToValueAtTime(calTarget, now + 0.03)
  }

  setMasterGainDb(db: number): void {
    if (this.levelLocked) return
    this.masterGainDb = db
    if (this.masterGain) {
      this.masterGain.gain.value = dbToLinear(db)
    }
  }

  setUserMasterFromCanonical(userMasterGainDb: number): void {
    if (this.levelLocked) return
    this.setMasterGainDb(userMasterGainDb)
  }

  lockLevel(): void {
    if (!this.ctx) return
    this.levelLocked = true
  }

  unlockLevel(): void {
    this.levelLocked = false
  }

  setPinkAudible(audible: boolean): void {
    this.pinkAudible = audible
    this.rampPinkMute()
  }

  /** Sample current sweep position for Mark start/end (Phase 5). */
  getSweepMarkSample(): { elapsedSec: number; freqHz: number } | null {
    if (!this.ctx || !this.sweepIsActive || this.sweepT0 === null) return null
    const elapsed = this.ctx.currentTime - this.sweepT0
    const T = this.sweepDurationActive
    if (elapsed < 0 || elapsed > T) return null
    return { elapsedSec: elapsed, freqHz: logSweepFreqAtElapsed(elapsed, T) }
  }

  getSweepDurationSec(): number {
    return this.sweepDurationActive
  }

  /**
   * Log sweep from optional normalized start position (0…1). Uses `durationSec` (e.g. 15/30/45).
   */
  startLogSweep(durationSec: number, startNormalizedT = 0): void {
    if (!this.ctx || !this.sweepOsc || !this.sweepMute) return
    this.stopLogSweep()
    const T = durationSec > 0 ? durationSec : DEFAULT_SWEEP_DURATION_SEC
    this.sweepDurationActive = T
    const t0n = Math.max(0, Math.min(1, startNormalizedT))
    const elapsed0 = t0n * T
    const fStart = logSweepFreqAtElapsed(elapsed0, T)
    const remaining = Math.max(0.08, T - elapsed0)
    const t0 = this.ctx.currentTime
    this.sweepT0 = t0 - elapsed0
    this.sweepIsActive = true
    this.sweepManualAudible = false

    this.sweepOsc.frequency.cancelScheduledValues(t0)
    this.sweepOsc.frequency.setValueAtTime(fStart, t0)
    this.sweepOsc.frequency.exponentialRampToValueAtTime(SWEEP_F1_HZ, t0 + remaining)

    this.sweepMute.gain.cancelScheduledValues(t0)
    this.sweepMute.gain.setValueAtTime(0, t0)
    this.sweepMute.gain.linearRampToValueAtTime(0.1, t0 + 0.03)
    const fadeStart = t0 + remaining - 0.02
    if (fadeStart > t0 + 0.04) {
      this.sweepMute.gain.setValueAtTime(0.1, t0 + 0.04)
      this.sweepMute.gain.setValueAtTime(0.1, fadeStart)
    }
    this.sweepMute.gain.linearRampToValueAtTime(0, t0 + remaining)

    this.rampPinkMute()

    this.sweepEndTimer = setTimeout(() => {
      this.sweepEndTimer = null
      this.sweepIsActive = false
      this.sweepT0 = null
      this.rampPinkMute()
    }, remaining * 1000 + 80)
  }

  /** Jump auto-sweep to a new normalized position (0…1) without stopping. */
  seekLogSweep(normalizedT: number): void {
    if (!this.ctx || !this.sweepOsc || !this.sweepMute || !this.sweepIsActive) return
    if (this.sweepEndTimer !== null) {
      clearTimeout(this.sweepEndTimer)
      this.sweepEndTimer = null
    }
    const T = this.sweepDurationActive
    const t = Math.max(0, Math.min(1, normalizedT))
    const elapsed0 = t * T
    const fNow = logSweepFreqAtElapsed(elapsed0, T)
    const remaining = Math.max(0.08, T - elapsed0)
    const now = this.ctx.currentTime
    this.sweepT0 = now - elapsed0
    this.sweepOsc.frequency.cancelScheduledValues(now)
    this.sweepOsc.frequency.setValueAtTime(fNow, now)
    this.sweepOsc.frequency.exponentialRampToValueAtTime(SWEEP_F1_HZ, now + remaining)

    this.sweepMute.gain.cancelScheduledValues(now)
    this.sweepMute.gain.linearRampToValueAtTime(0.1, now + 0.02)
    const fadeStart = now + remaining - 0.02
    if (fadeStart > now + 0.04) {
      this.sweepMute.gain.setValueAtTime(0.1, now + 0.04)
      this.sweepMute.gain.setValueAtTime(0.1, fadeStart)
    }
    this.sweepMute.gain.linearRampToValueAtTime(0, now + remaining)

    this.sweepEndTimer = setTimeout(() => {
      this.sweepEndTimer = null
      this.sweepIsActive = false
      this.sweepT0 = null
      this.rampPinkMute()
    }, remaining * 1000 + 80)
  }

  /** Audible sine at `hz` in sweep range while not auto-sweeping (scrub / explore). */
  setSweepManualHz(hz: number): void {
    if (!this.ctx || !this.sweepOsc || !this.sweepMute) return
    const f = Math.max(SWEEP_F0_HZ, Math.min(SWEEP_F1_HZ, hz))
    const now = this.ctx.currentTime
    this.sweepManualAudible = true
    this.sweepOsc.frequency.cancelScheduledValues(now)
    this.sweepOsc.frequency.setValueAtTime(f, now)
    this.sweepMute.gain.cancelScheduledValues(now)
    this.sweepMute.gain.linearRampToValueAtTime(0.1, now + 0.02)
    this.rampPinkMute()
  }

  stopSweepManualPreview(): void {
    if (!this.ctx || !this.sweepMute || !this.sweepOsc) return
    if (!this.sweepManualAudible) return
    const now = this.ctx.currentTime
    this.sweepManualAudible = false
    this.sweepMute.gain.cancelScheduledValues(now)
    this.sweepMute.gain.setValueAtTime(this.sweepMute.gain.value, now)
    this.sweepMute.gain.linearRampToValueAtTime(0, now + 0.02)
    this.rampPinkMute()
  }

  stopLogSweep(): void {
    if (this.sweepEndTimer !== null) {
      clearTimeout(this.sweepEndTimer)
      this.sweepEndTimer = null
    }
    if (!this.ctx || !this.sweepOsc || !this.sweepMute) return
    const now = this.ctx.currentTime
    this.sweepOsc.frequency.cancelScheduledValues(now)
    const f = this.sweepOsc.frequency.value
    const clamped = Math.max(SWEEP_F0_HZ, Math.min(SWEEP_F1_HZ, f))
    this.sweepOsc.frequency.setValueAtTime(clamped, now)
    this.sweepMute.gain.cancelScheduledValues(now)
    this.sweepMute.gain.setValueAtTime(this.sweepMute.gain.value, now)
    this.sweepMute.gain.linearRampToValueAtTime(0, now + 0.02)
    this.sweepIsActive = false
    this.sweepT0 = null
    this.sweepManualAudible = false
    this.rampPinkMute()
  }

  /** Replace looping music with decoded buffer (stereo mixed to graph input). */
  loadUserMusic(buffer: AudioBuffer): void {
    if (!this.ctx || !this.musicMute) return
    try {
      this.musicSource?.stop()
    } catch {
      /* noop */
    }
    this.musicSource = null
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(this.musicMute)
    src.start(0)
    this.musicSource = src
  }

  setMusicAudible(audible: boolean): void {
    if (!this.musicMute || !this.ctx) return
    const now = this.ctx.currentTime
    const g = audible ? 0.22 : 0
    this.musicMute.gain.cancelScheduledValues(now)
    this.musicMute.gain.setValueAtTime(this.musicMute.gain.value, now)
    this.musicMute.gain.linearRampToValueAtTime(g, now + 0.04)
  }

  stopUserMusic(): void {
    try {
      this.musicSource?.stop()
    } catch {
      /* noop */
    }
    this.musicSource = null
    if (this.musicMute && this.ctx) {
      const now = this.ctx.currentTime
      this.musicMute.gain.cancelScheduledValues(now)
      this.musicMute.gain.setValueAtTime(0, now)
    }
  }

  isSweepActive(): boolean {
    return this.sweepIsActive
  }

  private rampPinkMute(): void {
    if (!this.pinkMute || !this.ctx) return
    const now = this.ctx.currentTime
    const sweepBlocksPink = this.sweepIsActive || this.sweepManualAudible
    const effective = this.pinkAudible && !this.pinkSuppressedForCal && !sweepBlocksPink
    const target = effective ? 1 : 0
    this.pinkMute.gain.cancelScheduledValues(now)
    this.pinkMute.gain.setValueAtTime(this.pinkMute.gain.value, now)
    this.pinkMute.gain.linearRampToValueAtTime(target, now + 0.02)
  }

  dispose(): void {
    if (this.sweepEndTimer !== null) {
      clearTimeout(this.sweepEndTimer)
      this.sweepEndTimer = null
    }
    try {
      this.pinkSource?.stop()
    } catch {
      /* already stopped */
    }
    try {
      this.whiteSource?.stop()
    } catch {
      /* noop */
    }
    this.pinkSource = null
    this.whiteSource = null
    this.osc = null
    this.sweepOsc = null
    for (const n of this.eqNodes) {
      try {
        n.disconnect()
      } catch {
        /* noop */
      }
    }
    this.eqNodes = []
    this.ctx?.close()
    this.ctx = null
    this.masterGain = null
    this.preampGain = null
    this.pinkMute = null
    this.bpFilter = null
    this.whiteTrim = null
    this.nbGate = null
    this.toneTrim = null
    this.toneGate = null
    this.lmMerge = null
    this.calMute = null
    this.sweepMute = null
    this.musicMute = null
    try {
      this.musicSource?.stop()
    } catch {
      /* noop */
    }
    this.musicSource = null
    this.sweepT0 = null
    this.sweepIsActive = false
    this.sweepManualAudible = false
    this.pinkAudible = false
    this.pinkSuppressedForCal = false
    this.levelLocked = false
  }
}
