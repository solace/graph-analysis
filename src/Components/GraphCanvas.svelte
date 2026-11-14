<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    forceCenter,
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
  } from 'd3-force'
  import type { SimulationNodeDatum } from 'd3-force'
  import type { CoCitation, GapCandidate, NeighbourhoodResult } from 'src/Interfaces'

  // ── Type definitions ───────────────────────────────────────────────
  // Extending SimulationNodeDatum gives us x, y, fx, fy, vx, vy with d3's exact types,
  // which avoids implicit-any on fx/fy assignments and satisfies forceSimulation<NodeDatum>.
  interface SimNode extends SimulationNodeDatum {
    id: string
    nodeType: 'neighbour' | 'gap'
    edgeType: string
    hop?: 1 | 2
    inDegree?: number
    outDegree?: number
    fileSize?: number
    aaScore?: number
    coCitations?: CoCitation[]
  }

  interface SimLink {
    source: string | SimNode
    target: string | SimNode
    type: string
    measure: number
    hop?: 1 | 2
  }

  interface Colors {
    accent: string
    node: string
    direct: string
    cc: string
    bg: string
    hub: string
    muted: string
  }

  // ── Pure helpers (no component state) ─────────────────────────────
  function resolveColors(cs: CSSStyleDeclaration): Colors {
    return {
      accent: cs.getPropertyValue('--interactive-accent').trim() || '#7c3aed',
      node:   cs.getPropertyValue('--text-normal').trim()         || '#cdd6f4',
      direct: cs.getPropertyValue('--text-muted').trim()          || '#6c7086',
      cc:     cs.getPropertyValue('--color-orange').trim()         || '#ea8833',
      bg:     cs.getPropertyValue('--background-primary').trim()   || '#1e1e2e',
      hub:    cs.getPropertyValue('--text-warning').trim()         || '#e5c07b',
      muted:  cs.getPropertyValue('--text-muted').trim()          || '#6c7086',
    }
  }

  function buildSimNodes(
    neighbourhood: NeighbourhoodResult,
    gaps: GapCandidate[],
    savedPos: Map<string, { x: number; y: number }> | undefined,
    focalPath: string,
    W: number,
    H: number
  ): SimNode[] {
    const getPos = (id: string, spread = 60) => {
      const saved = savedPos?.get(id)
      return saved
        ? { x: saved.x, y: saved.y }
        : { x: W / 2 + (Math.random() - 0.5) * spread, y: H / 2 + (Math.random() - 0.5) * spread }
    }
    const nodes: SimNode[] = neighbourhood.nodes.map((n) => ({
      id: n.path,
      edgeType: n.edgeType,
      nodeType: 'neighbour' as const,
      hop: n.hop,
      inDegree: n.inDegree,
      outDegree: n.outDegree,
      ...getPos(n.path),
    }))
    for (const g of gaps) {
      nodes.push({
        id: g.path,
        edgeType: 'gap',
        nodeType: 'gap' as const,
        fileSize: g.fileSize,
        inDegree: g.inDegree,
        outDegree: g.outDegree,
        aaScore: g.aaScore,
        coCitations: g.coCitations,
        ...getPos(g.path, 120),
      })
    }
    return nodes
  }

  function buildSimLinks(
    neighbourhood: NeighbourhoodResult,
    gaps: GapCandidate[],
    focalPath: string
  ): SimLink[] {
    const links: SimLink[] = neighbourhood.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      measure: e.measure ?? 1,
      hop: e.hop,
    }))
    for (const g of gaps) {
      links.push({ source: focalPath, target: g.path, type: 'gap', measure: g.aaScore })
    }
    return links
  }

  // ── Props ──────────────────────────────────────────────────────────
  export let neighbourhood: NeighbourhoodResult
  export let gaps: GapCandidate[] = []
  export let focalPath: string
  export let showDirect = true
  export let showCoCitation = true
  export let showJaccard = true
  export let showGap = true
  export let chargeStrength = -200
  export let linkDistance = 80
  export let hubThreshold = 20
  export let scoreThreshold = 0
  export let onNodeClick: ((path: string, context: string) => void) | null = null
  export let reinitTrigger = 0

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
  let gapsLoaded = false
  let transform = { x: 0, y: 0, k: 1 }
  let handledReinitTrigger = 0

  // ── Reactives ──────────────────────────────────────────────────────
  $: { showDirect; showCoCitation; showJaccard; showGap; scoreThreshold;
       recomputeVisFn?.(); renderFn?.() }
  $: { hubThreshold; renderFn?.() }

  $: if (sim) {
    ;(sim.force('charge') as any)?.strength(chargeStrength)
    sim.alpha(0.3).restart()
  }
  $: if (sim) {
    ;(sim.force('link') as any)?.distance(linkDistance)
    sim.alpha(0.3).restart()
  }

  // gapsLoaded is not reset in reinit() — gaps stay in the prop and initSim()
  // reads the current prop value each time, so they're included automatically.
  $: if (!gapsLoaded && initialized && gaps.length > 0) {
    gapsLoaded = true
    reinit()
  }

  // Reinit when hop depth or hop-2 filters change (neighbourhood prop already updated
  // by this point — Svelte batches all prop updates before child reactives run).
  $: if (initialized && reinitTrigger > 0 && reinitTrigger !== handledReinitTrigger) {
    handledReinitTrigger = reinitTrigger
    reinit()
  }

  // ── Utilities ──────────────────────────────────────────────────────
  function devFraction(fileSize: number): number {
    if (fileSize < 200) return 0
    if (fileSize < 2000) return 0.25
    if (fileSize < 5000) return 0.5
    if (fileSize < 15000) return 0.75
    return 1
  }

  function noteName(path: string): string {
    const base = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path
    return base.length > 20 ? base.slice(0, 19) + '…' : base
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

    const nodes = buildSimNodes(neighbourhood, gaps, savedPos, focalPath, W, H)
    const links = buildSimLinks(neighbourhood, gaps, focalPath)
    simNodes = nodes

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
    function isHubNode(n: SimNode): boolean {
      return (
        n.nodeType === 'neighbour' &&
        n.id !== focalPath &&
        (n.inDegree ?? 0) + (n.outDegree ?? 0) >= hubThreshold
      )
    }

    function nodeRadius(n: SimNode): number {
      let r: number
      if (n.id === focalPath) r = 12
      else if (n.nodeType === 'gap') r = 9
      else if (isHubNode(n)) r = 10
      else r = 7
      return n.hop === 2 ? r * 0.7 : r
    }

    // scoreThreshold applies only to Jaccard (0–1 range). CC and gap edges
    // are controlled solely by their layer toggles.
    function edgeVisible(l: SimLink): boolean {
      if (l.type === 'direct')     return showDirect
      if (l.type === 'jaccard')    return showJaccard && l.measure >= scoreThreshold
      if (l.type === 'cocitation') return showCoCitation
      if (l.type === 'gap')        return showGap
      return true
    }

    // ── Visibility cache ────────────────────────────────────────────
    // Precomputed once per layer/threshold change — O(edges) instead of
    // O(nodes × edges) per render tick.
    function recomputeVisibility() {
      const newVisible = new Set<string>([focalPath])
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
    // Linear scan: largest-radius hit wins. O(nodes) per call, no allocations.
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
        const hopFade = l.hop === 2 ? 0.65 : 1
        if (l.type === 'direct') {
          ctx.globalAlpha = 0.6 * hopFade
          ctx.lineWidth = 1.5
          ctx.setLineDash([])
          ctx.strokeStyle = col.direct
        } else if (l.type === 'jaccard') {
          ctx.globalAlpha = Math.min(0.9, 0.3 + l.measure * 0.4) * hopFade
          ctx.lineWidth = 1
          ctx.setLineDash([6, 3])
          ctx.strokeStyle = col.accent
        } else if (l.type === 'cocitation') {
          ctx.globalAlpha = Math.min(0.9, 0.3 + l.measure * 0.2) * hopFade
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.strokeStyle = col.cc
        } else {
          ctx.globalAlpha = 0.2 * hopFade
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
        if (n.nodeType !== 'neighbour') continue
        if (!visibleNodeIds.has(n.id)) continue

        const isFocal = n.id === focalPath
        const r = nodeRadius(n)
        const fill = isFocal ? col.accent
          : n.edgeType === 'jaccard' ? col.accent
          : n.edgeType === 'cocitation' ? col.cc
          : col.node

        const hopFade = n.hop === 2 ? 0.65 : 1
        ctx.save()
        ctx.globalAlpha = (isFocal ? 1 : 0.85) * hopFade
        ctx.beginPath()
        ctx.arc(n.x ?? W / 2, n.y ?? H / 2, r, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
        ctx.restore()

        if (isHubNode(n)) {
          ctx.save()
          ctx.globalAlpha = 0.8 * hopFade
          ctx.lineWidth = 2
          ctx.setLineDash([])
          ctx.strokeStyle = col.hub
          ctx.beginPath()
          ctx.arc(n.x ?? W / 2, n.y ?? H / 2, r + 3, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Gap nodes
      if (showGap) {
        for (const n of nodes) {
          if (n.nodeType !== 'gap') continue
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

          const frac = devFraction(n.fileSize ?? 0)
          if (frac > 0) {
            ctx.setLineDash([])
            ctx.lineWidth = 2.5
            ctx.globalAlpha = 0.6
            ctx.strokeStyle = col.accent
            ctx.beginPath()
            ctx.arc(x, y, 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      // Labels — font family resolved at initSim time (CSS vars don't work in canvas font strings)
      ctx.save()
      ctx.font = `10px ${fontFamily}`
      ctx.textAlign = 'center'
      for (const n of nodes) {
        if (!visibleNodeIds.has(n.id)) continue
        const isFocal = n.id === focalPath
        const r = nodeRadius(n)
        const x = n.x ?? W / 2
        const y = n.y ?? H / 2
        const label = noteName(n.id)
        const ty = y + r + 12

        const hopFade = (n as SimNode).hop === 2 ? 0.65 : 1
        ctx.globalAlpha = (isFocal ? 1 : 0.75) * hopFade
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
      .distance((l: any) => (l.type === 'gap' ? linkDistance * 1.8 : linkDistance))
      .strength((l: any) => (l.type === 'gap' ? 0.1 : 0.5))

    sim = forceSimulation(nodes)
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('center', forceCenter(W / 2, H / 2))
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
      canvas.style.cursor = hit
        ? (hit.id === focalPath ? 'default' : 'pointer')
        : 'grab'
    }

    function onMouseup(e: MouseEvent) {
      if (dragging) {
        if (mouseDownCV) {
          const cv = canvasXY(e)
          const screenDist = Math.hypot(cv.x - mouseDownCV.x, cv.y - mouseDownCV.y)
          if (screenDist < 5 && onNodeClick) {
            const world = toWorld(mouseDownCV.x, mouseDownCV.y)
            const clicked = nodeAt(world.x, world.y)
            if (clicked && clicked.id !== focalPath) {
              let context = ''
              if (clicked.nodeType === 'gap') {
                const topCC = clicked.coCitations?.[0]
                context = topCC?.sentence?.join(' ') ?? ''
              }
              onNodeClick(clicked.id, context)
            }
          }
        }
        dragging.fx = null
        dragging.fy = null
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
        dragging.fx = null
        dragging.fy = null
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
    position: relative;
    width: 100%;
    flex: 1 1 0;
    min-height: 0;
  }

  canvas {
    display: block;
    position: absolute;
    inset: 0;
  }
</style>
