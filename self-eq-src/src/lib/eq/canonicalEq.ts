/**
 * Canonical EQ document: single source of truth for preview graph, persistence, and Peace export (Phase 7).
 */

import {
  defaultLoudnessMatchDb,
  LOUDNESS_TEST_FREQS,
  loudnessCorrectionPeakingQ,
  type LoudnessMatchGains,
  type LoudnessMatchQMode,
  type LoudnessSignalMode,
} from './loudness'

export const CANONICAL_VERSION = 1 as const

export type { LoudnessMatchGains, LoudnessMatchQMode, LoudnessSignalMode }
export { defaultLoudnessMatchDb, LOUDNESS_TEST_FREQS } from './loudness'

export type BiquadKind = 'lowshelf' | 'highshelf' | 'peaking' | 'notch'

export type EqBand = {
  /** Stable id for UI keys and round-trip */
  id: string
  type: BiquadKind
  freqHz: number
  gainDb: number
  q: number
}

export type EqMeta = {
  headphoneName?: string
  createdAt?: string
}

/**
 * - `preampDb`: headroom trim (typically ≤ 0), maps to Peace `Preamp:` / first digital gain.
 * - `userMasterGainDb`: listening level in the preview app (separate from export preamp).
 */
/** Pivot frequency for Phase 1 spectral tilt (paired shelves). */
export const TILT_PIVOT_HZ = 1000

/** Shelf Q for tilt bands (gentle slope, low-Q tilt). */
export const TILT_SHELF_Q = 0.5

export type CanonicalEq = {
  version: typeof CANONICAL_VERSION
  meta: EqMeta
  preampDb: number
  userMasterGainDb: number
  /**
   * Macro tilt: lowshelf at pivot with `-tiltDb/2` and highshelf at pivot with `+tiltDb/2` dB.
   * Positive → brighter (more treble vs bass); negative → darker.
   */
  tiltDb: number
  /** When true, preview skips preamp + all biquads (flat pink at master gain). */
  eqBypass: boolean
  /** Stimulus for Phase 2 loudness matching UI (default narrowband = 1/3 octave). */
  loudnessSignalMode: LoudnessSignalMode
  /** Width of `__lm_*` peaking bands (Feedback 1: broader default = standard). */
  loudnessMatchQMode: LoudnessMatchQMode
  /** Peaking gains (dB) at 2k / 3k / 4k / 6k merged into the DSP chain (cuts only, ≤ 0). */
  loudnessMatchDb: LoudnessMatchGains
  /**
   * Up to 3 treble notches from Phase 5 sweep marks (`type: 'notch'`, typically negative `gainDb` via peaking workaround in export TBD).
   */
  sweepNotches: EqBand[]
  bands: EqBand[]
}

export function newBandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Processing order: shelves → peaking (by fc) → notches (by fc). */
/**
 * Synthetic shelf pair for tilt, always before user `bands` in the DSP chain.
 */
export function expandTiltBands(tiltDb: number): EqBand[] {
  if (Math.abs(tiltDb) < 0.01) return []
  const half = tiltDb / 2
  return [
    {
      id: '__tilt_low',
      type: 'lowshelf',
      freqHz: TILT_PIVOT_HZ,
      gainDb: -half,
      q: TILT_SHELF_Q,
    },
    {
      id: '__tilt_high',
      type: 'highshelf',
      freqHz: TILT_PIVOT_HZ,
      gainDb: half,
      q: TILT_SHELF_Q,
    },
  ]
}

/** Virtual peaking bands for loudness-match corrections (sorted with user peaking by frequency). */
export function loudnessPeakingBands(
  eq: Pick<CanonicalEq, 'loudnessSignalMode' | 'loudnessMatchQMode' | 'loudnessMatchDb'>,
): EqBand[] {
  const q = loudnessCorrectionPeakingQ(eq.loudnessSignalMode, eq.loudnessMatchQMode)
  return LOUDNESS_TEST_FREQS.map((fc) => ({
    id: `__lm_${fc}`,
    type: 'peaking' as const,
    freqHz: fc,
    gainDb: eq.loudnessMatchDb[fc],
    q,
  }))
}

