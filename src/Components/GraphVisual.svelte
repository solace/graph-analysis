<script lang="ts">
  import GraphCanvas from 'src/Components/GraphCanvas.svelte'
  import GraphControls from 'src/Components/GraphControls.svelte'
  import type { GapCandidate, NeighbourhoodResult } from 'src/Interfaces'

  export let neighbourhood: NeighbourhoodResult
  export let hop2Neighbourhood: NeighbourhoodResult = { nodes: [], edges: [] }
  export let gaps: GapCandidate[] = []
  export let focalPath: string
  export let hubThresholdDefault = 20
  export let onNodeClick: ((path: string, context: string) => void) | null = null
  export let onCompare: (() => void) | null = null

  let showDirect = true
  let showCoCitation = true
  let showJaccard = true
  let showGap = true
  let chargeStrength = -200
  let linkDistance = 80
  let scoreThreshold = 0
  let hopDepth: 1 | 2 = 1
  let hubThreshold = hubThresholdDefault
  let hop2MinDegree = 1
  let hop2NodeCap = 30
  // Starts at -1 so the initial reactive run increments to 0, which GraphCanvas
  // treats as "no trigger yet". Real triggers start at 1.
  let canvasReinitTrigger = -1
  $: { hopDepth; hop2MinDegree; hop2NodeCap; canvasReinitTrigger = canvasReinitTrigger + 1 }

  // Merge hop-1 and filtered hop-2 data reactively.
  // hop2Neighbourhood arrives pre-loaded with defaults (minDegree=1, cap=30).
  // Panel sliders filter client-side from the full pre-loaded set.
  // hop2Neighbourhood.nodes arrives pre-sorted by totalDegree desc from getHop2Nodes.
  // Filter preserves that order, so slice(0, hop2NodeCap) gives the top N correctly.
  $: activeHop2Nodes = hopDepth === 2
    ? hop2Neighbourhood.nodes
        .filter(n => (n.inDegree + n.outDegree) >= hop2MinDegree)
        .slice(0, hop2NodeCap)
    : []
  $: activeHop2NodePaths = new Set(activeHop2Nodes.map(n => n.path))
  $: activeHop2Edges = hop2Neighbourhood.edges.filter(e => activeHop2NodePaths.has(e.target))
  $: activeNeighbourhood = {
    nodes: [...neighbourhood.nodes, ...activeHop2Nodes],
    edges: [...neighbourhood.edges, ...activeHop2Edges],
  }

  let canvasRef: any
</script>

<div class="GA-visual-wrapper">
  <GraphControls
    bind:showDirect
    bind:showCoCitation
    bind:showJaccard
    bind:showGap
    bind:chargeStrength
    bind:linkDistance
    bind:scoreThreshold
    bind:hopDepth
    bind:hubThreshold
    bind:hop2MinDegree
    bind:hop2NodeCap
    {onCompare}
    on:resetView={() => canvasRef?.resetView()}
  />
  <GraphCanvas
    bind:this={canvasRef}
    neighbourhood={activeNeighbourhood}
    reinitTrigger={canvasReinitTrigger}
    {gaps}
    {focalPath}
    {showDirect}
    {showCoCitation}
    {showJaccard}
    {showGap}
    {chargeStrength}
    {linkDistance}
    {scoreThreshold}
    {hubThreshold}
    {onNodeClick}
  />
</div>

<style>
  .GA-visual-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
