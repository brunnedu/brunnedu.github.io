# Self-EQ — Detailed Product & Implementation Plan

This document extends [INITIAL_DESIGN_DOC.md](./INITIAL_DESIGN_DOC.md) with locked design decisions, concrete behavior, technical architecture, implementation phases, and **resolved** implementation constants (formerly open questions Q1–Q10).

---

## 1. Locked design decisions (from stakeholder Q&A)

| # | Topic | Choice |
|---|--------|--------|
| 1 | ISO 226 in processing | **A** — Not used in the algorithm for MVP. Phase 2 is **pure A/B loudness matching** only. |
| 2 | Listening level | **B** — One explicit **level calibration**, then **locked master gain** through Phase 2 (with clear copy that results are valid near this level). |
| 3 | Phase 2 test signal | **C** — **User-selectable**; **default = narrowband noise** (alternative: pure tones). |
| 4 | Phase 3 sweep & Q | **A + C** — Single **fixed-parameter log sweep** for MVP **and** after auto-estimate, always offer **width (Q)** and **cut gain** controls to refine the notch. |
| 5 | Peaks vs dips | **A** — **Peaks / resonances only** for v1 (no “dull region” workflow yet). |
| 6 | EQ implementation | **B** — **Native `BiquadFilterNode` cascade** owned by the app (predictable, export-aligned). |
| 7 | Visualization | **A** — **D3** for frequency / filter / mark visualization (avoid heavy chart bundles by default). |
| 8 | App framework | **Svelte + Vite**; static build deployable to GitHub Pages. |
| 9 | Export strategy | **B** — **Single internal canonical model** (JSON schema) with **Peace / Equalizer APO** as the **first** exporter; additional formats later as adapters. |
| 10 | Ear fatigue / breaks | **B** — **Soft reminders** after sustained use + **one-click “Rest ears”** (short neutral sound), not a hard blocking gate. |
| 11 | Stereo | **A** — **Linked stereo**: one EQ applied to both channels. |

---

## 1b. Resolved implementation constants (Q1–Q10)

These replace the former “remaining open design questions” section; all items below are **locked** for v1 unless explicitly revisited.

| ID | Topic | Resolution |
|----|--------|------------|
| Q1 | Vite `base` / hosting | **`base: '/self-eq/'`** — app served at `https://brunnedu.github.io/self-eq/`. |
| Q2 | Peace / APO subset | **PEQ-compatible biquads only** for v1: peaking, lowshelf, highshelf, notch (as mapped from Web Audio types). No GraphicEQ/FIR in v1. |
| Q3 | Biquad order | **Fixed order**: tilt/shelves first → mid peaking bands (by increasing fc) → treble notches (by increasing fc). Not user-reorderable in v1. |
| Q4 | Narrowband noise bandwidth | **1/3 octave** (constant-Q) around each test center frequency. |
| Q5 | Phase 3 sweep | **~45 s** log sweep over **5 kHz–12 kHz**; **Replay sweep** control without changing parameters. |
| Q6 | Max notch bands | **3** notches maximum; copy explains extra peaks may be harmonics or pad resonance. |
| Q7 | Persistence | **`localStorage` autosave** of canonical JSON with **Clear session**; if storage blocked, fall back to export/import only. |
| Q8 | Tone.js | **Pure Web Audio** (`OscillatorNode`, `AudioBufferSourceNode`, ramps) — no Tone.js in v1. |
| Q9 | Live FFT | **None in MVP** — D3 shows **modeled** magnitude only; optional `AnalyserNode` panel deferred. |
| Q10 | Accessibility | **Keyboard-usable stepper/controls** as a minimum; **`prefers-reduced-motion`** respected for any animated sweep UI (static indicator when reduced motion). |

---

## 2. Product goals & non-goals

### 2.1 Goals

- Help users build a **subjective parametric EQ** for **their** headphones/IEMs on **this** output device, emphasizing **narrow peaks** (especially upper-mid / treble resonances) and **broad tilt** + **mid-band loudness balance**.
- **Zero install**: runs in the browser; works as a subpage of `brunnedu.github.io`.
- **Transparent output**: export that maps 1:1 from the internal model to Peace/APO text.

