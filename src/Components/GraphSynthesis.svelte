<script lang="ts">
  import GraphSynthesisCanvas from 'src/Components/GraphSynthesisCanvas.svelte'
  import GraphSynthesisControls from 'src/Components/GraphSynthesisControls.svelte'
  import type { SynthesisResult } from 'src/Interfaces'

  export let result: SynthesisResult
  export let onNodeClick: ((path: string, context: string) => void) | null = null
  export let onBack: (() => void) | null = null

  let showDirect = true
  let showCoCitation = true
  let showJaccard = true
  let showGap = true
  let chargeStrength = -180
  let linkDistance = 90
  let scoreThreshold = 0

  let canvasRef: any

  function noteName(path: string): string {
    return path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path
  }
</script>

<div class="GA-synthesis-wrapper">
  <GraphSynthesisControls
    bind:showDirect
    bind:showCoCitation
    bind:showJaccard
    bind:showGap
    bind:chargeStrength
    bind:linkDistance
    bind:scoreThreshold
    nameA={noteName(result.pathA)}
    nameB={noteName(result.pathB)}
    {onBack}
    on:resetView={() => canvasRef?.resetView()}
  />
  <GraphSynthesisCanvas
    bind:this={canvasRef}
    {result}
    {showDirect}
    {showCoCitation}
    {showJaccard}
    {showGap}
    {chargeStrength}
    {linkDistance}
    {scoreThreshold}
    {onNodeClick}
  />
</div>

<style>
  .GA-synthesis-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
