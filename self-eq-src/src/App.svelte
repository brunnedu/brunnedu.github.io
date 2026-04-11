<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { PreviewAudioEngine } from './lib/audio/previewEngine'
  import {
    allBandsForChain,
    CanonicalEqParseError,
    defaultCanonicalEq,
    newBandId,
    parseCanonicalEqJson,
    serializeCanonicalEq,
    TILT_PIVOT_HZ,
    withAutoPreamp,
    type CanonicalEq,
    type EqBand,
    type BiquadKind,
    type LoudnessMatchQMode,
    type LoudnessSignalMode,
  } from './lib/eq/canonicalEq'
  import {
    LOUDNESS_REFERENCE_HZ,
    LOUDNESS_TEST_FREQS,
    type LoudnessCalRoute,
    type LoudnessTestFreq,
  } from './lib/eq/loudness'
  import {
    freqFromNormalizedT,
    MAX_SWEEP_NOTCHES,
    notchParamsFromMarkFrequencies,
    SWEEP_DURATION_PRESETS,
    type SweepDurationPreset,
    SWEEP_F0_HZ,
    SWEEP_F1_HZ,
  } from './lib/eq/sweep'
  import ResponsePlot from './lib/viz/ResponsePlot.svelte'
  import { exportPeaceTxt } from './lib/peace/exportPeace'

  const engine = new PreviewAudioEngine()

  let eq = $state(withAutoPreamp(defaultCanonicalEq()))
  let contextLabel = $state('suspended')
  let errorMessage = $state<string | null>(null)
  let importMessage = $state<string | null>(null)
  let pinkPlaying = $state(false)
  let levelLocked = $state(false)

  let calPlaying = $state(false)
  let calRoute = $state<LoudnessCalRoute>('reference')
  let calTestFreq = $state<LoudnessTestFreq>(3000)

  let sweepPlayingUi = $state(false)
  let sweepUiTimer: ReturnType<typeof setTimeout> | null = null
  let markStartSample = $state<{ freqHz: number; elapsedSec: number } | null>(null)
  let sweepMessage = $state<string | null>(null)
  let sweepCursorHz = $state<number | null>(null)
  let plotSampleRate = $state(48000)
  let reducedMotionPref = $state(false)

  let sweepDurationSec = $state<SweepDurationPreset>(30)
  /** Normalized sweep position 0…1 (scrub / play start). */
  let sweepNormT = $state(0)
  let sweepScrubbing = $state(false)
  /** Manual sine preview after scrub (keeps playing at release — use Stop to silence). */
  let sweepManualPreviewUi = $state(false)

  let comparisonLoopOn = $state(false)
  let comparisonSegmentSec = $state(1.5)

  let musicPlaying = $state(false)
  let musicStatus = $state<string | null>(null)
  let musicLoadedOk = $state(false)

  let fileInput: HTMLInputElement | undefined = undefined
  let musicFileInput: HTMLInputElement | undefined = undefined

  function loudnessCalPayload() {
    return {
      playing: calPlaying,
      route: calRoute,
      testFreq: calTestFreq,
      signalMode: eq.loudnessSignalMode,
    }
  }

  const chainPreview = $derived(
    eq.eqBypass
      ? ['(flat — EQ bypassed)']
      : allBandsForChain(eq).map((b) =>
          b.id.startsWith('__tilt_')
            ? `tilt:${b.type}@${Math.round(b.freqHz)}Hz`
            : b.id.startsWith('__lm_')
              ? `lm:${Math.round(b.freqHz)}Hz`
              : b.id.startsWith('sw-')
                ? `sw:${Math.round(b.freqHz)}Hz`
                : `${b.type}@${Math.round(b.freqHz)}Hz`,
        ),
  )

  function syncEngine() {
    if (engine.getContextState() === 'suspended') return
    engine.applyCanonicalEq(eq)
    engine.setUserMasterFromCanonical(eq.userMasterGainDb)
    engine.applyLoudnessCal(loudnessCalPayload())
  }

  function pushLoudnessCalOnly() {
    if (engine.getContextState() === 'suspended') return
    engine.applyLoudnessCal(loudnessCalPayload())
  }

  function setEq(next: CanonicalEq) {
    eq = withAutoPreamp(next)
    syncEngine()
  }

  function syncFromEngine() {
    contextLabel = engine.getContextState()
    levelLocked = engine.isLevelLocked()
    pinkPlaying = engine.isPinkAudible()
    if (contextLabel !== 'suspended') {
      plotSampleRate = engine.getSampleRate()
    }
  }

  async function initAudio() {
    errorMessage = null
    try {
      await engine.ensureReady()
      engine.setMasterGainDb(eq.userMasterGainDb)
      syncEngine()
      engine.setPinkAudible(pinkPlaying)
      syncFromEngine()
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e)
    }
  }

  function togglePink() {
    if (sweepPlayingUi) stopUserSweep()
    pinkPlaying = !pinkPlaying
    if (pinkPlaying) calPlaying = false
    engine.setPinkAudible(pinkPlaying)
    pushLoudnessCalOnly()
    syncFromEngine()
  }

  function onMasterInput(e: Event) {
    const v = Number((e.target as HTMLInputElement).value)
    setEq({ ...eq, userMasterGainDb: v })
    engine.setMasterGainDb(v)
    syncFromEngine()
  }

  function lockLevel() {
    engine.lockLevel()
    syncFromEngine()
  }

  function unlockLevel() {
    engine.unlockLevel()
    syncFromEngine()
  }

  function updateBand(id: string, patch: Partial<EqBand>) {
    setEq({
      ...eq,
      bands: eq.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })
  }

  function addBand() {
    setEq({
      ...eq,
      bands: [
        ...eq.bands,
        { id: newBandId(), type: 'peaking' as const, freqHz: 1000, gainDb: 0, q: 1 },
      ],
    })
  }

  function removeBand(id: string) {
    if (eq.bands.length <= 1) return
    setEq({
      ...eq,
      bands: eq.bands.filter((b) => b.id !== id),
    })
  }

  function onTiltInput(e: Event) {
    const v = Number((e.target as HTMLInputElement).value)
    setEq({ ...eq, tiltDb: v })
  }

  function toggleBypass() {
    setEq({ ...eq, eqBypass: !eq.eqBypass })
  }

  function clearSweepUiTimer() {
    if (sweepUiTimer !== null) {
      clearTimeout(sweepUiTimer)
      sweepUiTimer = null
    }
  }

  function stopUserSweep() {
    clearSweepUiTimer()
    engine.stopLogSweep()
    engine.stopSweepManualPreview()
    sweepManualPreviewUi = false
    sweepPlayingUi = false
    markStartSample = null
    pushLoudnessCalOnly()
    syncFromEngine()
  }

  function replaySweep() {
    if (contextLabel === 'suspended') return
    sweepMessage = null
    calPlaying = false
    comparisonLoopOn = false
    pushLoudnessCalOnly()
    clearSweepUiTimer()
    engine.stopLogSweep()
    engine.stopSweepManualPreview()
    sweepManualPreviewUi = false
    markStartSample = null
    sweepPlayingUi = true
    engine.startLogSweep(sweepDurationSec, sweepNormT)
    const ms = sweepDurationSec * 1000
    const remainFrac = Math.max(0, 1 - sweepNormT)
    sweepUiTimer = setTimeout(() => {
      sweepUiTimer = null
      sweepPlayingUi = false
      engine.setPinkAudible(pinkPlaying)
      pushLoudnessCalOnly()
      syncFromEngine()
    }, remainFrac * ms + 120)
  }

  function markSweepStart() {
    sweepMessage = null
    const s = engine.getSweepMarkSample()
    if (!s) {
      sweepMessage = 'Play the sweep first, then click while it is running.'
      return
    }
    markStartSample = s
    sweepMessage = `Start marked ≈ ${Math.round(s.freqHz)} Hz — click Mark end past the peak.`
  }

  function markSweepEnd() {
    sweepMessage = null
    const end = engine.getSweepMarkSample()
    if (!markStartSample || !end) {
      sweepMessage = 'Mark start first, then mark end while the sweep is still running.'
      return
    }
    if (end.elapsedSec <= markStartSample.elapsedSec) {
      sweepMessage = 'End must be after start in time (try Replay sweep).'
      return
    }
    if (eq.sweepNotches.length >= MAX_SWEEP_NOTCHES) {
      sweepMessage = `Maximum ${MAX_SWEEP_NOTCHES} resonance notches.`
      return
    }
    const p = notchParamsFromMarkFrequencies(markStartSample.freqHz, end.freqHz)
    markStartSample = null
    const band: EqBand = {
      id: `sw-${newBandId()}`,
      type: 'notch',
      freqHz: p.freqHz,
      q: p.q,
      gainDb: p.gainDb,
    }
    setEq({ ...eq, sweepNotches: [...eq.sweepNotches, band] })
    sweepMessage = `Added notch ≈ ${Math.round(p.freqHz)} Hz — refine cut / Q / frequency below.`
  }

  function updateSweepNotch(id: string, patch: Partial<EqBand>) {
    setEq({
      ...eq,
      sweepNotches: eq.sweepNotches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })
  }

  function removeSweepNotch(id: string) {
    setEq({
      ...eq,
      sweepNotches: eq.sweepNotches.filter((b) => b.id !== id),
    })
  }

  function toggleCalPlay() {
    calPlaying = !calPlaying
    if (!calPlaying) comparisonLoopOn = false
    if (calPlaying) {
      stopUserSweep()
      engine.setPinkAudible(false)
    } else if (pinkPlaying) {
      engine.setPinkAudible(true)
    }
    pushLoudnessCalOnly()
    syncFromEngine()
  }

  function setCalRoute(r: LoudnessCalRoute) {
    calRoute = r
    pushLoudnessCalOnly()
  }

  function setCalTestFreq(f: LoudnessTestFreq) {
    calTestFreq = f
    pushLoudnessCalOnly()
  }

  function onLoudnessSignalModeChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value as LoudnessSignalMode
    setEq({ ...eq, loudnessSignalMode: v })
  }

  function onLoudnessCorrectionInput(e: Event) {
    const raw = Number((e.currentTarget as HTMLInputElement).value)
    const v = Math.min(0, raw)
    setEq({
      ...eq,
      loudnessMatchDb: { ...eq.loudnessMatchDb, [calTestFreq]: v },
    })
  }

  function onLoudnessQModeChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value as LoudnessMatchQMode
    setEq({ ...eq, loudnessMatchQMode: v })
  }

  function onSweepDurationPick(sec: SweepDurationPreset) {
    sweepDurationSec = sec
  }

  function onSweepSliderInput(e: Event) {
    const t = Number((e.currentTarget as HTMLInputElement).value)
    sweepNormT = t
    if (contextLabel === 'suspended') return
    if (sweepPlayingUi) {
      engine.seekLogSweep(t)
    } else {
      engine.setSweepManualHz(freqFromNormalizedT(t, sweepDurationSec))
      sweepManualPreviewUi = true
    }
  }

  function onSweepSliderPointerDown() {
    sweepScrubbing = true
  }

  function onSweepSliderPointerUp() {
    sweepScrubbing = false
  }

  async function onMusicFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    musicStatus = 'Decoding…'
    musicLoadedOk = false
    try {
      const ab = await file.arrayBuffer()
      await engine.ensureReady()
      const buf = await engine.decodeMusicFile(ab)
      engine.loadUserMusic(buf)
      musicLoadedOk = true
      musicStatus = `Loaded “${file.name}”. Use Play / stop below.`
      if (musicPlaying) engine.setMusicAudible(true)
    } catch (err) {
      musicStatus = err instanceof Error ? err.message : 'Could not decode audio.'
      musicLoadedOk = false
    }
  }

  function toggleMusic() {
    if (contextLabel === 'suspended') return
    musicPlaying = !musicPlaying
    engine.setMusicAudible(musicPlaying)
    syncFromEngine()
  }

  function clearLoadedMusic() {
    musicPlaying = false
    musicLoadedOk = false
    engine.stopUserMusic()
    musicStatus = null
    syncFromEngine()
  }

  function resetLoudnessBand() {
    setEq({
      ...eq,
      loudnessMatchDb: { ...eq.loudnessMatchDb, [calTestFreq]: 0 },
    })
  }

  function downloadJson() {
    const blob = new Blob([serializeCanonicalEq(eq, true)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'self-eq-profile.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadPeaceTxt() {
    const blob = new Blob([exportPeaceTxt(eq)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'self-eq-peace.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function triggerImport() {
    importMessage = null
    fileInput?.click()
  }

  function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const parsed = parseCanonicalEqJson(text)
        engine.unlockLevel()
        levelLocked = false
        eq = withAutoPreamp(parsed)
        calPlaying = false
        clearSweepUiTimer()
        sweepPlayingUi = false
        markStartSample = null
        engine.stopLogSweep()
        engine.stopSweepManualPreview()
        sweepManualPreviewUi = false
        engine.stopUserMusic()
        musicPlaying = false
        musicLoadedOk = false
        musicStatus = null
        syncEngine()
        engine.setMasterGainDb(eq.userMasterGainDb)
        importMessage = 'Profile imported.'
      } catch (err) {
        importMessage =
          err instanceof CanonicalEqParseError ? err.message : 'Could not read profile file.'
      }
    }
    reader.readAsText(file)
  }

  const kindOptions: { value: BiquadKind; label: string }[] = [
    { value: 'lowshelf', label: 'Low shelf' },
    { value: 'highshelf', label: 'High shelf' },
    { value: 'peaking', label: 'Peaking' },
    { value: 'notch', label: 'Notch' },
  ]

  $effect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionPref = mq.matches
    const onChange = () => {
      reducedMotionPref = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  })

  /**
   * Comparison loop must not read `eq` inside the effect body (untracked), or any EQ/prop change
   * would re-run the effect, clear the interval, and snap back to reference every time.
   */
  $effect(() => {
    if (!calPlaying || !comparisonLoopOn) return
    const segmentMs = Math.max(500, comparisonSegmentSec * 1000)
    let refPhase = true
    calRoute = 'reference'
    untrack(() => pushLoudnessCalOnly())
    const id = window.setInterval(() => {
      refPhase = !refPhase
      calRoute = refPhase ? 'reference' : 'test'
      untrack(() => pushLoudnessCalOnly())
    }, segmentMs)
    return () => clearInterval(id)
  })

  $effect(() => {
    if (!sweepPlayingUi) {
      sweepCursorHz = null
      return
    }
    let rafId = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    const tick = () => {
      const s = engine.getSweepMarkSample()
      sweepCursorHz = s?.freqHz ?? null
      if (s && !sweepScrubbing) {
        const T = engine.getSweepDurationSec()
        if (T > 0) sweepNormT = s.elapsedSec / T
      }
    }
    tick()
    if (reducedMotionPref) {
      intervalId = setInterval(tick, 250)
      return () => {
        if (intervalId !== null) clearInterval(intervalId)
      }
    }
    const loop = () => {
      tick()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  })

  onDestroy(() => {
    clearSweepUiTimer()
    engine.dispose()
  })
</script>

<main class="shell">
  <header class="header">
    <h1>Self-EQ</h1>
    <p class="lede">
      Self-EQ: all three calibration UIs — <strong>tilt</strong>, <strong>loudness matching</strong>, and
      <strong>treble sweep</strong> (5–12 kHz) with resonance notches — plus parametric bands and JSON profiles.
    </p>
  </header>

  <section class="panel" aria-labelledby="audio-eng-heading">
    <h2 id="audio-eng-heading">Audio engine</h2>
    <p class="hint">
      Browsers require a click to start audio. Set <strong>your device / system volume</strong> to a comfortable
      level once and keep it there for the whole session. <strong>Preamp</strong> is computed from band gains
      (negative of the largest boost) to reduce clipping.
    </p>

    {#if errorMessage}
      <p class="error" role="alert">{errorMessage}</p>
    {/if}

    <div class="actions">
      <button type="button" class="primary" onclick={initAudio}>Start audio</button>
      <button type="button" onclick={togglePink} disabled={contextLabel === 'suspended'}>
        {pinkPlaying ? 'Stop pink noise' : 'Play pink noise'}
      </button>
    </div>

    <p class="meta">
      Context: <code>{contextLabel}</code> · Preamp: <code>{eq.preampDb.toFixed(1)} dB</code>
      {#if eq.eqBypass}
        <span class="bypass-badge">not applied (bypass)</span>
      {/if}
    </p>

    <details class="advanced-audio">
      <summary>Advanced — in-app level trim & lock</summary>
      <p class="hint advanced-hint">
        Prefer hardware volume above. Use this only if the signal is too quiet or you need a fixed trim for
        accessibility. <strong>Lock</strong> freezes this trim during loudness matching.
      </p>
      <div class="control">
        <label for="master-gain">In-app trim (dB)</label>
        <input
          id="master-gain"
          type="range"
          min="-24"
          max="12"
          step="0.5"
          value={eq.userMasterGainDb}
          disabled={levelLocked}
          oninput={onMasterInput}
        />
        <span class="value">{eq.userMasterGainDb.toFixed(1)} dB</span>
      </div>
      <div class="lock-row">
        {#if !levelLocked}
          <button type="button" onclick={lockLevel} disabled={contextLabel === 'suspended'}>
            Lock trim for calibration
          </button>
        {:else}
          <button type="button" class="warn" onclick={unlockLevel}>Unlock trim</button>
          <span class="locked-note">In-app trim is locked.</span>
        {/if}
      </div>
    </details>
  </section>

  <section class="panel" aria-labelledby="phase1-heading">
    <h2 id="phase1-heading">Phase 1 — Spectral tilt (pink noise)</h2>
    <p class="hint">
      Adjust until pink noise sounds like a balanced “waterfall” — not too dark, not too piercing. Tilt uses a
      low-Q <strong>lowshelf</strong> and <strong>highshelf</strong> both at {TILT_PIVOT_HZ} Hz (half the tilt
      value each) ahead of your parametric bands. Use <strong>Bypass EQ</strong> to compare flat playback at
      the same listening level (device volume).
    </p>
    <div class="control">
      <label for="tilt">Tilt (dB)</label>
      <input
        id="tilt"
        type="range"
        min="-12"
        max="12"
        step="0.5"
        value={eq.tiltDb}
        oninput={onTiltInput}
      />
      <span class="value">{eq.tiltDb >= 0 ? '+' : ''}{eq.tiltDb.toFixed(1)} dB</span>
    </div>
    <p class="tilt-scale" aria-hidden="true">
      <span class:tilt-hl={eq.tiltDb < -0.5}>Darker</span>
      <span class:tilt-hl={Math.abs(eq.tiltDb) <= 0.5}>Neutral</span>
      <span class:tilt-hl={eq.tiltDb > 0.5}>Brighter</span>
    </p>
    <label class="bypass-label">
      <input type="checkbox" checked={eq.eqBypass} onchange={() => toggleBypass()} />
      Bypass EQ (flat pink at master gain)
    </label>
  </section>

  <section class="panel" aria-labelledby="phase4-heading">
    <h2 id="phase4-heading">Phase 2 — Loudness matching (ear-gain)</h2>
    <p class="hint">
      Keep <strong>device volume</strong> fixed. Corrections are <strong>cuts only (≤ 0 dB)</strong> so you match by
      attenuating each test band toward the reference — boosts would fight the preamp headroom rule and feel confusing.
      Gain is applied only via the <strong>lm peaking band</strong> for that frequency. Stimulus is
      <strong>1/3-octave</strong> noise by default or a <strong>sine</strong>. Pink and calibration cancel each other.
    </p>
    <div class="actions">
      <button
        type="button"
        onclick={toggleCalPlay}
        disabled={contextLabel === 'suspended' || sweepPlayingUi}
      >
        {calPlaying ? 'Stop calibration tone' : 'Play calibration tone'}
      </button>
    </div>
    <label class="signal-mode">
      Stimulus
      <select value={eq.loudnessSignalMode} onchange={onLoudnessSignalModeChange}>
        <option value="narrowband">Narrowband noise (1/3 oct)</option>
        <option value="tone">Pure tone</option>
      </select>
    </label>
    <label class="signal-mode">
      Correction band width (Q)
      <select value={eq.loudnessMatchQMode} onchange={onLoudnessQModeChange}>
        <option value="wide">Wide (gentlest)</option>
        <option value="standard">Standard (default)</option>
        <option value="narrow">Narrow (legacy)</option>
      </select>
    </label>
    <div class="comparison-loop">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={comparisonLoopOn}
          disabled={!calPlaying}
          onchange={(e) => {
            comparisonLoopOn = (e.currentTarget as HTMLInputElement).checked
          }}
        />
        Comparison loop — alternate reference / test every
        <input
          type="number"
          class="seg-input"
          min="0.5"
          max="5"
          step="0.25"
          value={comparisonSegmentSec}
          disabled={!calPlaying}
          oninput={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value)
            if (Number.isFinite(v)) comparisonSegmentSec = Math.min(5, Math.max(0.5, v))
          }}
        />
        s
      </label>
      <p class="hint loop-hint">
        While on, alternates <strong>reference</strong> and <strong>test</strong> for the same length each (the number
        of seconds above). You can still pick the test band below; the loop overrides Reference / Test while it runs.
      </p>
    </div>
    <fieldset class="cal-route">
      <legend>Route {comparisonLoopOn ? '(overridden while loop is on)' : ''}</legend>
      <label class="radio-row">
        <input
          type="radio"
          name="cal-route"
          checked={calRoute === 'reference'}
          onchange={() => setCalRoute('reference')}
        />
        Reference {LOUDNESS_REFERENCE_HZ} Hz
      </label>
      <label class="radio-row">
        <input
          type="radio"
          name="cal-route"
          checked={calRoute === 'test'}
          onchange={() => setCalRoute('test')}
        />
        Test band
      </label>
    </fieldset>
    {#if calRoute === 'test' || comparisonLoopOn}
      <div class="test-freq-row" role="group" aria-label="Test frequency">
        {#each LOUDNESS_TEST_FREQS as f (f)}
          <button
            type="button"
            class="chip"
            class:chip-active={calTestFreq === f}
            onclick={() => setCalTestFreq(f)}
          >
            {f} Hz
          </button>
        {/each}
      </div>
      <div class="control">
        <label for="lm-corr">Cut at {calTestFreq} Hz (dB, ≤ 0)</label>
        <input
          id="lm-corr"
          type="range"
          min="-18"
          max="0"
          step="0.5"
          value={eq.loudnessMatchDb[calTestFreq]}
          oninput={onLoudnessCorrectionInput}
        />
        <span class="value">{eq.loudnessMatchDb[calTestFreq].toFixed(1)} dB</span>
      </div>
      <button type="button" class="small reset-band" onclick={resetLoudnessBand}>Reset this band</button>
    {/if}
  </section>

  <section class="panel" aria-labelledby="phase5-heading">
    <h2 id="phase5-heading">Phase 3 — Resonance sweep (5–12 kHz)</h2>
    <p class="hint">
      Log sine sweep <strong>{SWEEP_F0_HZ}–{SWEEP_F1_HZ} Hz</strong>. Pick a <strong>duration</strong>, use the
      <strong>position</strong> slider to explore or seek — the sine <strong>stays on</strong> at that frequency after
      you release (including 12 kHz); use <strong>Stop preview tone</strong> to silence. Seeks while auto sweep plays.
      Play starts from the current slider position. While playing, <strong>Mark start</strong> /
      <strong>Mark end</strong> (up to
      {MAX_SWEEP_NOTCHES} notches). <code>sw-*</code> use a peaking cut in preview; JSON keeps <code>type: notch</code>.
      Stops pink/cal while running.
    </p>
    <div class="sweep-duration-row" role="group" aria-label="Sweep duration">
      {#each SWEEP_DURATION_PRESETS as sec (sec)}
        <button
          type="button"
          class="chip"
          class:chip-active={sweepDurationSec === sec}
          onclick={() => onSweepDurationPick(sec)}
        >
          {sec}s
        </button>
      {/each}
    </div>
    <div class="control sweep-pos-control">
      <label for="sweep-pos">Sweep position (start / scrub)</label>
      <input
        id="sweep-pos"
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={sweepNormT}
        disabled={contextLabel === 'suspended'}
        onpointerdown={onSweepSliderPointerDown}
        onpointerup={onSweepSliderPointerUp}
        oninput={onSweepSliderInput}
      />
      <span class="value mono"
        >{Math.round(freqFromNormalizedT(sweepNormT, sweepDurationSec))} Hz</span
      >
    </div>
    <div class="actions">
      <button type="button" onclick={replaySweep} disabled={contextLabel === 'suspended' || calPlaying}>
        {sweepPlayingUi ? 'Replay sweep' : 'Play / replay sweep'}
      </button>
      <button
        type="button"
        onclick={stopUserSweep}
        disabled={contextLabel === 'suspended' || (!sweepPlayingUi && !sweepManualPreviewUi)}
      >
        {sweepPlayingUi ? 'Stop sweep' : 'Stop preview tone'}
      </button>
      <button type="button" onclick={markSweepStart} disabled={!sweepPlayingUi}>Mark start</button>
      <button type="button" onclick={markSweepEnd} disabled={!sweepPlayingUi}>Mark end</button>
    </div>
    {#if sweepMessage}
      <p class="sweep-msg" role="status">{sweepMessage}</p>
    {/if}
    {#if eq.sweepNotches.length > 0}
      <h3 class="subheading-small">Sweep notches (refine)</h3>
      <div class="band-list">
        {#each eq.sweepNotches as notch (notch.id)}
          <fieldset class="band-card sweep-notch-card">
            <legend>Notch</legend>
            <div class="band-row">
              <button type="button" class="small danger" onclick={() => removeSweepNotch(notch.id)}>Remove</button>
            </div>
            <div class="band-sliders">
              <label>
                Hz
                <input
                  type="range"
                  min="4000"
                  max="14000"
                  step="1"
                  value={notch.freqHz}
                  oninput={(e) =>
                    updateSweepNotch(notch.id, { freqHz: Number((e.currentTarget as HTMLInputElement).value) })}
                />
                <span class="mono">{Math.round(notch.freqHz)}</span>
              </label>
              <label>
                Q
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="0.1"
                  value={notch.q}
                  oninput={(e) =>
                    updateSweepNotch(notch.id, { q: Number((e.currentTarget as HTMLInputElement).value) })}
                />
                <span class="mono">{notch.q.toFixed(1)}</span>
              </label>
              <label>
                Cut (dB)
                <input
                  type="range"
                  min="-24"
                  max="-0.5"
                  step="0.5"
                  value={notch.gainDb}
                  oninput={(e) =>
                    updateSweepNotch(notch.id, { gainDb: Number((e.currentTarget as HTMLInputElement).value) })}
                />
                <span class="mono">{notch.gainDb.toFixed(1)}</span>
              </label>
            </div>
          </fieldset>
        {/each}
      </div>
    {/if}
  </section>

  <section class="panel" aria-labelledby="peq-heading">
    <h2 id="peq-heading">Parametric EQ chain</h2>
    <p class="hint">
      Order: tilt → loudness peaks + your shelves/peaking → sweep notches (<code>sw-*</code>) with other notches by
      frequency. Preamp includes all boosts.
    </p>
    <p class="chain-preview" aria-label="Processing order">
      Order: {chainPreview.length ? chainPreview.join(' → ') : '(none)'}
    </p>

    <div class="band-list">
      {#each eq.bands as band (band.id)}
        <fieldset class="band-card">
          <legend>Band</legend>
          <div class="band-row">
            <label>
              Type
              <select
                value={band.type}
                onchange={(e) => updateBand(band.id, { type: (e.currentTarget as HTMLSelectElement).value as BiquadKind })}
              >
                {#each kindOptions as o}
                  <option value={o.value}>{o.label}</option>
                {/each}
              </select>
            </label>
            <button type="button" class="small danger" onclick={() => removeBand(band.id)} disabled={eq.bands.length <= 1}>
              Remove
            </button>
          </div>
          <div class="band-sliders">
            <label>
              Hz
              <input
                type="range"
                min="20"
                max="20000"
                step="1"
                value={band.freqHz}
                oninput={(e) => updateBand(band.id, { freqHz: Number((e.currentTarget as HTMLInputElement).value) })}
              />
              <span class="mono">{Math.round(band.freqHz)}</span>
            </label>
            <label>
              Q
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.05"
                value={band.q}
                oninput={(e) => updateBand(band.id, { q: Number((e.currentTarget as HTMLInputElement).value) })}
              />
              <span class="mono">{band.q.toFixed(2)}</span>
            </label>
            <label>
              Gain (dB)
              <input
                type="range"
                min="-24"
                max="24"
                step="0.5"
                value={band.gainDb}
                oninput={(e) => updateBand(band.id, { gainDb: Number((e.currentTarget as HTMLInputElement).value) })}
              />
              <span class="mono">{band.gainDb.toFixed(1)}</span>
            </label>
          </div>
        </fieldset>
      {/each}
    </div>

    <button type="button" class="add-band" onclick={addBand}>Add band</button>
  </section>

  <section class="panel" aria-labelledby="viz-heading">
    <h2 id="viz-heading">Phase 6 — Target curve & Peace export</h2>
    <p class="hint">
      Combined magnitude (preamp + biquad chain) at <strong>{plotSampleRate} Hz</strong> sample rate for the plot.
      During a sweep, the vertical line follows the sweep; after <strong>Mark start</strong>, the shaded band spans
      start → current sweep frequency. With <strong>prefers-reduced-motion</strong>, the cursor updates less often.
    </p>
    <ResponsePlot
      {eq}
      sampleRate={plotSampleRate}
      sweepCursorHz={sweepCursorHz}
      markStartHz={markStartSample?.freqHz ?? null}
      reducedMotion={reducedMotionPref}
    />
    <p class="hint peace-hint">
      <strong>Peace / Equalizer APO</strong> export uses the same band order as the preview.
      <code>sw-*</code> notches are written as <strong>PK</strong> with negative gain (not NO) so depth matches the
      browser. Rounding and host sample rate may differ slightly from Web Audio; spot-check in Peace.
    </p>
    <div class="actions">
      <button type="button" onclick={downloadPeaceTxt}>Download Peace / APO (.txt)</button>
    </div>
  </section>

  <section class="panel" aria-labelledby="music-heading">
    <h2 id="music-heading">Reference music (your file)</h2>
    <p class="hint">
      Load a short lossless or high-quality track you know well. It plays through the <strong>same EQ chain</strong> as
      pink noise. Use <strong>Bypass EQ</strong> in Phase 1 to A/B timbre at a fixed device volume (in-app trim is
      optional).
    </p>
    <div class="actions">
      <button type="button" onclick={() => musicFileInput?.click()} disabled={contextLabel === 'suspended'}>
        Load audio file…
      </button>
      <input
        bind:this={musicFileInput}
        type="file"
        accept="audio/*,.wav,.flac,.mp3,.ogg,.m4a,audio/wav,audio/flac,audio/mpeg"
        class="sr-only"
        onchange={onMusicFile}
      />
      <button type="button" onclick={toggleMusic} disabled={contextLabel === 'suspended' || !musicLoadedOk}>
        {musicPlaying ? 'Stop music' : 'Play music'}
      </button>
      <button type="button" class="small danger" onclick={clearLoadedMusic} disabled={!musicLoadedOk}>Clear file</button>
    </div>
    {#if musicStatus}
      <p class="import-msg" role="status">{musicStatus}</p>
    {/if}
  </section>

  <section class="panel" aria-labelledby="io-heading">
    <h2 id="io-heading">Profile JSON</h2>
    <p class="hint">
      Includes <code>tiltDb</code>, <code>eqBypass</code>, <code>loudnessSignalMode</code>, <code>loudnessMatchQMode</code>,
      <code>loudnessMatchDb</code> (cuts ≤ 0 dB),
      <code>sweepNotches</code> (max {MAX_SWEEP_NOTCHES}), and <code>bands</code>. <code>eqBypass</code> is preview-only.
    </p>
    <div class="actions">
      <button type="button" onclick={downloadJson}>Download JSON</button>
      <button type="button" onclick={triggerImport}>Import JSON…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" onchange={onImportFile} />
    </div>
    {#if importMessage}
      <p class="import-msg" role="status">{importMessage}</p>
    {/if}
  </section>

  <footer class="footer">
    <a href="../">← Site home</a>
  </footer>
</main>

<style>
  .shell {
    max-width: 42rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    text-align: left;
  }

  .header h1 {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
  }

  .lede {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .panel {
    margin-top: 1.75rem;
    padding: 1.25rem 1.25rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .panel h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }

  .hint {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .chain-preview {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    color: var(--text);
    line-height: 1.4;
    word-break: break-word;
  }

  .error {
    color: #b91c1c;
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }

  .import-msg {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
    color: var(--text-h);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  button {
    font: inherit;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--code-bg);
    color: var(--text-h);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button.primary {
    background: var(--accent-bg);
    border-color: var(--accent-border);
  }

  button.warn {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.12);
  }

  button.small {
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
  }

  button.danger {
    border-color: #dc2626;
    color: #b91c1c;
  }

  button.add-band {
    margin-top: 0.75rem;
  }

  .meta {
    margin: 0 0 1rem;
    font-size: 0.85rem;
  }

  .meta code {
    font-size: 0.85rem;
  }

  .bypass-badge {
    margin-left: 0.35rem;
    font-size: 0.8rem;
    color: var(--text);
    font-style: italic;
  }

  .tilt-scale {
    display: flex;
    justify-content: space-between;
    margin: -0.25rem 0 1rem;
    font-size: 0.78rem;
    color: var(--text);
    opacity: 0.85;
  }

  .tilt-scale .tilt-hl {
    font-weight: 600;
    color: var(--text-h);
  }

  .bypass-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-h);
    cursor: pointer;
  }

  .bypass-label input {
    width: 1rem;
    height: 1rem;
  }

  .signal-mode {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0.75rem 0 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-h);
  }

  .signal-mode select {
    font: inherit;
    max-width: 22rem;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-h);
  }

  .cal-route {
    margin: 0 0 1rem;
    padding: 0.65rem 1rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .cal-route legend {
    padding: 0 0.35rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-h);
  }

  .radio-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.45rem;
    font-size: 0.9rem;
    cursor: pointer;
    color: var(--text-h);
  }

  .test-freq-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  .chip {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--code-bg);
    color: var(--text-h);
    cursor: pointer;
  }

  .chip-active {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    font-weight: 600;
  }

  .reset-band {
    margin-top: 0.35rem;
  }

  .sweep-msg {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-h);
  }

  .subheading-small {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-h);
  }

  .control {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.75rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .control label {
    grid-column: 1 / -1;
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text-h);
  }

  .control input[type='range'] {
    grid-column: 1;
    width: 100%;
  }

  .value {
    font-family: var(--mono);
    font-size: 0.85rem;
    color: var(--text);
    min-width: 4.5rem;
    text-align: right;
  }

  .lock-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin-top: 0.25rem;
  }

  .locked-note {
    font-size: 0.85rem;
    color: var(--text);
  }

  .band-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .band-card {
    margin: 0;
    padding: 0.75rem 1rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .band-card legend {
    padding: 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-h);
  }

  .band-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .band-row label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-h);
  }

  .band-row select {
    font: inherit;
    min-width: 9rem;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-h);
  }

  .band-sliders {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .band-sliders label {
    display: grid;
    grid-template-columns: 2.5rem 1fr 3.5rem;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-h);
  }

  .band-sliders input[type='range'] {
    width: 100%;
  }

  .mono {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--text);
    text-align: right;
  }

  .footer {
    margin-top: 2rem;
    font-size: 0.9rem;
    color: var(--text);
  }

  .footer a {
    color: var(--text-h);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .advanced-audio {
    margin-top: 1rem;
    padding: 0.65rem 0.85rem;
    border: 1px dashed var(--border);
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .advanced-audio summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--text-h);
  }

  .advanced-hint {
    margin-top: 0.65rem;
    font-size: 0.85rem;
  }

  .sweep-duration-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }

  .sweep-pos-control .value {
    min-width: 5.5rem;
  }

  .comparison-loop {
    margin: 0.75rem 0 1rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    font-size: 0.88rem;
    color: var(--text-h);
    cursor: pointer;
  }

  .checkbox-row input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
  }

  .seg-input {
    width: 3.5rem;
    font: inherit;
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-h);
  }

  .loop-hint {
    margin: 0.5rem 0 0;
    font-size: 0.82rem;
  }
</style>
