<script lang="ts">
  import * as d3 from 'd3'
  import { eqChainMagnitudeDb, logSpacedFrequencies } from '../eq/biquadMagnitude'
  import type { CanonicalEq } from '../eq/canonicalEq'
  import { SWEEP_F0_HZ, SWEEP_F1_HZ } from '../eq/sweep'

  let {
    eq,
    sampleRate,
    sweepCursorHz = null,
    markStartHz = null,
    reducedMotion = false,
  }: {
    eq: CanonicalEq
    sampleRate: number
    sweepCursorHz?: number | null
    markStartHz?: number | null
    reducedMotion?: boolean
  } = $props()

  /** SVG mount only — do not replaceChildren on the wrapper that holds notes. */
  let svgHostEl: HTMLDivElement | undefined = $state()

  const fMin = 20
  const fMax = 20000
  const nPts = 240

  $effect(() => {
    const el = svgHostEl
    if (!el) return

    const paint = () => {
      const rectW = el.getBoundingClientRect().width
      const width = Math.max(260, Math.min(1400, rectW > 1 ? rectW : el.clientWidth || 560))
      const height = 220
      const margin = { top: 12, right: 14, bottom: 36, left: 48 }
      const innerW = width - margin.left - margin.right
      const innerH = height - margin.top - margin.bottom

      const freqs = logSpacedFrequencies(fMin, fMax, nPts)
      const magnitudes = freqs.map((f) => eqChainMagnitudeDb(f, sampleRate, eq))
      const yMinRaw = Math.min(...magnitudes, -3)
      const yMaxRaw = Math.max(...magnitudes, 3)
      const pad = 4
      const yMin = Math.floor((yMinRaw - pad) / 3) * 3
      const yMax = Math.ceil((yMaxRaw + pad) / 3) * 3

      const xScale = d3.scaleLog().domain([fMin, fMax]).range([0, innerW]).clamp(true)
      const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice()

      const pts = freqs.map((f, i) => ({ f, m: magnitudes[i]! }))
      const lineGen = d3
        .line<{ f: number; m: number }>()
        .x((d) => xScale(d.f))
        .y((d) => yScale(d.m))
        .curve(d3.curveMonotoneX)

      el.replaceChildren()
      const svg = d3
        .select(el)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', 'EQ magnitude response versus frequency')

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'var(--code-bg, #f4f4f5)')
        .attr('rx', 4)

      const xAxis = d3
        .axisBottom(xScale)
        .tickValues([50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000])
        .tickFormat((d) => {
          const v = typeof d === 'number' ? d : Number(d)
          return v >= 1000 ? `${v / 1000}k` : `${v}`
        })
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}`)

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .call((sel) => sel.selectAll('text').attr('fill', 'var(--text, #52525b)').style('font-size', '10px'))
        .call((sel) => sel.selectAll('line, path').attr('stroke', 'var(--border, #d4d4d8)'))

      g.append('g')
        .call(yAxis)
        .call((sel) => sel.selectAll('text').attr('fill', 'var(--text, #52525b)').style('font-size', '10px'))
        .call((sel) => sel.selectAll('line, path').attr('stroke', 'var(--border, #d4d4d8)'))

      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 30)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-h, #18181b)')
        .style('font-size', '11px')
        .text('Frequency (Hz)')

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -36)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-h, #18181b)')
        .style('font-size', '11px')
        .text('Gain (dB)')

      if (yMin < 0 && yMax > 0) {
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerW)
          .attr('y1', yScale(0))
          .attr('y2', yScale(0))
          .attr('stroke', 'var(--border, #d4d4d8)')
          .attr('stroke-dasharray', '4 3')
          .attr('opacity', 0.9)
      }

      const curvePath = lineGen(pts) ?? ''
      g.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-border, #6366f1)')
        .attr('stroke-width', reducedMotion ? 1.75 : 2)
        .attr('d', curvePath)

      const shade = (fLo: number, fHi: number) => {
        const a = Math.max(fMin, Math.min(fLo, fHi))
        const b = Math.min(fMax, Math.max(fLo, fHi))
        if (!(b > a)) return
        g.append('rect')
          .attr('x', xScale(a))
          .attr('width', Math.max(0, xScale(b) - xScale(a)))
          .attr('y', 0)
          .attr('height', innerH)
          .attr('fill', 'var(--accent-bg, rgba(99, 102, 241, 0.15))')
          .attr('pointer-events', 'none')
      }

      const vline = (f: number, stroke: string, widthPx: number, opacity: number) => {
        if (!(f > fMin && f < fMax)) return
        g.append('line')
          .attr('x1', xScale(f))
          .attr('x2', xScale(f))
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', stroke)
          .attr('stroke-width', widthPx)
          .attr('opacity', opacity)
          .attr('pointer-events', 'none')
      }

      if (
        markStartHz != null &&
        sweepCursorHz != null &&
        markStartHz > 0 &&
        sweepCursorHz > 0 &&
        !eq.eqBypass
      ) {
        shade(markStartHz, sweepCursorHz)
      }

      if (markStartHz != null && markStartHz > 0 && !eq.eqBypass) {
        vline(markStartHz, 'var(--text, #71717a)', 1, 0.85)
      }

      if (sweepCursorHz != null && sweepCursorHz > 0 && !eq.eqBypass) {
        const inSweepBand = sweepCursorHz >= SWEEP_F0_HZ * 0.95 && sweepCursorHz <= SWEEP_F1_HZ * 1.02
        if (inSweepBand || markStartHz != null) {
          vline(sweepCursorHz, 'var(--accent-border, #6366f1)', reducedMotion ? 1.25 : 1.5, 0.95)
        }
      }
    }

    paint()
    const ro = new ResizeObserver(() => paint())
    ro.observe(el)
    return () => ro.disconnect()
  })
</script>

<div class="plot-wrap">
  {#if eq.eqBypass}
    <p class="plot-note">EQ bypassed — flat response (plot shows 0 dB shaping).</p>
  {/if}
  {#if reducedMotion && sweepCursorHz != null}
    <p class="plot-note reduced">Reduced motion: sweep cursor updates at a lower rate.</p>
  {/if}
  <div class="plot-svg-host" bind:this={svgHostEl}></div>
</div>

<style>
  .plot-wrap {
    width: 100%;
    margin-top: 0.5rem;
  }

  .plot-svg-host {
    width: 100%;
    min-height: 220px;
  }

  .plot-note {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
    color: var(--text);
    line-height: 1.35;
  }

  .plot-note.reduced {
    font-style: italic;
  }
</style>
