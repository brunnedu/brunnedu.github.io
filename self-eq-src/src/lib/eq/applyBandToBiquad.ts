import type { EqBand } from './canonicalEq'

/**
 * Maps canonical band → Web Audio `BiquadFilterNode` (types that exist in the spec).
 */
export function applyBandToBiquad(node: BiquadFilterNode, band: EqBand): void {
  /** Sweep-derived “notches” use peaking cuts in preview so `gainDb` depth is audible (Peace exports as PK). */
  if (band.type === 'notch' && band.id.startsWith('sw-')) {
    node.type = 'peaking'
    node.frequency.value = band.freqHz
    node.Q.value = band.q
    node.gain.value = band.gainDb
    return
  }

  switch (band.type) {
    case 'lowshelf':
      node.type = 'lowshelf'
      break
    case 'highshelf':
      node.type = 'highshelf'
      break
    case 'peaking':
      node.type = 'peaking'
      break
    case 'notch':
      node.type = 'notch'
      break
  }
  node.frequency.value = band.freqHz
  node.Q.value = band.q
  node.gain.value = band.type === 'notch' ? 0 : band.gainDb
}
