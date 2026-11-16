<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
    forceX,
    forceY,
  } from 'd3-force'
  import type { SimulationNodeDatum } from 'd3-force'
  import type { SynthesisResult, SynthesisZone } from 'src/Interfaces'

  interface SimNode extends SimulationNodeDatum {
    id: string
    zone: SynthesisZone | 'gap'
    edgeType: string
    inDegree?: number
    outDegree?: number
  }

  interface SimLink {
    source: string | SimNode
    target: string | SimNode
    type: string
    measure: number
  }

  interface Colors {
    accent: string
    node: string
    cc: string
    bg: string
    hub: string
    muted: string
    direct: string
  }

  function resolveColors(cs: CSSStyleDeclaration): Colors {
    return {
      accent: cs.getPropertyValue('--interactive-accent').trim() || '#7c3aed',
      node:   cs.getPropertyValue('--text-normal').trim()         || '#cdd6f4',
      cc:     cs.getPropertyValue('--color-orange').trim()         || '#ea8833',
      bg:     cs.getPropertyValue('--background-primary').trim()   || '#1e1e2e',
      hub:    cs.getPropertyValue('--text-warning').trim()         || '#e5c07b',
      muted:  cs.getPropertyValue('--text-muted').trim()           || '#6c7086',
      direct: cs.getPropertyValue('--text-muted').trim()           || '#6c7086',
    }
  }

  function noteName(path: string): string {
    const base = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path
    return base.length > 20 ? base.slice(0, 19) + '…' : base
  }

  // ── Props ──────────────────────────────────────────────────────────
  export let result: SynthesisResult
  export let showDirect = true
  export let showCoCitation = true
  export let showJaccard = true
  export let showGap = true
  export let chargeStrength = -180
  export let linkDistance = 90
  export let scoreThreshold = 0
  export let onNodeClick: ((path: string, context: string) => void) | null = null

  export function resetView() {
    transform = { x: 0, y: 0, k: 1 }
    renderFn?.()
  }

  // ── Component state ────────────────────────────────────────────────
  let container: HTMLDivElement
  let canvas: HTMLCanvasElement
  let sim: ReturnType<typeof forceSimulation> | null = null
  let renderFn: (() => void) | null = null
  let recomputeVisFn: (() => void) | null = null
  let cleanupHandlers: (() => void) | null = null
  let visibleNodeIds = new Set<string>()
  let simNodes: SimNode[] = []
  let initialized = false
  let transform = { x: 0, y: 0, k: 1 }

  // ── Reactives ──────────────────────────────────────────────────────
  $: { showDirect; showCoCitation; showJaccard; showGap; scoreThreshold;
       recomputeVisFn?.(); renderFn?.() }

  $: if (sim) {
    ;(sim.force('charge') as any)?.strength(chargeStrength)
    sim.alpha(0.3).restart()
  }
  $: if (sim) {
    ;(sim.force('link') as any)?.distance(linkDistance)
    sim.alpha(0.3).restart()
  }

  // ── Sim init ───────────────────────────────────────────────────────
  function initSim(savedPos?: Map<string, { x: number; y: number }>) {
    cleanupHandlers?.()
    cleanupHandlers = null

    if (!container || !canvas) return
    if (!savedPos) transform = { x: 0, y: 0, k: 1 }

    const W = container.clientWidth || 400
    const H = container.clientHeight || 500
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cs = getComputedStyle(document.body)
    const col = resolveColors(cs)
    const fontFamily = cs.getPropertyValue('--font-interface').trim() || 'sans-serif'

    const { pathA, pathB } = result
    const focalAFx = W * 0.15
    const focalBFx = W * 0.85

    // Zone x target for initial random placement
    function zoneTargetX(zone: SynthesisZone | 'gap'): number {
      if (zone === 'a-only') return W * 0.25
      if (zone === 'b-only') return W * 0.75
      return W * 0.5
    }

    // Build sim nodes
    const nodes: SimNode[] = []
    for (const n of result.nodes) {
      const saved = savedPos?.get(n.path)
      const isFocalA = n.path === pathA
      const isFocalB = n.path === pathB
      const spread = 60
      const tx = isFocalA ? focalAFx : isFocalB ? focalBFx : zoneTargetX(n.zone)
      const node: SimNode = {
        id: n.path,
        zone: n.zone,
        edgeType: n.edgeType,
        inDegree: n.inDegree,
        outDegree: n.outDegree,
        x: saved?.x ?? (tx + (Math.random() - 0.5) * spread),
        y: saved?.y ?? (H / 2 + (Math.random() - 0.5) * spread),
      }
      // Focal nodes are fixed horizontally; fy is free so vertical physics applies
      if (isFocalA) node.fx = focalAFx
      if (isFocalB) node.fx = focalBFx
      nodes.push(node)
    }

    // Gap nodes in the shared / centre zone
    if (showGap) {
      for (const g of result.gaps) {
        const saved = savedPos?.get(g.path)
        nodes.push({
          id: g.path,
          zone: 'gap' as const,
          edgeType: 'gap',
          inDegree: g.inDegree,
          outDegree: g.outDegree,
          x: saved?.x ?? (W * 0.5 + (Math.random() - 0.5) * 60),
          y: saved?.y ?? (H / 2 + (Math.random() - 0.5) * 60),
        })
      }
    }

    simNodes = nodes

    // Build sim links
    const links: SimLink[] = result.edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      measure: e.measure ?? 1,
    }))
    for (const g of result.gaps) {
      links.push({ source: pathA, target: g.path, type: 'gap', measure: g.aaScore })
      links.push({ source: pathB, target: g.path, type: 'gap', measure: g.aaScore })
    }

    // ── Coordinate helpers ──────────────────────────────────────────
    function canvasXY(e: MouseEvent) {
      const r = canvas.getBoundingClientRect()
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      }
    }

    function toWorld(cx: number, cy: number) {
      return {
        x: (cx - transform.x) / transform.k,
        y: (cy - transform.y) / transform.k,
      }
    }

    // ── Node helpers ────────────────────────────────────────────────
    function nodeRadius(n: SimNode): number {
      if (n.zone === 'focal-a' || n.zone === 'focal-b') return 12
      if (n.zone === 'shared') return 9
      if (n.zone === 'gap') return 9
      return 7
    }

    function nodeFill(n: SimNode): string {
      if (n.zone === 'focal-a') return col.accent
      if (n.zone === 'focal-b') return col.cc
      if (n.zone === 'shared') return col.accent
      if (n.zone === 'a-only') return col.node
      if (n.zone === 'b-only') return col.cc
      return col.accent // gap
    }

    function nodeAlpha(n: SimNode): number {
      if (n.zone === 'focal-a' || n.zone === 'focal-b') return 1
      if (n.zone === 'shared') return 1
      return 0.65 // a-only, b-only, gap
    }

    function edgeVisible(l: SimLink): boolean {
      if (l.type === 'direct')     return showDirect
      if (l.type === 'jaccard')    return showJaccard && l.measure >= scoreThreshold
      if (l.type === 'cocitation') return showCoCitation
      if (l.type === 'gap')        return showGap
      return true
    }

    // ── Visibility cache ────────────────────────────────────────────
    function recomputeVisibility() {
      const newVisible = new Set<string>([pathA, pathB])
      for (const l of links) {
        if (!edgeVisible(l)) continue
        const s = typeof l.source === 'object' ? (l.source as SimNode).id : l.source as string
        const t = typeof l.target === 'object' ? (l.target as SimNode).id : l.target as string
        newVisible.add(s)
        newVisible.add(t)
      }
      visibleNodeIds = newVisible
    }

    recomputeVisibility()
    recomputeVisFn = recomputeVisibility

    // ── Hit detection ───────────────────────────────────────────────
    function nodeAt(wx: number, wy: number): SimNode | null {
      let best: SimNode | null = null
      for (const n of nodes) {
        if (!visibleNodeIds.has(n.id)) continue
        const r = nodeRadius(n)
        if (Math.hypot((n.x ?? 0) - wx, (n.y ?? 0) - wy) > r + 4) continue
        if (!best || r > nodeRadius(best)) best = n
      }
      return best
    }

    function nearestNode(wx: number, wy: number, threshold = 22): SimNode | null {
      let hit: SimNode | null = null
      let best = threshold
      for (const n of nodes) {
        if (!visibleNodeIds.has(n.id)) continue
        const d = Math.hypot((n.x ?? 0) - wx, (n.y ?? 0) - wy)
        if (d < best) { best = d; hit = n }
      }
      return hit
    }

    // ── Render ──────────────────────────────────────────────────────
    function render() {
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.k, transform.k)

      // Edges
      for (const l of links) {
        if (!edgeVisible(l)) continue
        const s = l.source as any
        const t = l.target as any
        if (typeof s !== 'object' || typeof t !== 'object') continue

        ctx.save()
        if (l.type === 'direct') {
          ctx.globalAlpha = 0.5
          ctx.lineWidth = 1.5
          ctx.setLineDash([])
          ctx.strokeStyle = col.direct
        } else if (l.type === 'jaccard') {
          ctx.globalAlpha = Math.min(0.85, 0.3 + l.measure * 0.4)
          ctx.lineWidth = 1
          ctx.setLineDash([6, 3])
          ctx.strokeStyle = col.accent
        } else if (l.type === 'cocitation') {
          ctx.globalAlpha = Math.min(0.85, 0.3 + l.measure * 0.2)
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.strokeStyle = col.cc
        } else {
          // gap
          ctx.globalAlpha = 0.18
          ctx.lineWidth = 1
          ctx.setLineDash([3, 5])
          ctx.strokeStyle = col.accent
        }
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.stroke()
        ctx.restore()
      }

      // Neighbourhood nodes
      for (const n of nodes) {
        if (n.zone === 'gap') continue
        if (!visibleNodeIds.has(n.id)) continue
        const r = nodeRadius(n)
        ctx.save()
        ctx.globalAlpha = nodeAlpha(n)
        ctx.beginPath()
        ctx.arc(n.x ?? W / 2, n.y ?? H / 2, r, 0, Math.PI * 2)
        ctx.fillStyle = nodeFill(n)
        ctx.fill()
        ctx.restore()
      }

      // Gap nodes
      if (showGap) {
        for (const n of nodes) {
          if (n.zone !== 'gap') continue
          const x = n.x ?? W / 2
          const y = n.y ?? H / 2
          ctx.save()
          ctx.globalAlpha = 0.45
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 3])
          ctx.strokeStyle = col.accent
          ctx.beginPath()
          ctx.arc(x, y, 9, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Labels
      ctx.save()
      ctx.font = `10px ${fontFamily}`
      ctx.textAlign = 'center'
      for (const n of nodes) {
        if (!visibleNodeIds.has(n.id)) continue
        const isFocal = n.zone === 'focal-a' || n.zone === 'focal-b'
        const r = nodeRadius(n)
        const x = n.x ?? W / 2
        const y = n.y ?? H / 2
        const label = noteName(n.id)
        const ty = y + r + 12
        ctx.globalAlpha = isFocal ? 1 : (n.zone === 'shared' ? 0.9 : 0.65)
        ctx.lineWidth = 3
        ctx.strokeStyle = col.bg
        ctx.strokeText(label, x, ty)
        ctx.fillStyle = isFocal ? col.node : col.muted
        ctx.fillText(label, x, ty)
      }
      ctx.restore()

      ctx.restore() // end transform
    }

    renderFn = render

    // ── Simulation setup ────────────────────────────────────────────
    const linkForce = forceLink(links)
      .id((d: any) => d.id)
      .distance((l: any) => (l.type === 'gap' ? linkDistance * 1.6 : linkDistance))
      .strength((l: any) => (l.type === 'gap' ? 0.1 : 0.4))

    sim = forceSimulation(nodes)
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('zoneX', forceX((d: any) => {
        if (d.zone === 'a-only') return W * 0.28
        if (d.zone === 'b-only') return W * 0.72
        return W * 0.5  // shared and gap
      }).strength(0.15))
      .force('centerY', forceY(H / 2).strength(0.05))
      .force('collide', forceCollide(14))
      .on('tick', render)

    initialized = true

    // ── Event handlers ──────────────────────────────────────────────
    let dragging: SimNode | null = null
    let panning = false
    let panStart: { cx: number; cy: number; tx: number; ty: number } | null = null
    let mouseDownCV: { x: number; y: number } | null = null

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const cv = canvasXY(e)
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newK = Math.max(0.2, Math.min(8, transform.k * factor))
      transform.x = cv.x - (cv.x - transform.x) * (newK / transform.k)
      transform.y = cv.y - (cv.y - transform.y) * (newK / transform.k)
      transform.k = newK
      renderFn?.()
    }

    function onMousedown(e: MouseEvent) {
      const cv = canvasXY(e)
      mouseDownCV = cv
      const world = toWorld(cv.x, cv.y)
      const hitNode = nearestNode(world.x, world.y)

      if (hitNode) {
        dragging = hitNode
        dragging.fx = dragging.x ?? null
        dragging.fy = dragging.y ?? null
        sim.alphaTarget(0.3).restart()
      } else {
        panning = true
        panStart = { cx: e.clientX, cy: e.clientY, tx: transform.x, ty: transform.y }
        canvas.style.cursor = 'grabbing'
      }
    }

    function onMousemove(e: MouseEvent) {
      if (dragging) {
        const cv = canvasXY(e)
        const world = toWorld(cv.x, cv.y)
        dragging.fx = world.x
        dragging.fy = world.y
        return
      }
      if (panning && panStart) {
        transform.x = panStart.tx + (e.clientX - panStart.cx)
        transform.y = panStart.ty + (e.clientY - panStart.cy)
        renderFn?.()
        return
      }
      const cv = canvasXY(e)
      const world = toWorld(cv.x, cv.y)
      const hit = nodeAt(world.x, world.y)
      canvas.style.cursor = hit ? 'pointer' : 'grab'
    }

    function onMouseup(e: MouseEvent) {
      if (dragging) {
        if (mouseDownCV) {
          const cv = canvasXY(e)
          const screenDist = Math.hypot(cv.x - mouseDownCV.x, cv.y - mouseDownCV.y)
          if (screenDist < 5 && onNodeClick) {
            const world = toWorld(mouseDownCV.x, mouseDownCV.y)
            const clicked = nodeAt(world.x, world.y)
            if (clicked) onNodeClick(clicked.id, '')
          }
        }
        const isFocal = dragging.id === pathA || dragging.id === pathB
        if (isFocal) {
          // Restore horizontal anchor; release vertical
          dragging.fx = dragging.id === pathA ? focalAFx : focalBFx
          dragging.fy = null
        } else {
          dragging.fx = null
          dragging.fy = null
        }
        sim.alphaTarget(0)
        dragging = null
      }
      if (panning) {
        panning = false
        panStart = null
        canvas.style.cursor = 'grab'
      }
      mouseDownCV = null
    }

    function onMouseleave() {
      if (dragging) {
        const isFocal = dragging.id === pathA || dragging.id === pathB
        if (isFocal) {
          dragging.fx = dragging.id === pathA ? focalAFx : focalBFx
          dragging.fy = null
        } else {
          dragging.fx = null
          dragging.fy = null
        }
        sim.alphaTarget(0)
        dragging = null
      }
      panning = false
      panStart = null
      mouseDownCV = null
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onMousedown)
    canvas.addEventListener('mousemove', onMousemove)
    canvas.addEventListener('mouseup', onMouseup)
    canvas.addEventListener('mouseleave', onMouseleave)

    cleanupHandlers = () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onMousedown)
      canvas.removeEventListener('mousemove', onMousemove)
      canvas.removeEventListener('mouseup', onMouseup)
      canvas.removeEventListener('mouseleave', onMouseleave)
    }
  }

  function reinit() {
    const savedPos = new Map<string, { x: number; y: number }>()
    for (const n of simNodes) {
      if (typeof n.x === 'number') savedPos.set(n.id, { x: n.x, y: n.y })
    }
    sim?.stop()
    sim = null
    renderFn = null
    recomputeVisFn = null
    simNodes = []
    initialized = false
    initSim(savedPos)
  }

  let resizeObserver: ResizeObserver | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  onMount(() => {
    initSim()
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        reinit()
      }, 80)
    })
    resizeObserver.observe(container)
  })

  onDestroy(() => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeObserver?.disconnect()
    cleanupHandlers?.()
    sim?.stop()
    renderFn = null
    recomputeVisFn = null
  })
</script>

<div class="GA-canvas-container" bind:this={container}>
  <canvas bind:this={canvas} />
</div>

<style>
  .GA-canvas-container {
    position: absolute;
    inset: 0;
  }

  canvas {
    display: block;
    position: absolute;
    inset: 0;
  }
</style>