/** Full preview/export band list: tilt, then user + loudness + sweep notches in policy order. */
export function allBandsForChain(eq: CanonicalEq): EqBand[] {
  const tilt = expandTiltBands(eq.tiltDb)
  const lm = loudnessPeakingBands(eq)
  const rest = sortBandsForChain([...eq.bands, ...lm, ...eq.sweepNotches])
  return [...tilt, ...rest]
}

export function sortBandsForChain(bands: EqBand[]): EqBand[] {
  const rank = (t: BiquadKind): number => {
    if (t === 'lowshelf') return 0
    if (t === 'highshelf') return 1
    if (t === 'peaking') return 2
    return 3
  }
  return [...bands].sort((a, b) => {
    const d = rank(a.type) - rank(b.type)
    return d !== 0 ? d : a.freqHz - b.freqHz
  })
}

/**
 * Negative preamp equal to the largest positive band gain (simple headroom rule from design doc).
 * Does not model series interaction; conservative enough for MVP.
 */
export function computePreampDb(bands: Pick<EqBand, 'gainDb'>[]): number {
  let maxBoost = 0
  for (const b of bands) {
    if (b.gainDb > maxBoost) maxBoost = b.gainDb
  }
  return maxBoost > 0 ? -maxBoost : 0
}

export function withAutoPreamp(eq: CanonicalEq): CanonicalEq {
  const loudnessMatchDb = { ...eq.loudnessMatchDb }
  for (const f of LOUDNESS_TEST_FREQS) {
    loudnessMatchDb[f] = Math.min(0, loudnessMatchDb[f])
  }
  const patched = { ...eq, loudnessMatchDb }
  return { ...patched, preampDb: computePreampDb(allBandsForChain(patched)) }
}

export function defaultCanonicalEq(): CanonicalEq {
  return {
    version: CANONICAL_VERSION,
    meta: {},
    preampDb: 0,
    userMasterGainDb: 0,
    tiltDb: 0,
    eqBypass: false,
    loudnessSignalMode: 'narrowband',
    loudnessMatchQMode: 'standard',
    loudnessMatchDb: defaultLoudnessMatchDb(),
    sweepNotches: [],
    bands: [
      {
        id: newBandId(),
        type: 'peaking',
        freqHz: 3000,
        gainDb: 0,
        q: 1,
      },
    ],
  }
}

/** JSON shape on disk (same as CanonicalEq; `id` optional for hand-written files). */
type EqBandJson = {
  id?: string
  type: string
  freqHz: number
  gainDb: number
  q: number
}

type CanonicalJson = {
  version?: number
  meta?: EqMeta
  preampDb?: number
  userMasterGainDb?: number
  tiltDb?: number
  eqBypass?: boolean
  loudnessSignalMode?: string
  loudnessMatchQMode?: string
  loudnessMatchDb?: Record<string, number>
  sweepNotches?: EqBandJson[]
  bands?: EqBandJson[]
}

const KINDS: Set<string> = new Set(['lowshelf', 'highshelf', 'peaking', 'notch'])

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export class CanonicalEqParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanonicalEqParseError'
  }
}

