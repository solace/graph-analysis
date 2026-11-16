<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { setIcon } from 'obsidian'

  export let showDirect = true
  export let showCoCitation = true
  export let showJaccard = true
  export let showGap = true
  export let chargeStrength = -180
  export let linkDistance = 90
  export let scoreThreshold = 0
  // Name labels for the two focal notes (shown in legend)
  export let nameA = 'Note A'
  export let nameB = 'Note B'
  export let onBack: (() => void) | null = null

  const dispatch = createEventDispatcher()

  function toggleOnKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  let panelOpen = false
  let filtersOpen = true
  let nodesOpen = true
  let displayOpen = false
  let forcesOpen = false

  function iconEl(el: HTMLElement, name: string) {
    setIcon(el, name)
    return { update: (n: string) => setIcon(el, n) }
  }
</script>

<div class="GA-overlay">
  <div class="GA-action-bar">
    <button
      class="clickable-icon GA-action-btn"
      class:is-active={panelOpen}
      on:click={() => (panelOpen = !panelOpen)}
      aria-label="Graph settings"
    >
      <span use:iconEl={'settings'} />
    </button>
    <button
      class="clickable-icon GA-action-btn"
      on:click={() => dispatch('resetView')}
      aria-label="Reset pan and zoom"
    >
      <span use:iconEl={'crosshair'} />
    </button>
    {#if onBack}
    <button
      class="clickable-icon GA-action-btn"
      on:click={onBack}
      aria-label="Back to single note"
    >
      <span use:iconEl={'arrow-left'} />
    </button>
    {/if}
  </div>

  {#if panelOpen}
  <div class="GA-settings-panel">

    <!-- Filters: edge toggles -->
    <div class="GA-section">
      <button class="GA-section-header" on:click={() => (filtersOpen = !filtersOpen)}>
        <span>Filters</span>
        <span use:iconEl={filtersOpen ? 'chevron-down' : 'chevron-right'} class="GA-chevron" />
      </button>
      {#if filtersOpen}
      <div class="GA-section-body">
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">
              <span class="GA-swatch GA-swatch-direct" /> Direct
            </div>
          </div>
          <div class="setting-item-control">
            <div
              class="checkbox-container"
              class:is-enabled={showDirect}
              role="switch"
              aria-checked={showDirect}
              tabindex="0"
              on:click={() => (showDirect = !showDirect)}
              on:keydown={(e) => toggleOnKey(e, () => (showDirect = !showDirect))}
            />
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">
              <span class="GA-swatch GA-swatch-jaccard" /> Jaccard
            </div>
          </div>
          <div class="setting-item-control">
            <div
              class="checkbox-container"
              class:is-enabled={showJaccard}
              role="switch"
              aria-checked={showJaccard}
              tabindex="0"
              on:click={() => (showJaccard = !showJaccard)}
              on:keydown={(e) => toggleOnKey(e, () => (showJaccard = !showJaccard))}
            />
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">
              <span class="GA-swatch GA-swatch-cc" /> Co-Citation
            </div>
          </div>
          <div class="setting-item-control">
            <div
              class="checkbox-container"
              class:is-enabled={showCoCitation}
              role="switch"
              aria-checked={showCoCitation}
              tabindex="0"
              on:click={() => (showCoCitation = !showCoCitation)}
              on:keydown={(e) => toggleOnKey(e, () => (showCoCitation = !showCoCitation))}
            />
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">
              <span class="GA-swatch GA-swatch-gap" /> Gap
            </div>
          </div>
          <div class="setting-item-control">
            <div
              class="checkbox-container"
              class:is-enabled={showGap}
              role="switch"
              aria-checked={showGap}
              tabindex="0"
              on:click={() => (showGap = !showGap)}
              on:keydown={(e) => toggleOnKey(e, () => (showGap = !showGap))}
            />
          </div>
        </div>
      </div>
      {/if}
    </div>

    <!-- Nodes: zone legend (open by default — zones are unique to synthesis) -->
    <div class="GA-section">
      <button class="GA-section-header" on:click={() => (nodesOpen = !nodesOpen)}>
        <span>Nodes</span>
        <span use:iconEl={nodesOpen ? 'chevron-down' : 'chevron-right'} class="GA-chevron" />
      </button>
      {#if nodesOpen}
      <div class="GA-section-body GA-legend-body">
        <div class="GA-legend-row">
          <span class="GA-node-icon GA-node-focal-a" />
          <span class="GA-legend-name">{nameA}</span>
        </div>
        <div class="GA-legend-row">
          <span class="GA-node-icon GA-node-focal-b" />
          <span class="GA-legend-name">{nameB}</span>
        </div>
        <div class="GA-legend-row">
          <span class="GA-node-icon GA-node-shared" />
          <span>Shared</span>
        </div>
        <div class="GA-legend-row GA-legend-subrow">
          <span class="GA-node-icon GA-node-a-only" />
          <span>{nameA} only</span>
        </div>
        <div class="GA-legend-row GA-legend-subrow">
          <span class="GA-node-icon GA-node-b-only" />
          <span>{nameB} only</span>
        </div>
        <div class="GA-legend-row">
          <span class="GA-node-icon GA-node-gap" />
          <span>Gap candidate</span>
        </div>
      </div>
      {/if}
    </div>

    <!-- Display: Min Jaccard -->
    <div class="GA-section">
      <button class="GA-section-header" on:click={() => (displayOpen = !displayOpen)}>
        <span>Display</span>
        <span use:iconEl={displayOpen ? 'chevron-down' : 'chevron-right'} class="GA-chevron" />
      </button>
      {#if displayOpen}
      <div class="GA-section-body">
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Min Jaccard</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{scoreThreshold.toFixed(2)}</span>
            <input type="range" min="0" max="1" step="0.05" bind:value={scoreThreshold} />
          </div>
        </div>
      </div>
      {/if}
    </div>

    <!-- Forces -->
    <div class="GA-section">
      <button class="GA-section-header" on:click={() => (forcesOpen = !forcesOpen)}>
        <span>Forces</span>
        <span use:iconEl={forcesOpen ? 'chevron-down' : 'chevron-right'} class="GA-chevron" />
      </button>
      {#if forcesOpen}
      <div class="GA-section-body">
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Repulsion</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{-chargeStrength}</span>
            <input type="range" min="-600" max="-30" step="10" bind:value={chargeStrength} />
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Link dist</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{linkDistance}</span>
            <input type="range" min="30" max="200" step="5" bind:value={linkDistance} />
          </div>
        </div>
      </div>
      {/if}
    </div>

  </div>
  {/if}
</div>

<style>
  .GA-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .GA-action-bar {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 2px;
    pointer-events: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    padding: 2px;
    box-shadow: var(--shadow-xs, 0 1px 3px rgba(0,0,0,.12));
  }

  .GA-settings-panel {
    position: absolute;
    top: 46px;
    right: 8px;
    width: 230px;
    max-height: calc(100% - 64px);
    overflow-y: auto;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    box-shadow: var(--shadow-s);
    pointer-events: auto;
  }

  .GA-section {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .GA-section:last-child {
    border-bottom: none;
  }

  .GA-section-header {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .GA-section-header:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .GA-chevron {
    color: var(--text-faint);
    flex-shrink: 0;
  }

  .GA-section-body {
    padding-bottom: 4px;
  }

  .GA-section-body .setting-item {
    padding: 6px 12px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .GA-section-body .setting-item:first-child {
    border-top: none;
  }

  .GA-section-body .setting-item-name {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .GA-section-body .setting-item-control {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .GA-slider-val {
    min-width: 26px;
    text-align: right;
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .GA-section-body input[type=range] {
    width: 80px;
    --slider-thumb-width: var(--slider-s-thumb-size);
    --slider-thumb-height: var(--slider-s-thumb-size);
    --slider-thumb-y: var(--slider-s-thumb-position);
  }

  .GA-swatch {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }

  .GA-swatch-direct  { width: 16px; height: 3px; background: var(--text-muted); border-radius: 1px; }
  .GA-swatch-jaccard { width: 16px; height: 3px; background: var(--interactive-accent); border-radius: 1px; }
  .GA-swatch-cc      { width: 16px; height: 3px; background: var(--color-orange, #ea8833); border-radius: 1px; }
  .GA-swatch-gap     { width: 10px; height: 10px; background: transparent; border: 2px dashed var(--interactive-accent); border-radius: 50%; }

  /* Zone legend */
  .GA-legend-body {
    padding: 4px 0 6px;
  }

  .GA-legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 12px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .GA-legend-subrow {
    padding-left: 20px;
    color: var(--text-faint);
    font-size: 10px;
  }

  .GA-legend-name {
    font-weight: 500;
    color: var(--text-normal);
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .GA-node-icon {
    display: inline-block;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .GA-node-focal-a { width: 14px; height: 14px; background: var(--interactive-accent); }
  .GA-node-focal-b { width: 14px; height: 14px; background: var(--color-orange, #ea8833); }
  .GA-node-shared  { width: 9px; height: 9px; background: var(--interactive-accent); opacity: 0.85; }
  .GA-node-a-only  { width: 7px; height: 7px; background: var(--text-normal); opacity: 0.65; }
  .GA-node-b-only  { width: 7px; height: 7px; background: var(--color-orange, #ea8833); opacity: 0.65; }
  .GA-node-gap     { width: 11px; height: 11px; background: transparent; border: 2px dashed var(--interactive-accent); opacity: 0.6; }
</style>
