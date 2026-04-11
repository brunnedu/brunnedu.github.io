/** Reference tone for loudness matching (design doc). */
export const LOUDNESS_REFERENCE_HZ = 1000

export const LOUDNESS_TEST_FREQS = [2000, 3000, 4000, 6000] as const
export type LoudnessTestFreq = (typeof LOUDNESS_TEST_FREQS)[number]

export type LoudnessSignalMode = 'narrowband' | 'tone'

/** Width of virtual loudness-match peaking bands in the chain (Feedback 1 §9.3). */
export type LoudnessMatchQMode = 'narrow' | 'standard' | 'wide'

/** Peaking Q for 1/3-octave bandwidth: fc / (f_hi − f_lo), f_hi/fc = 2^(1/6). */
export function thirdOctavePeakingQ(): number {
  const r = Math.pow(2, 1 / 6)
  return 1 / (r - 1 / r)
}

/** Bandpass Q (same fractional bandwidth) for narrowband noise stimulus. */
export function thirdOctaveBandpassQ(): number {
  return thirdOctavePeakingQ()
}

/** Peaking Q stored in chain for loudness corrections (narrow for sine stimulus). */
export function loudnessPeakingQ(mode: LoudnessSignalMode): number {
  return mode === 'narrowband' ? thirdOctavePeakingQ() : 14
}

/** Correction-band Q: `standard` is the new default (broader than legacy narrow third-octave). */
export function loudnessCorrectionPeakingQ(mode: LoudnessSignalMode, width: LoudnessMatchQMode): number {
  const narrowQ = loudnessPeakingQ(mode)
  if (width === 'narrow') return narrowQ
  if (width === 'standard') return Math.max(0.85, narrowQ / 2.5)
  return Math.max(0.65, narrowQ / 4.5)
}

export type LoudnessMatchGains = Record<LoudnessTestFreq, number>

export function defaultLoudnessMatchDb(): LoudnessMatchGains {
  return { 2000: 0, 3000: 0, 4000: 0, 6000: 0 }
}

export function isLoudnessTestFreq(n: number): n is LoudnessTestFreq {
  return (LOUDNESS_TEST_FREQS as readonly number[]).includes(n)
}

export type LoudnessCalRoute = 'reference' | 'test'

/** Snapshot for `PreviewAudioEngine.applyLoudnessCal` (from Phase 4 UI). */
export type LoudnessCalUi = {
  playing: boolean
  route: LoudnessCalRoute
  testFreq: LoudnessTestFreq
  signalMode: LoudnessSignalMode
}