### 2.2 Non-goals (v1)

- Clinical hearing test or diagnosis.
- Per-channel L/R independent EQ.
- Room/speaker correction.
- Automatic use of ISO equal-loudness contours inside the DSP path.
- Dip/valley hunting workflows.

### 2.3 Honest positioning (user-facing)

- Results depend on **volume**, **insertion depth** (IEMs), **pad wear** (headphones), and **DAC/amp** chain. Copy should say so briefly.

---

## 3. Core user journey

### 3.1 Onboarding

- Short explanation of the three phases and the **level-lock** requirement.
- **Start session** → optionally name headphone / notes (can be v1.1 if time-constrained).

### 3.2 Level calibration & lock (before Phase 2)

- User adjusts **system/app volume** to a **comfortable, typical listening level** using a provided stimulus (e.g. pink noise or calibrated noise snippet).
- User clicks **“Lock level for calibration”** → app stores **master gain** (or equivalent) and **disallows** changing it during Phases 2–3 (or warns strongly if the AudioContext graph must be rebuilt).
- **Unlock** only via explicit control (“I changed volume / device — reset level lock”) with confirmation.

### 3.3 Phase 1 — Spectral tilt (pink noise)

- Play **pink noise** through the **preview EQ**.
- Single **low-Q tilt** (e.g. shelf-like or documented tilt curve) pivoted near **1 kHz** as in the initial design.
- User adjusts until “neither too dark nor too piercing” (preference-weighted step).
- **Bypass A/B** for the same noise.

### 3.4 Phase 2 — Mid loudness matching (2 kHz–6 kHz region)

- **Reference**: fixed **1 kHz**; user chooses **narrowband noise (default)** or **pure tone** (same choice model for test bands).
- **Test frequencies**: **2k, 3k, 4k, 6k**; narrowband bandwidth = **1/3 octave** per §1b Q4.
- UI: toggle **Reference** vs **Test**; gain slider for **test** only (or per-band correction stored as peaking filters).
- Each match produces a **peaking filter** recorded in the canonical model.
- **Soft timer**: if cumulative time > threshold, show non-blocking reminder + **Rest ears** button.

### 3.5 Phase 3 — Resonance marking (sine sweep)

- **Automated log sweep** **5 kHz–12 kHz** in **~45 s** (§1b Q5); **Replay sweep** available.
- User clicks **Mark start** / **Mark end** around audible peaks.
- Compute **starting** \(f_c = \sqrt{f_\text{start} \cdot f_\text{end}}\), \(Q \approx f_c / (f_\text{end} - f_\text{start})\) as **initial** notch parameters.
- **Mandatory refinement UI**: **cut gain**, **Q (width)**, optional **fine frequency** nudge; live audition with notch in chain.
- Up to **3** notches (§1b Q6).

### 3.6 Review & export

- Summary: list of filters + **global pre-gain** (negative pre-amp = max boost headroom rule from initial doc).
- **Export**: download **Peace/APO** file; optional **download JSON** (canonical) for debugging / future converters.
- **Bypass** full chain vs **flat** for final listen.

---

## 4. Technical architecture

### 4.1 Stack

- **Svelte 5** + **Vite**; **TypeScript**.
- **Web Audio API** for playback graph.
- **D3** for static / lightly animated curves (frequency response sketch, sweep position, marked intervals).

### 4.2 Audio graph (conceptual)

```
[sources: pink noise | reference/test generators | sweep oscillator]
        → (if eqBypass) → [user master gain] → [destination]
        → (else) → [preamp gain: preampDb] → [tilt shelves + PEQ biquads] → [user master gain] → [destination]
```

- **EQ chain** (non-bypass): `expandTiltBands(tiltDb)` (lowshelf + highshelf at **1 kHz**, low Q) **first**, then user bands per **§1b Q3** (shelves → peaking → notches by fc).
- **Pre-amp / headroom**: `preampDb = -max(0, max gainDb)` over **`allBandsForChain`** (tilt + user bands); applied as a `GainNode` before the biquad chain.
- **Bypass**: preview routes pink noise straight to master gain (no preamp, no biquads); `eqBypass` is stored in canonical JSON for session round-trip only (not sent to Peace as a filter).