export function parseCanonicalEqJson(text: string): CanonicalEq {
  let raw: CanonicalJson
  try {
    raw = JSON.parse(text) as CanonicalJson
  } catch {
    throw new CanonicalEqParseError('Invalid JSON')
  }
  if (raw.version !== 1) {
    throw new CanonicalEqParseError(`Unsupported version: ${raw.version ?? 'missing'}`)
  }

  const userMasterGainDb = Number(raw.userMasterGainDb ?? 0)
  if (!Number.isFinite(userMasterGainDb)) throw new CanonicalEqParseError('Invalid userMasterGainDb')

  const tiltDb = Number(raw.tiltDb ?? 0)
  if (!Number.isFinite(tiltDb)) throw new CanonicalEqParseError('Invalid tiltDb')

  const eqBypass = Boolean(raw.eqBypass)

  const modeRaw = String(raw.loudnessSignalMode ?? 'narrowband')
  const loudnessSignalMode: LoudnessSignalMode =
    modeRaw === 'tone' ? 'tone' : 'narrowband'

  const qModeRaw = String(raw.loudnessMatchQMode ?? 'standard')
  const loudnessMatchQMode: LoudnessMatchQMode =
    qModeRaw === 'narrow' || qModeRaw === 'wide' ? qModeRaw : 'standard'

  const loudnessMatchDb = defaultLoudnessMatchDb()
  if (raw.loudnessMatchDb && typeof raw.loudnessMatchDb === 'object') {
    for (const f of LOUDNESS_TEST_FREQS) {
      const key = String(f)
      const v = Number((raw.loudnessMatchDb as Record<string, unknown>)[key])
      if (Number.isFinite(v)) loudnessMatchDb[f] = clamp(v, -24, 0)
    }
  }

  const sweepNotches: EqBand[] = []
  if (raw.sweepNotches !== undefined) {
    if (!Array.isArray(raw.sweepNotches)) throw new CanonicalEqParseError('Invalid sweepNotches')
    if (raw.sweepNotches.length > 3) throw new CanonicalEqParseError('At most 3 sweep notches allowed')
    for (let i = 0; i < raw.sweepNotches.length; i++) {
      const b = raw.sweepNotches[i]
      if (!b || typeof b !== 'object') throw new CanonicalEqParseError(`Invalid sweep notch at ${i}`)
      if (String(b.type) !== 'notch') throw new CanonicalEqParseError(`Sweep notch ${i} must be type "notch"`)
      const freqHz = Number(b.freqHz)
      const gainDb = Number(b.gainDb)
      const q = Number(b.q)
      if (![freqHz, gainDb, q].every(Number.isFinite)) {
        throw new CanonicalEqParseError(`Invalid sweep notch numerics at ${i}`)
      }
      sweepNotches.push({
        id: typeof b.id === 'string' && b.id.length > 0 ? b.id : newBandId(),
        type: 'notch',
        freqHz: clamp(freqHz, 1, 24000),
        gainDb: clamp(gainDb, -48, 0),
        q: clamp(q, 0.0001, 100),
      })
    }
  }

  if (!Array.isArray(raw.bands)) throw new CanonicalEqParseError('Missing bands array')

  const bands: EqBand[] = []
  for (let i = 0; i < raw.bands.length; i++) {
    const b = raw.bands[i]
    if (!b || typeof b !== 'object') throw new CanonicalEqParseError(`Invalid band at index ${i}`)
    if (!KINDS.has(String(b.type))) {
      throw new CanonicalEqParseError(`Invalid band type at index ${i}: ${b.type}`)
    }
    const freqHz = Number(b.freqHz)
    const gainDb = Number(b.gainDb)
    const q = Number(b.q)
    if (![freqHz, gainDb, q].every(Number.isFinite)) {
      throw new CanonicalEqParseError(`Invalid numeric fields at index ${i}`)
    }
    bands.push({
      id: typeof b.id === 'string' && b.id.length > 0 ? b.id : newBandId(),
      type: b.type as BiquadKind,
      freqHz: clamp(freqHz, 1, 24000),
      gainDb: clamp(gainDb, -48, 48),
      q: clamp(q, 0.0001, 100),
    })
  }

  const eq: CanonicalEq = {
    version: 1,
    meta: raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {},
    preampDb: 0,
    userMasterGainDb: clamp(userMasterGainDb, -60, 24),
    tiltDb: clamp(tiltDb, -18, 18),
    eqBypass,
    loudnessSignalMode,
    loudnessMatchQMode,
    loudnessMatchDb,
    sweepNotches,
    bands,
  }
  return withAutoPreamp(eq)
}

export function serializeCanonicalEq(eq: CanonicalEq, pretty = true): string {
  const normalized = withAutoPreamp(eq)
  const out = {
    version: normalized.version,
    meta: normalized.meta,
    preampDb: normalized.preampDb,
    userMasterGainDb: normalized.userMasterGainDb,
    tiltDb: normalized.tiltDb,
    eqBypass: normalized.eqBypass,
    loudnessSignalMode: normalized.loudnessSignalMode,
    loudnessMatchQMode: normalized.loudnessMatchQMode,
    loudnessMatchDb: { ...normalized.loudnessMatchDb },
    sweepNotches: normalized.sweepNotches.map(({ id, type, freqHz, gainDb, q }) => ({
      id,
      type,
      freqHz,
      gainDb,
      q,
    })),
    bands: normalized.bands.map(({ id, type, freqHz, gainDb, q }) => ({
      id,
      type,
      freqHz,
      gainDb,
      q,
    })),
  }
  return pretty ? `${JSON.stringify(out, null, 2)}\n` : `${JSON.stringify(out)}\n`
}
