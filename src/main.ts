import { addIcon, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
import { openView, wait } from 'obsidian-community-lib'
import AnalysisView from 'src/AnalysisView'
import {
  PLUGIN_NAME,
  ANALYSIS_TYPES,
  DEFAULT_SETTINGS,
  iconSVG,
  VIEW_TYPE_GRAPH_ANALYSIS,
  VIEW_TYPE_GRAPH_ANALYSIS_VISUAL,
} from 'src/Constants'
import GraphVisualView from 'src/GraphVisualView'
import type { GraphAnalysisSettings } from 'src/Interfaces'
import MyGraph from 'src/MyGraph'
import { SampleSettingTab } from 'src/Settings'
import { debug } from './Utility'

export default class GraphAnalysisPlugin extends Plugin {
  settings: GraphAnalysisSettings
  g: MyGraph

  async onload() {
    console.log(`loading ${PLUGIN_NAME} plugin`)

    await this.loadSettings()
    addIcon('GA-ICON', iconSVG)

    this.addCommand({
      id: 'show-graph-analysis-view',
      name: 'Open Graph Analysis View',
      checkCallback: (checking: boolean) => {
        let checkResult =
          this.app.workspace.getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS)
            .length === 0

        if (checkResult) {
          // Only perform work when checking is false
          if (!checking) {
            openView(this.app as any, VIEW_TYPE_GRAPH_ANALYSIS, AnalysisView)
          }
          return true
        }
      },
    })

    this.addCommand({
      id: 'refresh-analysis-view',
      name: 'Refresh Graph Analysis View',
      callback: async () => {
        await this.refreshGraph()
        const currView = await this.getCurrentView() as AnalysisView
        await currView.draw(currView.currSubtype)
      },
    })

    ANALYSIS_TYPES.forEach((sub) => {
      this.addCommand({
        id: `open-${sub.subtype}`,
        name: `Open ${sub.subtype}`,
        callback: async () => {
          const currView = await this.getCurrentView() as AnalysisView
          await currView.draw(sub.subtype)
        },
      })
    })

    this.addCommand({
      id: 'show-graph-analysis-visual-view',
      name: 'Open Visual Graph View',
      checkCallback: (checking: boolean) => {
        const notOpen =
          this.app.workspace.getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS_VISUAL)
            .length === 0
        if (notOpen) {
          if (!checking) {
            openView(this.app as any, VIEW_TYPE_GRAPH_ANALYSIS_VISUAL, GraphVisualView)
          }
          return true
        }
      },
    })

    this.addSettingTab(new SampleSettingTab(this.app, this))

    this.registerView(
      VIEW_TYPE_GRAPH_ANALYSIS,
      (leaf: WorkspaceLeaf) => new AnalysisView(leaf, this, null)
    )

    this.registerView(
      VIEW_TYPE_GRAPH_ANALYSIS_VISUAL,
      (leaf: WorkspaceLeaf) => new GraphVisualView(leaf, this)
    )

    this.app.workspace.onLayoutReady(async () => {
      const noFiles = this.app.vault.getMarkdownFiles().length
      while (!this.resolvedLinksComplete(noFiles)) {
        await wait(1000)
      }

      await this.refreshGraph()
      await openView(this.app as any, VIEW_TYPE_GRAPH_ANALYSIS, AnalysisView)
    })
  }

  resolvedLinksComplete(noFiles: number) {
    const { resolvedLinks } = this.app.metadataCache
    return Object.keys(resolvedLinks).length === noFiles
  }

  getCurrentView = async (openIfNot = true) => {
    const view = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_GRAPH_ANALYSIS
    )?.[0]?.view as AnalysisView

    if (view) return view
    else if (openIfNot) {
      return await openView(this.app as any, VIEW_TYPE_GRAPH_ANALYSIS, AnalysisView)
    } else return null
  }

  async refreshGraph() {
    try {
      console.time('Initialise Graph')
      this.g = new MyGraph(this.app, this.settings)
      await this.g.initGraph()
      // await this.g.initData()
      debug(this.settings, { g: this.g })
      console.timeEnd('Initialise Graph')
      new Notice('Index Refreshed')
      // Direct draw() rather than scheduleDraw() — the graph index (plugin.g) was
      // just rebuilt, so a full synchronous redraw is correct here. scheduleDraw()
      // is for file-open and settings changes where the index has not changed.
      this.app.workspace
        .getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS_VISUAL)
        .forEach((leaf) => (leaf.view as GraphVisualView).draw())
    } catch (error) {
      console.log(error)
      new Notice(
        'An error occured with Graph Analysis, please check the console.'
      )
    }
  }

  onunload() {
    console.log(`unloading ${PLUGIN_NAME} plugin`)
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS)
      .forEach((leaf) => {
        leaf.view.unload()
        leaf.detach()
      })
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
    // Redraw open visual views so exclusion/threshold changes take effect immediately
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_GRAPH_ANALYSIS_VISUAL)
      .forEach((leaf) => (leaf.view as GraphVisualView).scheduleDraw())
  }
}