### 4.3 Canonical data model (exporter source of truth)

- Implemented in `src/lib/eq/canonicalEq.ts`. Downloadable JSON shape:

```json
{
  "version": 1,
  "meta": { "headphoneName": "optional", "createdAt": "ISO-8601" },
  "preampDb": -3.5,
  "userMasterGainDb": 0,
  "tiltDb": 2,
  "eqBypass": false,
  "loudnessSignalMode": "narrowband",
  "loudnessMatchDb": { "2000": 0, "3000": -1.5, "4000": 0, "6000": 0 },
  "sweepNotches": [
    { "id": "sw-…", "type": "notch", "freqHz": 8200, "gainDb": -6, "q": 12 }
  ],
  "bands": [
    { "id": "uuid", "type": "lowshelf", "freqHz": 1000, "gainDb": 2.1, "q": 0.7 },
    { "id": "uuid", "type": "peaking", "freqHz": 3000, "gainDb": -1.5, "q": 1.0 },
    { "id": "uuid", "type": "peaking", "freqHz": 8200, "gainDb": -6.0, "q": 8.0 }
  ]
}
```

- **`tiltDb`**: macro tilt; DSP expands to paired lowshelf / highshelf at 1 kHz (±`tiltDb/2` dB each, see `expandTiltBands` in `canonicalEq.ts`).
- **`loudnessSignalMode`**: `narrowband` \| `tone` — sets stimulus type in Phase 4 UI and the **Q** of the virtual `__lm_*` peaking bands (1/3-oct vs narrow sine).
- **`loudnessMatchDb`**: gains (dB) at 2000 / 3000 / 4000 / 6000 Hz, merged as peaking bands via `loudnessPeakingBands()` in `allBandsForChain`.
- **`sweepNotches`**: up to **3** `notch` bands from Phase 5 marks (`id` prefix `sw-`); preview maps them to **peaking cuts** in `applyBandToBiquad` so `gainDb` depth is audible (Peace mapping in Phase 7).
- **`eqBypass`**: when true, preview is flat; omit from Peace export (preview-only flag).
- **`preampDb`**: serialized for export; on load **recomputed** via `withAutoPreamp()` from `allBandsForChain` (tilt + user bands).
- **`userMasterGainDb`**: preview listening level only; not part of Peace filter lines (Peace `Preamp:` maps from `preampDb` + export rules in Phase 7).
- **Peace exporter** (Phase 7): emit **two shelf filters** for non-zero `tiltDb`, then user `bands`, plus `Preamp:` from `preampDb` (subset per §1b Q2).

### 4.4 D3 usage

- **Magnitude response** for display: analytical peaking/shelf formulas summed in JS or small frequency vector through biquad magnitude.
- **Sweep UI**: vertical line or highlighted segment for current frequency; shaded region between start/end marks. Respect **`prefers-reduced-motion`** (§1b Q10): static sweep indicator when user prefers reduced motion.

### 4.5 Deployment (GitHub Pages)

- Vite **`base: '/self-eq/'`** (§1b Q1).
- Production build: from `self-eq-src/`, `npm run build` → **`../self-eq/`** (same pattern as `smash-up-src` → `smash-up/`); commit `self-eq/` for Pages.

### 4.6 Third-party audio libs

- **No Tone.js** in v1 (§1b Q8).
- **No weq8** — hand-rolled PEQ manager around `BiquadFilterNode`.

### 4.7 Persistence

- **`localStorage`** autosave of canonical session JSON + **Clear** (§1b Q7); export/import fallback if storage unavailable.

---

## 5. Safety & UX guardrails (concrete)

- **Q limits** (from initial doc): cap **boost** peaking **Q ≤ 1**; allow **higher Q** for **cuts/notches**.
- **Max boosts**: optional hard cap (e.g. +6 dB per band) — tune in implementation.
- **Soft break reminder** after **N minutes** active testing; **Rest ears** plays **5 s** neutral sound.
- **Autoplay**: handle `AudioContext` resume on first user gesture (iOS/Safari).

---

## 6. Implementation phases

### Phase 0 — Project scaffold ✅

