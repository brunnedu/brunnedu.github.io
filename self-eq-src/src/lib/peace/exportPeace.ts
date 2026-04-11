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

/** Q as in Room EQ Wizard / AutoEQ exports (two decimals) for Peace import compatibility. */
function fmtQ(q: number): string {
  return Math.max(q, 0.01).toFixed(2)
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
 * Build a Peace / Equalizer APO compatible config body (no `#` lines — Peace import is strict).
 * Format matches Equalizer APO wiki: `Preamp: … dB` and `Filter n: ON …` with 1-based indices.
 * Notch (`NO`) lines omit `Gain` (not in the APO parameter table for NO).
 * @see https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/
 */
function filterLine(
  index: number,
  row: { kind: PeaceKind; fc: string; gainDb: number; q: number },
): string {
  const head = `Filter ${index}: ON ${row.kind} Fc ${row.fc}`
  if (row.kind === 'NO') {
    return `${head} Q ${fmtQ(row.q)}`
  }
  return `${head} Gain ${fmtGain(row.gainDb)} Q ${fmtQ(row.q)}`
}

export function exportPeaceTxt(eq: CanonicalEq): string {
  const lines: string[] = [`Preamp: ${eq.preampDb.toFixed(1)} dB`]

  const ordered = allBandsForChain(eq)
  let index = 0
  for (const band of ordered) {
    const row = bandToPeaceLine(band)
    if (!row) continue
    index += 1
    lines.push(filterLine(index, row))
  }

  return `${lines.join('\n')}\n`
}
