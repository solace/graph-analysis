import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import { ANALYSIS_TYPES } from 'src/Constants'
import type { ExclusionProp, Subtype } from 'src/Interfaces'
import type GraphAnalysisPlugin from 'src/main'
import Checkboxes from './Components/Checkboxes.svelte'

export class SampleSettingTab extends PluginSettingTab {
  plugin: GraphAnalysisPlugin

  constructor(app: App, plugin: GraphAnalysisPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const plugin = this.plugin
    let { containerEl } = this
    const { settings } = plugin

    containerEl.empty()

    containerEl.createEl('h3', { text: 'Analysis Defaults' })

    new Setting(containerEl)
      .setName('Default Analysis Type')
      .setDesc('Which analysis type to show on startup')
      .addDropdown((dd) => {
        dd.setValue(settings.defaultSubtypeType)
        const dict: Record<string, string> = {}
        settings.algsToShow.forEach((subtype) => {
          dict[subtype] = subtype
        })
        dd.addOptions(dict).onChange(async (option) => {
          settings.defaultSubtypeType = option as Subtype
          await plugin.saveSettings()
        })
      })

    containerEl.createEl('h3', { text: 'Algorithms to Show' })
    new Checkboxes({
      target: containerEl,
      props: {
        options: ANALYSIS_TYPES.map((type) => type.subtype),
        plugin,
        settingName: 'algsToShow',
      },
    })

    new Setting(containerEl)
      .setName('Exclude Infinity')
      .setDesc('Whether to exclude Infinite values by default')
      .addToggle((toggle) =>
        toggle.setValue(settings.noInfinity).onChange(async (value) => {
          settings.noInfinity = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Exclude Zero')
      .setDesc('Whether to exclude Zero by default')
      .addToggle((toggle) =>
        toggle.setValue(settings.noZero).onChange(async (value) => {
          settings.noZero = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Include All File Extensions')
      .setDesc(
        'Whether to also show files with non-md extensions in the analyses.'
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.allFileExtensions).onChange(async (value) => {
          settings.allFileExtensions = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Show Thumbnails for Images')
      .setDesc(
        'Whether to show small thumbnails for images (if all file extensions are included).'
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showImgThumbnails).onChange(async (value) => {
          settings.showImgThumbnails = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Include tags (Co-Citations)')
      .setDesc(
        'Whether to also show the tags that are co-cited in the co-citations algorithm.'
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.coTags).onChange(async (value) => {
          settings.coTags = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Include Unresolved Links')
      .setDesc('Whether to also show links that have not yet been created.')
      .addToggle((toggle) =>
        toggle.setValue(settings.addUnresolved).onChange(async (value) => {
          settings.addUnresolved = value
          await plugin.saveSettings()
        })
      )

    containerEl.createEl('h3', { text: 'Visual Graph' })

    new Setting(containerEl)
      .setName('Gap Node Score Floor')
      .setDesc(
        'Minimum score for unlinked neighbours and gap candidates. Applies to Jaccard similarity (0–1), co-citation measures, and Adamic-Adar gap ranking. Higher values show fewer, stronger results.'
      )
      .addSlider((sl) =>
        sl
          .setLimits(0, 1, 0.01)
          .setValue(settings.gapNodeFloor)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.gapNodeFloor = value
            await plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Gap Node Count')
      .setDesc('Maximum number of gap candidates to show in the visual graph.')
      .addSlider((sl) =>
        sl
          .setLimits(1, 50, 1)
          .setValue(settings.gapNodeCount)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.gapNodeCount = value
            await plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Hub Degree Threshold')
      .setDesc(
        'Notes with total degree (in + out links) at or above this value are rendered as hub nodes in the visual graph.'
      )
      .addSlider((sl) =>
        sl
          .setLimits(1, 200, 1)
          .setValue(settings.hubDegreeThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.hubDegreeThreshold = value
            await plugin.saveSettings()
          })
      )

    containerEl.createEl('h3', { text: 'Exclusion Settings' })

    new Setting(containerEl)
      .setName('Exclusion Tags')
      .setDesc(
        "Comma-separated list of tags. Notes with any of these tags are excluded from all analyses. Include the # in each tag."
      )
      .addText((tc) => {
        tc.setValue(settings.exclusionTags.join(', '))
        tc.inputEl.style.width = '100%'
        tc.inputEl.onblur = async () => {
          const { value } = tc.inputEl
          const splits = value.split(',').map((s) => s.trim()).filter(Boolean)
          if (splits.length > 0 && !splits.every((t) => t.startsWith('#'))) {
            new Notice("Every tag must start with '#'")
            return
          }
          settings.exclusionTags = splits
          await plugin.saveSettings()
        }
      })

    new Setting(containerEl)
      .setName('Exclusion Properties')
      .setDesc(
        'Comma-separated key:value pairs. Notes with matching frontmatter are excluded. E.g. type:moc, type:classification'
      )
      .addText((tc) => {
        tc.setValue(
          settings.exclusionProps.map((p) => `${p.key}:${p.value}`).join(', ')
        )
        tc.inputEl.style.width = '100%'
        tc.inputEl.onblur = async () => {
          const { value } = tc.inputEl
          settings.exclusionProps =
            value === ''
              ? []
              : (value
                  .split(',')
                  .map((s) => {
                    const trimmed = s.trim()
                    const colonIdx = trimmed.indexOf(':')
                    if (colonIdx === -1) return null
                    return {
                      key: trimmed.slice(0, colonIdx).trim(),
                      value: trimmed.slice(colonIdx + 1).trim(),
                    }
                  })
                  .filter(Boolean) as ExclusionProp[])
          await plugin.saveSettings()
        }
      })

    new Setting(containerEl)
      .setName('Exclusion Folders')
      .setDesc(
        'Comma-separated folder paths. Notes under these folders are excluded from all analyses. E.g. dailies, templates/system'
      )
      .addText((tc) => {
        tc.setValue(settings.exclusionFolders.join(', '))
        tc.inputEl.style.width = '100%'
        tc.inputEl.onblur = async () => {
          const { value } = tc.inputEl
          settings.exclusionFolders =
            value === ''
              ? []
              : value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
          await plugin.saveSettings()
        }
      })

    new Setting(containerEl)
      .setName('Exclusion Regex')
      .setDesc(
        createFragment((el) => {
          el.createEl('p', {
            text: "Regular expression tested against each note's full file path. Matching notes are excluded from all analyses. Leave empty to include all notes.",
          })
          el.createEl('p', {
            text: 'The path includes folders and the .md extension, e.g. "dailies/2024-01-01.md". Use ^ to anchor to the start of the path.',
          })
        })
      )
      .addTextArea((ta) => {
        ta.setValue(settings.exclusionRegex)
        ta.inputEl.rows = 4
        ta.inputEl.style.width = '100%'
        ta.inputEl.onblur = async () => {
          const value = ta.getValue().trim()
          try {
            new RegExp(value)
            settings.exclusionRegex = value
            await plugin.saveSettings()
            await this.plugin.refreshGraph()
          } catch (e) {
            new Notice(
              `"${value}" is not a valid regular expression. Check for unclosed brackets or unescaped characters.`
            )
          }
        }
      })

    containerEl.createEl('h3', { text: 'Debugging Options' })

    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc(
        'Toggling this on will enable a few console logs to appear when using the graph analysis view.'
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.debugMode).onChange(async (value) => {
          settings.debugMode = value
          await plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Super Debug Mode')
      .setDesc('Toggling this on will enable ALOT of console logs')
      .addToggle((toggle) =>
        toggle.setValue(settings.superDebugMode).onChange(async (value) => {
          settings.superDebugMode = value
          await plugin.saveSettings()
        })
      )
  }
}