- Vite + Svelte + TypeScript under **`self-eq-src/`**; deployable static files under **`self-eq/`** at repo root.
- `base: '/self-eq/'`; verify production build locally.
- Minimal app shell (title, layout) preparing for a stepper.

### Phase 1 — Audio engine MVP ✅

- `AudioContext` lifecycle + **user-gesture unlock**.
- **Pink noise** (buffered, looping).
- **Master gain** + **level lock** state machine.
- **Single peaking biquad** with live **frequency / Q / gain** for proof of chain.

### Phase 2 — PEQ chain & canonical model ✅

- **Ordered list** of filters → dynamic **cascade** creation / param updates (`PreviewAudioEngine.applyCanonicalEq`).
- Internal **JSON schema** + types (`canonicalEq.ts`); **import/export JSON** (round-trip) in the UI.
- **Pre-gain** via `computePreampDb` / `withAutoPreamp` from `allBandsForChain` (extended in Phase 4 with loudness peaks).

### Phase 3 — Phase 1 UI (tilt) ✅

- **`tiltDb` slider** (−12…+12 dB in UI; file import allows ±18) driving paired **lowshelf / highshelf** at **1 kHz** (`TILT_SHELF_Q = 0.5`).
- **Bypass EQ** checkbox (`eqBypass`): flat pink at the same master gain for A/B.

### Phase 4 — Phase 2 UI (loudness matching) ✅

- **1 kHz reference** vs **2k / 3k / 4k / 6k** test; **Play calibration tone** / stop; pink and cal **mutually exclusive**.
- **Stimulus**: **narrowband** (white → **bandpass**, 1/3-oct **Q**) **default**; **pure sine** optional (`loudness.ts`).
- **Corrections** live in `loudnessMatchDb` and apply **only** through virtual **`__lm_*` peaking** bands in the preview chain (no separate stimulus gain — avoids double counting).
- **`PreviewAudioEngine.applyLoudnessCal`**: routes cal audio into the same preamp/EQ input as pink (`calMute` + `pinkSuppressedForCal`).

### Phase 5 — Phase 3 UI (sweep + marks) ✅

- Log **sine sweep** **5–12 kHz** in **45 s** (`sweep.ts`); **Play/replay** + **stop**; **Mark start / Mark end** on running sweep; \(f_c=\sqrt{f_a f_b}\), \(Q\approx f_c/|f_b-f_a|\); **max 3** `sweepNotches` in JSON; **refine** Hz / Q / cut (dB) in UI.
- **`PreviewAudioEngine`**: dedicated sweep oscillator + `sweepMute` into preamp with pink/cal; `getSweepMarkSample()` for marks.

### Phase 6 — Visualization (D3) ✅

- Combined **target curve** / filter magnitude plot (`biquadMagnitude.ts` + `ResponsePlot.svelte`, D3 log-frequency axis).
- Sweep **cursor** (audio-clock `getSweepMarkSample`) and **marked interval** shading (start → current sweep Hz); **`prefers-reduced-motion`**: rAF vs 250 ms updates + lighter stroke / note.

### Phase 7 — Peace exporter ✅

- Generate **`.txt`** compatible with **Equalizer APO / Peace** from canonical JSON (`exportPeace.ts`, **Download Peace / APO** in UI).
- **Deviations vs preview**: plot and coeffs assume a fixed **sample rate** (context `sampleRate`, often 48 kHz); Equalizer APO uses the device rate — small curve differences possible. **`sw-*`** bands export as **PK** with negative **gain** (matches preview peaking-cut), not **NO**. Coefficient **rounding** in hosts may differ slightly from Web Audio.

### Phase 8 — Polish

- Copy, disclaimers, keyboard focus, mobile layout (where feasible).
- **Soft timer** + **Rest ears**; **localStorage** persistence (§1b Q7).
- Link from main site `index.html` to `self-eq/` (when ready).

---

## 7. Remaining open design questions

None from the former Q1–Q10 list; those are resolved in **§1b**.

**Optional later (not blocking v1):**

- CI workflow (GitHub Actions) vs manual `dist` deploy.
- Exact **Peace** line syntax for every edge case (validate against Peace docs during Phase 7).
- **Rest ears** asset (generated noise vs short bundled audio file).

