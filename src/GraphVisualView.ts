import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian'
import { VIEW_TYPE_GRAPH_ANALYSIS_VISUAL } from 'src/Constants'
import GraphVisual from 'src/Components/GraphVisual.svelte'
import { getGapCandidates, getNeighbourhood } from 'src/GraphVisualData'
import type GraphAnalysisPlugin from 'src/main'

export default class GraphVisualView extends ItemView {
  plugin: GraphAnalysisPlugin
  focalPath: string | null = null
  private component: any = null
  private drawSeq = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(leaf: WorkspaceLeaf, plugin: GraphAnalysisPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getViewType(): string {
    return VIEW_TYPE_GRAPH_ANALYSIS_VISUAL
  }

  getDisplayText(): string {
    return 'Graph Analysis — Visual'
  }

  icon = 'git-fork'

  async onOpen(): Promise<void> {
    this.addAction('refresh-cw', 'Refresh graph', () => this.draw())

    this.focalPath = this.app.workspace.getActiveFile()?.path ?? null

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.path !== this.focalPath) {
          this.focalPath = file.path
          this.scheduleDraw()
        }
      })
    )

    this.draw()
  }

  onClose(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.component?.$destroy()
    this.component = null
    return Promise.resolve()
  }

  // Debounced entry point — used for file-open events and settings changes.
  // Direct draw() calls (manual refresh, graph index rebuild) bypass the debounce.
  scheduleDraw() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.draw()
    }, 100)
  }

  async draw(): Promise<void> {
    const seq = ++this.drawSeq

    this.component?.$destroy()
    this.component = null

    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('GA-Visual-View')

    if (!this.plugin.g || !this.focalPath) {
      contentEl.createEl('p', { text: 'Waiting for index…' })
      return
    }

    contentEl.createEl('p', { text: 'Building neighbourhood…' })

    const { neighbourhood, ccMap } = await getNeighbourhood(this.plugin, this.focalPath)
    if (seq !== this.drawSeq) return

    contentEl.empty()

    const onNodeClick = (path: string, context: string) => {
      const file = this.plugin.app.vault.getAbstractFileByPath(path)
      if (!(file instanceof TFile)) {
        new Notice(`Note not found: ${path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path}`)
        return
      }
      this.plugin.app.workspace.getLeaf(false).openFile(file)
      if (context) new Notice(context.slice(0, 250), 6000)
    }

    this.component = new GraphVisual({
      target: contentEl,
      props: {
        neighbourhood,
        focalPath: this.focalPath,
        gaps: [],
        hubThreshold: this.plugin.settings.hubDegreeThreshold,
        onNodeClick,
      },
    })

    // ccMap from getNeighbourhood is reused here — Co-Citations runs only once per draw
    getGapCandidates(this.plugin, this.focalPath, ccMap).then((gaps) => {
      if (seq !== this.drawSeq || !this.component) return
      this.component.$set({ gaps })
    })
  }
}
