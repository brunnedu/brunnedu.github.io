/**
 * Equalizer APO / Peace-style text export from the canonical profile.
 * `sw-*` notches export as PK with negative gain (matches browser preview), not NO.
 */

import { allBandsForChain, type CanonicalEq, type EqBand } from '../eq/canonicalEq'

function fcForPeace(hz: number): string {
  if (hz >= 10000) return `${Math.round(hz)} Hz`
  const rounded = Math.round(hz * 10) / 10
  return Number.isInteger(rounded) ? `${rounded} Hz` : `${rounded.toFixed(1)} Hz`
}

function fmtGain(db: number): string {
  const s = db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1)
  return `${s} dB`
}

function fmtQ(q: number): string {
  return q.toFixed(2).replace(/\.?0+$/, '')
}

type PeaceKind = 'LSC' | 'HSC' | 'PK' | 'NO'

function bandToPeaceLine(band: EqBand): { kind: PeaceKind; fc: string; gainDb: number; q: number } | null {
  const q = Math.max(band.q, 0.01)

  if (band.type === 'notch' && band.id.startsWith('sw-')) {
    return { kind: 'PK', fc: fcForPeace(band.freqHz), gainDb: band.gainDb, q }
  }

  switch (band.type) {
    case 'lowshelf':
      return { kind: 'LSC', fc: fcForPeace(band.freqHz), gainDb: band.gainDb, q }
    case 'highshelf':
      return { kind: 'HSC', fc: fcForPeace(band.freqHz), gainDb: band.gainDb, q }
    case 'peaking':
      if (band.id.startsWith('__lm_') && Math.abs(band.gainDb) < 0.01) return null
      return { kind: 'PK', fc: fcForPeace(band.freqHz), gainDb: band.gainDb, q }
    case 'notch':
      return { kind: 'NO', fc: fcForPeace(band.freqHz), gainDb: 0, q }
    default:
      return null
  }
}

/**
 * Build a Peace / Equalizer APO compatible config body.
 * Notes in DETAILED_PLAN: sample rate, coefficient rounding vs Web Audio.
 */
export function exportPeaceTxt(eq: CanonicalEq): string {
  const lines: string[] = [
    '# Self-EQ export — Equalizer APO / Peace',
    '# Order matches preview: tilt shelves, then shelves/peaking/notches by chain policy.',
    '# sw-* notches: exported as PK (negative gain) to match browser preview; JSON keeps type "notch".',
    '',
    `Preamp: ${eq.preampDb.toFixed(1)} dB`,
    '',
  ]

  const ordered = allBandsForChain(eq)
  let n = 0
  for (const band of ordered) {
    const row = bandToPeaceLine(band)
    if (!row) continue
    n += 1
    lines.push(
      `Filter: ON ${row.kind} Fc ${row.fc} Gain ${fmtGain(row.gainDb)} Q ${fmtQ(row.q)}`,
    )
  }

  if (n === 0) {
    lines.push('# (no biquad filters — preamp only)')
    lines.push('')
  }

  lines.push(
    '',
    '# userMasterGainDb is preview-only listening level — not applied here.',
  )
  return lines.join('\n')
}