---

## 8. Document history

| Date | Change |
|------|--------|
| 2026-04-06 | Initial detailed plan from stakeholder decisions on open questions. |
| 2026-04-06 | Merged Q1–Q10 recommendations into §1b; updated journey and architecture; marked Phase 0–1 complete after scaffold + audio MVP. |
| 2026-04-06 | Phase 2: canonical EQ JSON, preamp node + ordered biquad cascade, import/export; §4.2–4.3 aligned with `preampDb` / `userMasterGainDb`. |
| 2026-04-06 | Phase 3: `tiltDb` + `expandTiltBands`, `eqBypass` routing in `PreviewAudioEngine`, Phase 1 UI; preamp includes tilt; §4.2–4.3 updated. |
| 2026-04-06 | Phase 4: `loudnessMatchDb`, `loudnessSignalMode`, `loudnessPeakingBands` + `allBandsForChain`; cal tones subgraph in `previewEngine.ts`; UI §4.3 JSON fields. |
| 2026-04-06 | Phase 5: `sweepNotches`, log sweep + marks, `sw-*` peaking-cut preview; `sweep.ts`; three calibration UIs complete. |
| 2026-04-06 | Phase 6–7: D3 magnitude plot + sweep/mark overlays (`ResponsePlot`, `biquadMagnitude.ts`); Peace `.txt` export (`exportPeace.ts`); `getSampleRate()` on engine. |
| 2026-04-06 | §9 Feedback 1: post-v1 UX notes (sweep scrub, music A/B, LM Q/grid/alternate, device volume, cut-only LM) with options + recommendations. |
| 2026-04-06 | Hosting layout: source in **`self-eq-src/`**, Vite `build.outDir` → **`../self-eq/`** (Smash Up pattern) for GitHub Pages subpath. |

---

## 9. Feedback 1 (UX follow-up — options for review)

Stakeholder notes after core functionality landed, plus candidate improvements. For each item: **options** to choose from, then a **recommended** direction (not final until you pick).

### 9.1 Resonance sweep: duration and scrubbing

**Issue:** The 45 s log sweep feels long; without a way to “move along” the sweep, noticing a peak slightly late forces a full replay.

**Options:**

- **A.** Shorten the default duration only (e.g. 20–30 s) while keeping auto-play sweep semantics.
- **B.** Add **duration presets** (e.g. 15 / 30 / 45 s) sharing the same \(f_0 \rightarrow f_1\) law.
- **C.** Add a **scrub slider** (log frequency or normalized time) that drives the same instantaneous frequency as the sweep—**manual listening** along the axis without waiting for time; optionally **Play** still runs time-based motion but the slider can override or “pick up” from a chosen point.
- **D.** **Pause + scrub**: pause the sweep, drag to a frequency, resume from there (or replay only from cursor).
- **E.** **Loop window**: repeat a narrow band around the current cursor for fine tuning before placing a mark.

**Recommendation:** **B + C**: presets address perceived slowness; a log-frequency (or time-normalized) slider tied to the same `logSweepFreqAtElapsed` law gives exploratory control and reduces full replays. Consider **D** if you want marks to stay strictly time-locked to a running sweep; otherwise manual scrub is enough for “where did that whistle live?”

---

### 9.2 Reference music sample for A/B at the end

**Issue:** A short, high-quality musical excerpt (good dynamic range) would help validate the EQ perceptually vs noise-only calibration.

**Options:**

- **A.** Bundle a **small loop** (e.g. 15–30 s) in the repo under a clear **license** (CC0 / own recording / purchased stem with redistribution rights).
- **B.** **User-provided file** (local `File` decode into buffer): no licensing burden on you; UX burden on user.
- **C.** **Dual mode:** bundled default clip + optional user upload.
- **D.** Keep noise-only; link to an external reference track (weak for offline / consistency).

**Recommendation:** **C** if you can secure **A**’s asset; otherwise start with **B** (upload) and add a bundled clip when license is settled. Route music through the **same chain** as pink with an obvious **EQ on / off** (bypass) A/B and a short level note (true peak match is hard in-browser—copy can say “match device volume once, then compare timbre/clarity”).

---

