import { App, FuzzySuggestModal, ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian'
import { VIEW_TYPE_GRAPH_ANALYSIS_VISUAL } from 'src/Constants'
import GraphVisual from 'src/Components/GraphVisual.svelte'
import GraphSynthesis from 'src/Components/GraphSynthesis.svelte'
import { getGapCandidates, getHop2Nodes, getNeighbourhood, getSynthesisData } from 'src/GraphVisualData'
import type GraphAnalysisPlugin from 'src/main'

class NotePicker extends FuzzySuggestModal<TFile> {
  private onChoose: (file: TFile) => void

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app)
    this.onChoose = onChoose
    this.setPlaceholder('Pick a note to compare with…')
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles()
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file)
  }
}

export default class GraphVisualView extends ItemView {
  plugin: GraphAnalysisPlugin
  focalPath: string | null = null
  private component: any = null
  private drawSeq = 0
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private synthesisPaths: [string, string] | null = null
  private compareActionEl: HTMLElement | null = null
  private backActionEl: HTMLElement | null = null

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

    this.compareActionEl = this.addAction('split', 'Compare with note', () => {
      if (!this.focalPath) {
        new Notice('Open a note first to use synthesis view.')
        return
      }
      new NotePicker(this.app, (file) => {
        this.drawSynthesis(this.focalPath!, file.path)
      }).open()
    })

    this.backActionEl = this.addAction('arrow-left', 'Back to single note', () => {
      this.clearSynthesis()
    })
    this.backActionEl.style.display = 'none'

    this.focalPath = this.app.workspace.getActiveFile()?.path ?? null

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        // Navigating to a new note exits synthesis mode and shows the new note
        if (file && file.path !== this.focalPath) {
          this.focalPath = file.path
          if (this.synthesisPaths) this.clearSynthesis()
          else this.scheduleDraw()
        }
      })
    )

    this.registerEvent(
      this.app.workspace.on('files-menu', (menu, files) => {
        const mdFiles = files.filter(
          (f): f is TFile => f instanceof TFile && f.extension === 'md'
        )
        if (mdFiles.length !== 2) return
        menu.addItem((item) =>
          item
            .setTitle('Synthesis view')
            .setIcon('git-compare')
            .onClick(() => this.drawSynthesis(mdFiles[0].path, mdFiles[1].path))
        )
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

    // hop-2 is pure graph traversal — fast enough to load eagerly so the toggle
    // in the controls panel can flip visibility without a component remount.
    // hop1Seen excludes all hop-1 nodes from hop-2 results (prevents duplicates).
    // hop1DirectSources is the expansion set — Jaccard/CC nodes are excluded per spec D1
    // (chaining inference on inference degrades signal quality).
    const hop1Seen = new Set<string>([
      this.focalPath,
      ...neighbourhood.nodes.map((n) => n.path),
    ])
    const hop1DirectSources = new Set<string>(
      neighbourhood.nodes
        .filter(n => n.edgeType === 'direct' && n.path !== this.focalPath)
        .map(n => n.path)
    )
    const hop2Neighbourhood = getHop2Nodes(this.plugin, this.focalPath, hop1Seen, hop1DirectSources, 1, 50)

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

    const onCompare = () => {
      if (!this.focalPath) {
        new Notice('Open a note first to use synthesis view.')
        return
      }
      new NotePicker(this.app, (file) => {
        this.drawSynthesis(this.focalPath!, file.path)
      }).open()
    }

    this.component = new GraphVisual({
      target: contentEl,
      props: {
        neighbourhood,
        hop2Neighbourhood,
        focalPath: this.focalPath,
        gaps: [],
        hubThresholdDefault: this.plugin.settings.hubDegreeThreshold,
        onNodeClick,
        onCompare,
      },
    })

    // ccMap from getNeighbourhood is reused here — Co-Citations runs only once per draw
    getGapCandidates(this.plugin, this.focalPath, ccMap).then((gaps) => {
      if (seq !== this.drawSeq || !this.component) return
      this.component.$set({ gaps })
    })
  }

  async drawSynthesis(pathA: string, pathB: string): Promise<void> {
    this.synthesisPaths = [pathA, pathB]
    this.compareActionEl && (this.compareActionEl.style.display = 'none')
    this.backActionEl && (this.backActionEl.style.display = '')

    const seq = ++this.drawSeq
    this.component?.$destroy()
    this.component = null

    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('GA-Visual-View')

    if (!this.plugin.g) {
      contentEl.createEl('p', { text: 'Waiting for index…' })
      return
    }

    const nameA = pathA.split('/').pop()?.replace(/\.[^.]+$/, '') ?? pathA
    const nameB = pathB.split('/').pop()?.replace(/\.[^.]+$/, '') ?? pathB
    contentEl.createEl('p', { text: `Building synthesis: ${nameA} ↔ ${nameB}…` })

    const result = await getSynthesisData(this.plugin, pathA, pathB)
    if (seq !== this.drawSeq) return

    contentEl.empty()

    const onNodeClick = (path: string, _context: string) => {
      const file = this.plugin.app.vault.getAbstractFileByPath(path)
      if (!(file instanceof TFile)) {
        new Notice(`Note not found: ${path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path}`)
        return
      }
      this.plugin.app.workspace.getLeaf(false).openFile(file)
    }

    const onBack = () => this.clearSynthesis()

    this.component = new GraphSynthesis({
      target: contentEl,
      props: { result, onNodeClick, onBack },
    })
  }

  clearSynthesis(): void {
    this.synthesisPaths = null
    this.compareActionEl && (this.compareActionEl.style.display = '')
    this.backActionEl && (this.backActionEl.style.display = 'none')
    this.draw()
  }
}
