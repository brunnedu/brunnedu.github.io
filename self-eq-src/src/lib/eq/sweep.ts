/** Phase 5 log sine sweep (§1b Q5). */
export const SWEEP_F0_HZ = 5000
export const SWEEP_F1_HZ = 12000

export const SWEEP_DURATION_PRESETS = [15, 30, 45] as const
export type SweepDurationPreset = (typeof SWEEP_DURATION_PRESETS)[number]
export const DEFAULT_SWEEP_DURATION_SEC: SweepDurationPreset = 30

/** @deprecated Prefer `DEFAULT_SWEEP_DURATION_SEC` or a chosen preset duration. */
export const SWEEP_DURATION_SEC = DEFAULT_SWEEP_DURATION_SEC

function durationOrDefault(durationSec: number | undefined): number {
  const T = durationSec ?? DEFAULT_SWEEP_DURATION_SEC
  return T > 0 ? T : DEFAULT_SWEEP_DURATION_SEC
}

/** Instantaneous frequency during exponential sweep f0→f1 over T seconds. */
export function logSweepFreqAtElapsed(elapsedSec: number, durationSec?: number): number {
  const f0 = SWEEP_F0_HZ
  const f1 = SWEEP_F1_HZ
  const T = durationOrDefault(durationSec)
  if (elapsedSec <= 0) return f0
  if (elapsedSec >= T) return f1
  return f0 * Math.pow(f1 / f0, elapsedSec / T)
}

/** Normalized time t ∈ [0,1] for a given frequency on the same log law (inverse of sweep). */
export function normalizedTFromFreq(freqHz: number): number {
  const f0 = SWEEP_F0_HZ
  const f1 = SWEEP_F1_HZ
  const f = Math.min(Math.max(freqHz, f0), f1)
  const t = Math.log(f / f0) / Math.log(f1 / f0)
  return Math.max(0, Math.min(1, t))
}

/** Frequency at normalized position t ∈ [0,1] along the sweep. */
export function freqFromNormalizedT(t: number, durationSec?: number): number {
  const T = durationOrDefault(durationSec)
  const tn = Math.max(0, Math.min(1, t))
  if (tn <= 0) return SWEEP_F0_HZ
  if (tn >= 1) return SWEEP_F1_HZ
  return logSweepFreqAtElapsed(tn * T, T)
}

/** From marked start/end frequencies on the sweep (Hz). */
export function notchParamsFromMarkFrequencies(
  fStartHz: number,
  fEndHz: number,
  defaultGainDb = -6,
): { freqHz: number; q: number; gainDb: number } {
  const lo = Math.min(fStartHz, fEndHz)
  const hi = Math.max(fStartHz, fEndHz)
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { freqHz: (lo + hi) / 2 || 8000, q: 8, gainDb: defaultGainDb }
  }
  const fc = Math.sqrt(lo * hi)
  const rawQ = fc / (hi - lo)
  const q = Math.min(50, Math.max(1, rawQ))
  return { freqHz: fc, q, gainDb: defaultGainDb }
}

export const MAX_SWEEP_NOTCHES = 3