### 9.3 Loudness (“ear gain”) grid: too few points and peaks too narrow

**Issue:** A handful of test frequencies feels insufficient to pin down ear-related loudness; the resulting **peaking** bands feel **too narrow** (high Q) for a smooth perceptual correction.

**Options:**

- **A.** **Add frequencies** (e.g. extra thirds/octaves between existing test points) in `LOUDNESS_TEST_FREQS` / UI.
- **B.** **Lower default Q** for loudness-match peaks (broader bumps), with optional “narrow / standard / wide” selector.
- **C.** **Interpolated curve:** user adjusts anchors; app fills intermediate gains (linear or log-f spacing) before export.
- **D.** **Different primitive:** e.g. low-Q tilt or a few shelves plus fewer peaks, accepting less granular correction.
- **E.** **Separate “measurement” from “export smoothing”:** keep fine anchors internally but export fewer, wider filters (merge nearby corrections).

**Recommendation:** **B** first (fast, aligns with “sounds too comb-filtered”); pair with **A** if you still feel blind between dots. Defer **C/E** until you know how many anchors you want long-term.

---

### 9.4 Faster loudness matching: rapid reference vs test alternation

**Issue:** A workflow that **quickly alternates** reference and test (tone or narrowband noise) could make volume matching easier than holding two levels in memory across manual switches.

**Options:**

- **A.** **Auto A/B** at a fixed rate (e.g. 250–500 ms per side) with adjustable rate; user adjusts correction until no pulsing in loudness.
- **B.** **Hold-to-solo:** hold key = reference, release = test (or vice versa).
- **C.** **Crossfaded continuous morph** between reference and test (slider or LFO)—advanced, can confuse.
- **D.** Keep manual route buttons but add **one-click “play comparison loop”** (N seconds reference, N seconds test, repeat).

**Recommendation:** **D** as the clearest upgrade from current UX; add **A** as an optional “rapid alternate” mode once **D** feels solid. **B** is nice for power users (keyboard).

---

### 9.5 Master gain vs system/device volume

**Issue:** In-app **master gain** at the start may not be the right mental model; users should **set device/system volume once** and keep it fixed for the session.

**Options:**

- **A.** Remove master gain from the primary UI; replace with **instructional copy** only.
- **B.** **Collapse** master into an “Advanced / accessibility” disclosure.
- **C.** Keep master but **rename** and **de-emphasize** (“trim only if needed—prefer device volume”).
- **D.** Keep behavior for **Web Audio gain staging** but default to 0 dB and never show a slider until “Show level trim”.

**Recommendation:** **B** or **D**: preserve a **safety valve** for quiet sources / accessibility without teaching “mix here first.” Lead with **device volume** instructions in the Phase 0 / audio panel copy.

---

### 9.6 Loudness corrections: downward-only (cuts) to match preamp behavior

**Issue:** **Positive** loudness-match adjustments don’t make the **current** test stimulus louder in the intuitive way; they interact with **preamp / headroom** so other frequencies behave differently—confusing.

**Options:**

- **A.** **Clamp** `loudnessMatchDb` to **≤ 0** in UI (and validate on JSON import) with tooltip: “Match by **cutting** the test band toward the reference; boosts are handled elsewhere (tilt / PEQ) if needed.”
- **B.** **Clamp in preview only** for LM bands but allow positive in file (inconsistent).
- **C.** **Change preamp policy** when LM boosts exist (e.g. exclude LM from preamp computation)—more engineering risk and may reintroduce clipping confusion.
- **D.** **Two modes:** “Cut-only matching (recommended)” vs “Allow boosts (advanced)” with explicit warning.

**Recommendation:** **A** for the default product story; consider **D** if you discover a valid use case for rare positive LM after user testing. Document that **perceptual loudness match at fixed device volume** is naturally a **cut-the-louder** game when reference is the anchor.

---

### 9.7 Suggested implementation ordering (after you choose)

Not binding—adjust after decisions: (1) **9.6** and **9.5** copy/UI (small, clarifies everything else); (2) **9.1** scrub + duration presets; (3) **9.4** comparison loop / rapid A/B; (4) **9.3** LM Q + optional extra freqs; (5) **9.2** music A/B (asset + routing).
