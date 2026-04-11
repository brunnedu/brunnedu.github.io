# Design Document: Personalized In-Situ Audio EQ (Project "MyEar-Reference")

## 1. Project Overview
A web-based, zero-installation tool designed to help users create a custom Parametric EQ (PEQ) profile for their IEMs or headphones based on their unique ear anatomy (HRTF/Ear Canal Resonance) and subjective hearing perception.

## 2. Scientific Foundation
The project shifts from "Generic Measurement Target" to "Personalized Eardrum Target" using three core acoustic principles:
* **Tonal Tilt (Macro):** Establishing a baseline spectral balance using Pink Noise (equal energy per octave).
* **Equal Loudness (Mids):** Utilizing ISO 226:2023 contours to map the user's specific ear gain (2kHz–5kHz).
* **Resonance Mapping (Highs):** Identifying narrow-band half-wave resonances (7kHz–10kHz) caused by the physical interaction between the transducer and the ear canal.

## 3. The 3-Phase Calibration Workflow

### Phase 1: Spectral Tilt (Pink Noise)
* **Goal:** Determine the broad bass-to-treble ratio.
* **Mechanism:** A low-Q "Tilt" filter (pivot at 1kHz).
* **User Action:** Adjust a slider until the Pink Noise sounds like a "neutral waterfall"—neither too dark nor too piercing.

### Phase 2: Equal Loudness Mapping
* **Goal:** Correct deviations in the "Ear Gain" region.
* **Mechanism:** Comparison testing. A 1kHz reference tone is toggled against test frequencies (2k, 3k, 4k, 6k).
* **User Action:** Adjust the gain of the test tone until it matches the perceived volume of the 1kHz reference.

### Phase 3: Resonance Hunting (Sine Sweep)
* **Goal:** Surgically remove "piercing" peaks unique to the user's ear canal/insertion depth.
* **Mechanism:** A slow, automated Sine Sweep (5kHz – 12kHz).
* **User Action:** * Click **"Mark Start"** when the volume begins to peak/whistle.
    * Click **"Mark End"** when it returns to baseline.
* **Calculations:** * Center Frequency ($f_c$): $\sqrt{f_{start} \cdot f_{end}}$
    * Q-Factor: $\frac{f_c}{f_{end} - f_{start}}$

## 4. Technical Architecture (Static Stack)
The application will be hosted as a static site on **GitHub Pages**, utilizing client-side processing only.

* **Audio Engine:** `Tone.js` (Web Audio API wrapper) for oscillator scheduling and node routing.
* **EQ Filter Implementation:** `weq8` or native `BiquadFilterNode` for real-time PEQ application.
* **Visualizations:** `D3.js` or `Plotly.js` for real-time frequency response graphing and interactive "Marking."
* **State Management:** React/Svelte to track the list of active filters and user coordinates.

## 5. Guardrails & Safety
* **Negative Pre-amp:** Automatically apply a global gain reduction equal to the highest boost to prevent digital clipping.
* **Q-Factor Limits:** Peak/Bell filters capped at $Q=1.0$ for boosts; high-Q ($Q > 5.0$) allowed only for cuts (Notches).
* **Ear Fatigue Mitigation:** Mandatory "Neutral Audio" reset (5s white noise or nature sounds) every 3 minutes of testing.

## 6. Output & Export
The tool will generate a standardized `.txt` or `.conf` file compatible with:
* **Equalizer APO / Peace GUI** (Windows)
* **Wavelet** (Android - AutoEQ import format)
* **Crinnacle/REW** (JSON format for graphing comparison)

## 7. Implementation Roadmap (Cursor/MVP)
1.  Initialize `Tone.js` AudioContext with a master gain node.
2.  Create a "Sine Sweep" component with Start/Stop triggers.
3.  Implement a "Filter Factory" that generates PEQ nodes based on User "Marks."
4.  Develop the Export logic to map `Tone.js` filter parameters to Equalizer APO syntax.