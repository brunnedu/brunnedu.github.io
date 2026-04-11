/**
 * Cascade magnitude (dB) for the canonical EQ chain, aligned with Web Audio biquad formulas
 * (RBJ / cookbook) and the same `sw-*` notch → peaking mapping as `applyBandToBiquad`.
 */

import { allBandsForChain, type CanonicalEq, type EqBand } from './canonicalEq'

export type NormalizedBiquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

function normalizeRaw(raw: {
  b0: number
  b1: number
  b2: number
  a0: number
  a1: number
  a2: number
}): NormalizedBiquad {
  const a0 = raw.a0
  return {
    b0: raw.b0 / a0,
    b1: raw.b1 / a0,
    b2: raw.b2 / a0,
    a1: raw.a1 / a0,
    a2: raw.a2 / a0,
  }
}

function shelfAlpha(A: number, w0: number, Q: number): number {
  const sinw0 = Math.sin(w0)
  const q = Math.max(Q, 1e-6)
  return (sinw0 / 2) * Math.sqrt((A + 1 / A) * (1 / q - 1) + 2)
}

function lowShelfRaw(fc: number, gainDb: number, Q: number, fs: number) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * fc) / fs
  const cosw0 = Math.cos(w0)
  const alpha = shelfAlpha(A, w0, Q)
  const sA = Math.sqrt(A)
  const b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sA * alpha)
  const b1 = 2 * A * ((A - 1) - (A + 1) * cosw0)
  const b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sA * alpha)
  const a0 = (A + 1) + (A - 1) * cosw0 + 2 * sA * alpha
  const a1 = -2 * ((A - 1) + (A + 1) * cosw0)
  const a2 = (A + 1) + (A - 1) * cosw0 - 2 * sA * alpha
  return { b0, b1, b2, a0, a1, a2 }
}

function highShelfRaw(fc: number, gainDb: number, Q: number, fs: number) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * fc) / fs
  const cosw0 = Math.cos(w0)
  const alpha = shelfAlpha(A, w0, Q)
  const sA = Math.sqrt(A)
  const b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sA * alpha)
  const b1 = -2 * A * ((A - 1) + (A + 1) * cosw0)
  const b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sA * alpha)
  const a0 = (A + 1) - (A - 1) * cosw0 + 2 * sA * alpha
  const a1 = 2 * ((A - 1) - (A + 1) * cosw0)
  const a2 = (A + 1) - (A - 1) * cosw0 - 2 * sA * alpha
  return { b0, b1, b2, a0, a1, a2 }
}

function peakingRaw(fc: number, gainDb: number, Q: number, fs: number) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * fc) / fs
  const alpha = Math.sin(w0) / (2 * Math.max(Q, 1e-6))
  const cosw0 = Math.cos(w0)
  const b0 = 1 + alpha * A
  const b1 = -2 * cosw0
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cosw0
  const a2 = 1 - alpha / A
  return { b0, b1, b2, a0, a1, a2 }
}

function notchRaw(fc: number, Q: number, fs: number) {
  const w0 = (2 * Math.PI * fc) / fs
  const alpha = Math.sin(w0) / (2 * Math.max(Q, 1e-6))
  const cosw0 = Math.cos(w0)
  return { b0: 1, b1: -2 * cosw0, b2: 1, a0: 1 + alpha, a1: -2 * cosw0, a2: 1 - alpha }
}

/** Magnitude (dB) of H(z) at normalized radian frequency ω = 2πf/fs. */
export function biquadMagDb(c: NormalizedBiquad, f: number, fs: number): number {
  if (!(f > 0) || !(fs > 0) || f >= fs / 2) return 0
  const w = (2 * Math.PI * f) / fs
  const c1 = Math.cos(w)
  const s1 = Math.sin(w)
  const c2 = Math.cos(2 * w)
  const s2 = Math.sin(2 * w)
  const numRe = c.b0 + c.b1 * c1 + c.b2 * c2
  const numIm = -c.b1 * s1 - c.b2 * s2
  const denRe = 1 + c.a1 * c1 + c.a2 * c2
  const denIm = -c.a1 * s1 - c.a2 * s2
  const numMag = Math.hypot(numRe, numIm)
  const denMag = Math.hypot(denRe, denIm)
  if (denMag < 1e-30 || numMag < 1e-30) return -200
  return 20 * Math.log10(numMag / denMag)
}

function bandToCoeffs(band: EqBand, fs: number): NormalizedBiquad | null {
  const fc = band.freqHz
  if (!(fc > 0) || fc >= fs / 2) return null
  const Q = Math.max(band.q, 1e-6)

  if (band.type === 'notch' && band.id.startsWith('sw-')) {
    return normalizeRaw(peakingRaw(fc, band.gainDb, Q, fs))
  }

  switch (band.type) {
    case 'lowshelf':
      return normalizeRaw(lowShelfRaw(fc, band.gainDb, Q, fs))
    case 'highshelf':
      return normalizeRaw(highShelfRaw(fc, band.gainDb, Q, fs))
    case 'peaking':
      return normalizeRaw(peakingRaw(fc, band.gainDb, Q, fs))
    case 'notch':
      return normalizeRaw(notchRaw(fc, Q, fs))
    default:
      return null
  }
}

/**
 * Total dB magnitude at `f` Hz: preamp + sum of biquads (bypass → flat 0 dB shaping).
 */
export function eqChainMagnitudeDb(f: number, fs: number, eq: CanonicalEq): number {
  if (eq.eqBypass) return 0
  let sum = eq.preampDb
  for (const band of allBandsForChain(eq)) {
    const c = bandToCoeffs(band, fs)
    if (c) sum += biquadMagDb(c, f, fs)
  }
  return sum
}

/** Sample rate used when recomputing auto preamp before the audio context exists. */
export const PREAMP_SCAN_FS = 48000

/** Log-spaced bins from 20 Hz to just below Nyquist for cascade peak search. */
export const PREAMP_GRID_POINTS = 768

/**
 * Max magnitude (dB) of the biquad chain with `preampDb` treated as 0 — i.e. how much the filters
 * boost the spectrum at worst case among `pointCount` log-spaced frequencies.
 */
export function peakEqChainMagnitudeDb(
  eq: CanonicalEq,
  fs: number = PREAMP_SCAN_FS,
  pointCount: number = PREAMP_GRID_POINTS,
): number {
  if (eq.eqBypass) return 0
  const probe: CanonicalEq = { ...eq, preampDb: 0 }
  const fMax = fs * 0.499
  const freqs = logSpacedFrequencies(20, fMax, pointCount)
  let peak = -Infinity
  for (const f of freqs) {
    const m = eqChainMagnitudeDb(f, fs, probe)
    if (m > peak) peak = m
  }
  return Number.isFinite(peak) ? peak : 0
}

/** Preamp (≤ 0) so the full chain peak (including preamp) is ≤ 0 dB at sampled frequencies. */
export function preampDbFromCascadePeak(
  eq: CanonicalEq,
  fs: number = PREAMP_SCAN_FS,
  pointCount: number = PREAMP_GRID_POINTS,
): number {
  const peak = peakEqChainMagnitudeDb(eq, fs, pointCount)
  return peak > 0 ? -peak : 0
}

export function logSpacedFrequencies(fMin: number, fMax: number, count: number): number[] {
  const lo = Math.log10(fMin)
  const hi = Math.log10(fMax)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    out.push(Math.pow(10, lo + t * (hi - lo)))
  }
  return out
}
