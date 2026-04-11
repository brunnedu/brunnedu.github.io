<script lang="ts">
  import {
    allBandsForChain,
    TILT_PIVOT_HZ,
    type BiquadKind,
    type CanonicalEq,
    type EqBand,
  } from '../eq/canonicalEq'
  import type { LoudnessTestFreq } from '../eq/loudness'
  import { LOUDNESS_TEST_FREQS } from '../eq/loudness'

  let {
    eq,
    patch,
  }: {
    eq: CanonicalEq
    patch: (fn: (prev: CanonicalEq) => CanonicalEq) => void
  } = $props()

  const kindOptions: { value: BiquadKind; label: string }[] = [
    { value: 'peaking', label: 'Peaking' },
    { value: 'lowshelf', label: 'Lowshelf' },
    { value: 'highshelf', label: 'Highshelf' },
    { value: 'notch', label: 'Notch' },
  ]

  const rows = $derived(allBandsForChain(eq))
  const disabled = $derived(new Set(eq.disabledChainIds ?? []))

  function rowTitle(band: EqBand): string {
    if (band.id.startsWith('__tilt_low')) return `Tilt · Lowshelf @ ${TILT_PIVOT_HZ} Hz`
    if (band.id.startsWith('__tilt_high')) return `Tilt · Highshelf @ ${TILT_PIVOT_HZ} Hz`
    if (band.id.startsWith('__lm_')) return `Loudness · ${Math.round(band.freqHz)} Hz`
    if (band.id.startsWith('sw-')) return 'Sweep notch'
    const t = band.type
    const typeLabel = t === 'lowshelf' ? 'Lowshelf' : t === 'highshelf' ? 'Highshelf' : t === 'peaking' ? 'Peaking' : 'Notch'
    return `Band · ${typeLabel}`
  }

  function rowRole(band: EqBand): 'tilt' | 'loudness' | 'sweep' | 'user' {
    if (band.id.startsWith('__tilt_')) return 'tilt'
    if (band.id.startsWith('__lm_')) return 'loudness'
    if (band.id.startsWith('sw-')) return 'sweep'
    return 'user'
  }

  function lmFcFromId(id: string): LoudnessTestFreq | null {
    const m = /^__lm_(\d+)$/.exec(id)
    if (!m) return null
    const n = Number(m[1])
    const freqs = LOUDNESS_TEST_FREQS as readonly number[]
    return freqs.includes(n) ? (n as LoudnessTestFreq) : null
  }

  function setRowEnabled(id: string, enabled: boolean) {
    patch((prev) => {
      const s = new Set(prev.disabledChainIds ?? [])
      if (enabled) s.delete(id)
      else s.add(id)
      return { ...prev, disabledChainIds: [...s] }
    })
  }

  function patchUserBand(id: string, bandPatch: Partial<EqBand>) {
    patch((prev) => ({
      ...prev,
      bands: prev.bands.map((b) => (b.id === id ? { ...b, ...bandPatch } : b)),
    }))
  }

  function patchSweepNotch(id: string, bandPatch: Partial<EqBand>) {
    patch((prev) => ({
      ...prev,
      sweepNotches: prev.sweepNotches.map((b) => (b.id === id ? { ...b, ...bandPatch } : b)),
    }))
  }

  function patchLoudnessGain(fc: LoudnessTestFreq, gainDb: number) {
    const g = Math.min(0, Math.max(-24, gainDb))
    patch((prev) => ({
      ...prev,
      loudnessMatchDb: { ...prev.loudnessMatchDb, [fc]: g },
    }))
  }

  function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n))
  }
</script>

