<script lang="ts">
  import GraphCanvas from 'src/Components/GraphCanvas.svelte'
  import GraphControls from 'src/Components/GraphControls.svelte'
  import type { GapCandidate, NeighbourhoodResult } from 'src/Interfaces'

  export let neighbourhood: NeighbourhoodResult
  export let gaps: GapCandidate[] = []
  export let focalPath: string
  export let hubThreshold = 20
  export let onNodeClick: ((path: string, context: string) => void) | null = null

  let showDirect = true
  let showCoCitation = true
  let showJaccard = true
  let showGap = true
  let chargeStrength = -200
  let linkDistance = 80
  let scoreThreshold = 0

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
    on:resetView={() => canvasRef?.resetView()}
  />
  <GraphCanvas
    bind:this={canvasRef}
    {neighbourhood}
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
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
