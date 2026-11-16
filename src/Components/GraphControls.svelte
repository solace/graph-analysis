<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { setIcon } from 'obsidian'

  export let showDirect = true
  export let showCoCitation = true
  export let showJaccard = true
  export let showGap = true
  export let chargeStrength = -200
  export let linkDistance = 80
  export let scoreThreshold = 0
  export let hopDepth: 1 | 2 = 1
  export let hubThreshold = 20
  export let hop2MinDegree = 1
  export let hop2NodeCap = 30
  export let onCompare: (() => void) | null = null

  const dispatch = createEventDispatcher()

  let panelOpen = false
  let filtersOpen = true
  let nodesOpen = false
  let displayOpen = true
  let forcesOpen = false

  function iconEl(el: HTMLElement, name: string) {
    setIcon(el, name)
    return { update: (n: string) => setIcon(el, n) }
  }

  function toggleOnKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }
</script>

<!-- Overlay: covers canvas without taking layout space -->
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
    {#if onCompare}
    <button
      class="clickable-icon GA-action-btn"
      on:click={onCompare}
      aria-label="Compare with another note"
    >
      <span use:iconEl={'git-compare'} />
    </button>
    {/if}
  </div>

  {#if panelOpen}
  <div class="GA-settings-panel">

    <!-- Filters: edge toggles + depth -->
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

        <div class="setting-item GA-depth-heading">
          <div class="setting-item-info">
            <div class="setting-item-name">Depth</div>
          </div>
          <div class="setting-item-control">
            <div class="GA-hop-toggle">
              <button
                class="GA-hop-btn"
                class:mod-cta={hopDepth === 1}
                on:click={() => (hopDepth = 1)}
              >1-hop</button>
              <button
                class="GA-hop-btn"
                class:mod-cta={hopDepth === 2}
                on:click={() => (hopDepth = 2)}
              >2-hop</button>
            </div>
          </div>
        </div>

        {#if hopDepth === 2}
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Min degree</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{hop2MinDegree}</span>
            <input type="range" min="1" max="50" step="1" bind:value={hop2MinDegree} />
          </div>
        </div>
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Max nodes</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{hop2NodeCap}</span>
            <input type="range" min="1" max="50" step="1" bind:value={hop2NodeCap} />
          </div>
        </div>
        {/if}
      </div>
      {/if}
    </div>

    <!-- Nodes: visual legend -->
    <div class="GA-section">
      <button class="GA-section-header" on:click={() => (nodesOpen = !nodesOpen)}>
        <span>Nodes</span>
        <span use:iconEl={nodesOpen ? 'chevron-down' : 'chevron-right'} class="GA-chevron" />
      </button>
      {#if nodesOpen}
      <div class="GA-section-body GA-legend-body">
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-focal" /><span>Current note</span></div>
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-direct" /><span>Wikilink</span></div>
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-hub" /><span>Hub (high degree)</span></div>
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-jaccard" /><span>Jaccard similar</span></div>
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-cc" /><span>Co-cited</span></div>
        <div class="GA-legend-row"><span class="GA-node-icon GA-node-gap" /><span>Gap candidate</span></div>
        <div class="GA-legend-row GA-legend-subrow"><span class="GA-node-icon GA-node-dev" /><span>── dev level</span></div>
      </div>
      {/if}
    </div>

    <!-- Display: scoring threshold + hub degree -->
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
        <div class="setting-item">
          <div class="setting-item-info">
            <div class="setting-item-name">Hub degree</div>
          </div>
          <div class="setting-item-control">
            <span class="GA-slider-val">{hubThreshold}</span>
            <input type="range" min="1" max="200" step="1" bind:value={hubThreshold} />
          </div>
        </div>
      </div>
      {/if}
    </div>

    <!-- Forces: simulation parameters -->
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
  /* Root overlay — position absolute so it doesn't affect flex layout */
  .GA-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  /* Action bar: two icon buttons in the top-right corner */
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

  /* Floating settings panel */
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

  /* Accordion section */
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

  /* Compact setting-item rows inside the floating panel */
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

  /* Depth row — slightly heavier separator above it */
  .GA-depth-heading {
    border-top: 1px solid var(--background-modifier-border) !important;
  }

  .GA-depth-heading .setting-item-name {
    font-size: 11px !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }

  /* Hop toggle segmented buttons */
  .GA-hop-toggle {
    display: flex;
    gap: 2px;
  }

  .GA-hop-btn {
    all: unset;
    cursor: pointer;
    padding: 2px 7px;
    border-radius: var(--radius-s, 3px);
    font-size: 11px;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .GA-hop-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .GA-hop-btn.mod-cta {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  /* Slider value label */
  .GA-slider-val {
    min-width: 26px;
    text-align: right;
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  /* Range inputs: Obsidian-native thumb sizing */
  .GA-section-body input[type=range] {
    width: 80px;
    --slider-thumb-width: var(--slider-s-thumb-size);
    --slider-thumb-height: var(--slider-s-thumb-size);
    --slider-thumb-y: var(--slider-s-thumb-position);
  }

  /* Edge type swatches */
  .GA-swatch {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }

  .GA-swatch-direct  { width: 16px; height: 3px; background: var(--text-muted); border-radius: 1px; }
  .GA-swatch-jaccard { width: 16px; height: 3px; background: var(--interactive-accent); border-radius: 1px; }
  .GA-swatch-cc      { width: 16px; height: 3px; background: var(--color-orange, #ea8833); border-radius: 1px; }
  .GA-swatch-gap     { width: 10px; height: 10px; background: transparent; border: 2px dashed var(--interactive-accent); border-radius: 50%; }

  /* Node legend rows */
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

  .GA-node-icon {
    display: inline-block;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .GA-node-focal   { width: 14px; height: 14px; background: var(--interactive-accent); }
  .GA-node-direct  { width: 9px; height: 9px; background: var(--text-normal); opacity: 0.85; }
  .GA-node-hub     { width: 11px; height: 11px; background: var(--text-normal); opacity: 0.85; outline: 2px solid var(--text-warning, #e5c07b); outline-offset: 2px; }
  .GA-node-jaccard { width: 9px; height: 9px; background: var(--interactive-accent); opacity: 0.85; }
  .GA-node-cc      { width: 9px; height: 9px; background: var(--color-orange, #ea8833); opacity: 0.85; }
  .GA-node-gap     { width: 11px; height: 11px; background: transparent; border: 2px dashed var(--interactive-accent); opacity: 0.6; }
  .GA-node-dev     {
    width: 7px; height: 7px;
    background: transparent;
    border: 2px solid var(--interactive-accent);
    border-right-color: transparent;
    border-bottom-color: transparent;
    opacity: 0.7;
    transform: rotate(-45deg);
    border-radius: 0;
  }
</style>