<div class="chain-inspector" aria-labelledby="chain-heading">
  <h3 id="chain-heading" class="chain-heading">Chain</h3>
  {#if eq.eqBypass}
    <p class="chain-bypass-note">EQ bypass on — flat curve.</p>
  {/if}
  <div class="chain-preamp" role="group" aria-label="Preamp">
    <span class="chain-preamp-label">Preamp</span>
    <span class="chain-preamp-val mono">{eq.preampDb.toFixed(1)} dB</span>
  </div>
  <ul class="chain-list">
    {#each rows as band (band.id)}
      {@const on = !disabled.has(band.id)}
      {@const role = rowRole(band)}
      {@const lmFc = lmFcFromId(band.id)}
      <li class="chain-row" class:chain-row-off={!on}>
        <label class="chain-enable">
          <input
            type="checkbox"
            checked={on}
            disabled={eq.eqBypass}
            aria-label={`${rowTitle(band)} in chain`}
            onchange={(e) => setRowEnabled(band.id, (e.currentTarget as HTMLInputElement).checked)}
          />
        </label>
        <div class="chain-body">
          <div class="chain-top">
            <div class="chain-text">
              <div class="chain-title">{rowTitle(band)}</div>
              <div class="chain-summary mono">
                {band.type} · {Math.round(band.freqHz)} Hz · {band.gainDb >= 0 ? '+' : ''}{band.gainDb.toFixed(1)} dB ·
                Q {band.q.toFixed(2)}
              </div>
            </div>
            {#if role === 'loudness' && on && lmFc != null}
              <label class="chain-inline-ctl">
                <span class="chain-inline-label">Gain</span>
                <input
                  type="number"
                  class="chain-num"
                  min="-24"
                  max="0"
                  step="0.5"
                  value={eq.loudnessMatchDb[lmFc]}
                  aria-label={`Loudness gain at ${lmFc} Hz, decibels, zero or less`}
                  onchange={(e) => patchLoudnessGain(lmFc, Number(e.currentTarget.value))}
                />
              </label>
            {/if}
          </div>
          {#if role === 'user' && on}
            <div class="chain-fields">
              <label class="chain-field">
                <span class="chain-field-label">Type</span>
                <select
                  value={band.type}
                  onchange={(e) =>
                    patchUserBand(band.id, { type: (e.currentTarget as HTMLSelectElement).value as BiquadKind })}
                >
                  {#each kindOptions as o}
                    <option value={o.value}>{o.label}</option>
                  {/each}
                </select>
              </label>
              <label class="chain-field">
                <span class="chain-field-label">Hz</span>
                <input
                  type="number"
                  class="chain-num"
                  min="20"
                  max="20000"
                  step="1"
                  value={Math.round(band.freqHz)}
                  onchange={(e) =>
                    patchUserBand(band.id, { freqHz: clamp(Number(e.currentTarget.value), 20, 20000) })}
                />
              </label>
              <label class="chain-field">
                <span class="chain-field-label">Gain</span>
                <input
                  type="number"
                  class="chain-num"
                  min="-24"
                  max="24"
                  step="0.5"
                  value={band.gainDb}
                  onchange={(e) =>
                    patchUserBand(band.id, { gainDb: clamp(Number(e.currentTarget.value), -24, 24) })}
                />
              </label>
              <label class="chain-field">
                <span class="chain-field-label">Q</span>
                <input
                  type="number"
                  class="chain-num"
                  min="0.1"
                  max="100"
                  step="0.05"
                  value={band.q}
                  onchange={(e) =>
                    patchUserBand(band.id, { q: clamp(Number(e.currentTarget.value), 0.1, 100) })}
                />
              </label>
            </div>
          {:else if role === 'sweep' && on}
            <div class="chain-fields">
              <label class="chain-field">
                <span class="chain-field-label">Hz</span>
                <input
                  type="number"
                  class="chain-num"
                  min="4000"
                  max="14000"
                  step="1"
                  value={Math.round(band.freqHz)}
                  onchange={(e) =>
                    patchSweepNotch(band.id, { freqHz: clamp(Number(e.currentTarget.value), 4000, 14000) })}
                />
              </label>
              <label class="chain-field">
                <span class="chain-field-label">Q</span>
                <input
                  type="number"
                  class="chain-num"
                  min="1"
                  max="40"
                  step="0.1"
                  value={band.q}
                  onchange={(e) =>
                    patchSweepNotch(band.id, { q: clamp(Number(e.currentTarget.value), 1, 40) })}
                />
              </label>
              <label class="chain-field">
                <span class="chain-field-label">Cut</span>
                <input
                  type="number"
                  class="chain-num"
                  min="-24"
                  max="-0.5"
                  step="0.5"
                  value={band.gainDb}
                  onchange={(e) =>
                    patchSweepNotch(band.id, { gainDb: clamp(Number(e.currentTarget.value), -24, -0.5) })}
                />
              </label>
            </div>
          {:else if role === 'tilt'}
            <p class="chain-hint">Change tilt in Listening & Tilt.</p>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  /* Uses global tokens from app.css — no light-theme fallbacks on --surface (was forcing white cards in dark mode). */
  .chain-inspector {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    color: var(--text);
  }

  .chain-heading {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-h);
  }

  .chain-bypass-note {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: var(--text);
    line-height: 1.4;
  }

  .chain-preamp {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.6rem;
    font-size: 0.78rem;
    margin: 0;
    padding: 0.35rem 0 0.45rem;
    border-bottom: 1px solid var(--border);
    background: transparent;
  }

  .chain-preamp-label {
    font-weight: 600;
    color: var(--text-h);
  }

  .chain-preamp-val {
    font-variant-numeric: tabular-nums;
    color: var(--text-h);
  }

  .mono {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .chain-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    max-height: min(42vh, 22rem);
    overflow-y: auto;
  }

  /* List rows: flat dividers, no card chrome. Checkbox column vertically centered vs. body. */
  .chain-row {
    display: grid;
    grid-template-columns: 1.125rem minmax(0, 1fr);
    column-gap: 0.5rem;
    align-items: start;
    padding: 0.28rem 0;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--text);
  }

  .chain-row:last-child {
    border-bottom: none;
  }

  .chain-row-off {
    opacity: 0.52;
  }

  .chain-enable {
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin: 0;
    cursor: pointer;
  }

  .chain-enable input {
    width: 0.95rem;
    height: 0.95rem;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .chain-enable input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .chain-body {
    min-width: 0;
  }

  .chain-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.35rem 0.5rem;
  }

  .chain-text {
    min-width: 0;
    flex: 1 1 8rem;
  }

  .chain-title {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-h);
    line-height: 1.2;
  }

  .chain-summary {
    font-size: 0.65rem;
    color: var(--text);
    margin-top: 0.06rem;
    line-height: 1.3;
    word-break: break-word;
  }

  .chain-inline-ctl {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.28rem;
    flex-shrink: 0;
    margin: 0;
    padding-top: 0.05rem;
  }

  .chain-inline-label {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
  }

  .chain-fields {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.45rem;
    margin-top: 0.28rem;
    padding-left: 0.05rem;
  }

  .chain-field {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.22rem;
    margin: 0;
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text);
  }

  .chain-field-label {
    color: var(--text);
    white-space: nowrap;
  }

  .chain-field select,
  .chain-num {
    font: inherit;
    font-size: 0.7rem;
    padding: 0.14rem 0.28rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-h);
    min-height: 1.35rem;
    box-sizing: border-box;
  }

  .chain-field select {
    max-width: 5.5rem;
    padding-right: 0.2rem;
  }

  .chain-num {
    width: 3.35rem;
    max-width: 4.5rem;
  }

  .chain-inline-ctl .chain-num {
    width: 3.1rem;
  }

  .chain-field select:focus,
  .chain-num:focus {
    outline: 2px solid var(--accent-border);
    outline-offset: 1px;
  }

  .chain-field select:disabled,
  .chain-num:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .chain-hint {
    margin: 0.22rem 0 0;
    font-size: 0.68rem;
    color: var(--text);
    line-height: 1.35;
  }
</style>
