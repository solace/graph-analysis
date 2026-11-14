<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let showDirect = true
  export let showCoCitation = true
  export let showJaccard = true
  export let showGap = true
  export let chargeStrength = -200
  export let linkDistance = 80
  export let scoreThreshold = 0

  const dispatch = createEventDispatcher()
  let expanded = true
</script>

<div class="GA-controls" class:collapsed={!expanded}>
  <div class="GA-controls-header">
    <button
      class="GA-controls-toggle"
      on:click={() => (expanded = !expanded)}
      title={expanded ? 'Hide controls' : 'Show controls'}
    >
      {expanded ? '▾' : '▸'} Filters
    </button>
    <button
      class="GA-reset-btn"
      on:click={() => dispatch('resetView')}
      title="Reset pan and zoom"
    >⌖</button>
  </div>

  {#if expanded}
    <div class="GA-controls-body">
      <div class="GA-controls-section">
        <span class="GA-controls-label">Edges</span>
        <label class="GA-layer-toggle">
          <input type="checkbox" bind:checked={showDirect} />
          <span class="GA-layer-swatch GA-swatch-direct" /> Direct
        </label>
        <label class="GA-layer-toggle">
          <input type="checkbox" bind:checked={showJaccard} />
          <span class="GA-layer-swatch GA-swatch-jaccard" /> Jaccard
        </label>
        <label class="GA-layer-toggle">
          <input type="checkbox" bind:checked={showCoCitation} />
          <span class="GA-layer-swatch GA-swatch-cc" /> Co-Citation
        </label>
        <label class="GA-layer-toggle">
          <input type="checkbox" bind:checked={showGap} />
          <span class="GA-layer-swatch GA-swatch-gap" /> Gap
        </label>
      </div>

      <div class="GA-controls-section">
        <span class="GA-controls-label">Nodes</span>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-focal" />
          <span>Current note</span>
        </div>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-direct" />
          <span>Wikilink</span>
        </div>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-hub" />
          <span>Hub (high degree)</span>
        </div>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-jaccard" />
          <span>Jaccard similar</span>
        </div>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-cc" />
          <span>Co-cited</span>
        </div>
        <div class="GA-node-legend-row">
          <span class="GA-node-icon GA-node-gap" />
          <span>Gap candidate</span>
        </div>
        <div class="GA-node-legend-row GA-node-legend-subrow">
          <span class="GA-node-icon GA-node-dev" />
          <span>── dev level</span>
        </div>
      </div>

      <div class="GA-controls-section">
        <span class="GA-controls-label">Display</span>
        <label class="GA-slider-row">
          <span>Min Jaccard</span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scoreThreshold} />
          <span class="GA-slider-val">{scoreThreshold.toFixed(2)}</span>
        </label>
      </div>

      <div class="GA-controls-section">
        <span class="GA-controls-label">Forces</span>
        <label class="GA-slider-row">
          <span>Repulsion</span>
          <input type="range" min="-600" max="-30" step="10" bind:value={chargeStrength} />
          <span class="GA-slider-val">{-chargeStrength}</span>
        </label>
        <label class="GA-slider-row">
          <span>Link dist</span>
          <input type="range" min="30" max="200" step="5" bind:value={linkDistance} />
          <span class="GA-slider-val">{linkDistance}</span>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .GA-controls {
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    font-size: 12px;
    flex-shrink: 0;
  }

  .GA-controls-header {
    display: flex;
    align-items: center;
  }

  .GA-controls-toggle {
    all: unset;
    cursor: pointer;
    flex: 1;
    padding: 4px 8px;
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .GA-controls-toggle:hover { color: var(--text-normal); }

  .GA-reset-btn {
    all: unset;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 15px;
    color: var(--text-faint);
    border-left: 1px solid var(--background-modifier-border);
    line-height: 1;
  }

  .GA-reset-btn:hover { color: var(--text-normal); }

  .GA-controls-body {
    display: flex;
    gap: 12px;
    padding: 4px 8px 8px;
    flex-wrap: wrap;
  }

  .GA-controls-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .GA-controls-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin-bottom: 2px;
  }

  /* Edge toggles */
  .GA-layer-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    color: var(--text-muted);
    user-select: none;
  }

  .GA-layer-toggle:hover { color: var(--text-normal); }

  .GA-layer-swatch {
    display: inline-block;
    width: 16px;
    height: 3px;
    border-radius: 1px;
  }

  .GA-swatch-direct  { background: var(--text-muted); }
  .GA-swatch-jaccard { background: var(--interactive-accent); }
  .GA-swatch-cc      { background: var(--color-orange, #ea8833); }
  .GA-swatch-gap {
    background: transparent;
    border: 2px dashed var(--interactive-accent);
    height: 10px;
    border-radius: 50%;
    width: 10px;
  }

  /* Node legend */
  .GA-node-legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 11px;
  }

  .GA-node-legend-subrow {
    padding-left: 4px;
    color: var(--text-faint);
    font-size: 10px;
  }

  .GA-node-icon {
    display: inline-block;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .GA-node-focal {
    width: 14px; height: 14px;
    background: var(--interactive-accent);
  }

  .GA-node-direct {
    width: 9px; height: 9px;
    background: var(--text-normal);
    opacity: 0.85;
  }

  .GA-node-hub {
    width: 11px; height: 11px;
    background: var(--text-normal);
    opacity: 0.85;
    outline: 2px solid var(--text-warning, #e5c07b);
    outline-offset: 2px;
  }

  .GA-node-jaccard {
    width: 9px; height: 9px;
    background: var(--interactive-accent);
    opacity: 0.85;
  }

  .GA-node-cc {
    width: 9px; height: 9px;
    background: var(--color-orange, #ea8833);
    opacity: 0.85;
  }

  .GA-node-gap {
    width: 11px; height: 11px;
    background: transparent;
    border: 2px dashed var(--interactive-accent);
    opacity: 0.6;
  }

  .GA-node-dev {
    width: 7px; height: 7px;
    background: transparent;
    border: 2px solid var(--interactive-accent);
    border-right-color: transparent;
    border-bottom-color: transparent;
    opacity: 0.7;
    transform: rotate(-45deg);
  }

  /* Sliders */
  .GA-slider-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
  }

  .GA-slider-row input[type=range] {
    width: 90px;
    accent-color: var(--interactive-accent);
  }

  .GA-slider-val {
    min-width: 28px;
    text-align: right;
    color: var(--text-faint);
  }
</style>
