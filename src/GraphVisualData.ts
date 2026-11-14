import { TFile } from 'obsidian'
import type GraphAnalysisPlugin from 'src/main'
import type {
  CoCitationMap,
  EdgeData,
  GapCandidate,
  NeighbourhoodResult,
  NodeData,
  ResultMap,
  VisualEdgeType,
} from 'src/Interfaces'

interface NeighbourhoodBuildResult {
  neighbourhood: NeighbourhoodResult
  ccMap: CoCitationMap
}

function isExcludedByFolder(path: string, exclusionFolders: string[]): boolean {
  return exclusionFolders.some((f) =>
    path.startsWith(f.replace(/\/$/, '') + '/')
  )
}

function isExcludedByProp(
  path: string,
  plugin: GraphAnalysisPlugin
): boolean {
  const { exclusionProps } = plugin.settings
  if (exclusionProps.length === 0) return false
  const cache = plugin.app.metadataCache.getCache(path)
  if (!cache?.frontmatter) return false
  return exclusionProps.some(({ key, value }) => {
    const fmVal = cache.frontmatter[key]
    if (fmVal == null) return false
    const vals = Array.isArray(fmVal) ? fmVal.map(String) : [String(fmVal)]
    return vals.includes(value)
  })
}

// gapNodeFloor applies as a measure floor for Jaccard (0–1 range) and
// co-citation (unbounded — values >> 1 mean very strong co-citation) and as
// an AA score floor for gap candidates. The count cap (gapNodeCount) is the
// primary bound for CC/AA since those measures are not normalised.
export async function getGapCandidates(
  plugin: GraphAnalysisPlugin,
  focalPath: string,
  ccMap: CoCitationMap
): Promise<GapCandidate[]> {
  if (!plugin.g || !plugin.g.hasNode(focalPath)) return []

  const { app } = plugin
  const { exclusionFolders, gapNodeFloor, gapNodeCount } = plugin.settings

  const directNeighbours = new Set<string>([
    focalPath,
    ...plugin.g.neighbors(focalPath),
  ])

  const isExcluded = (path: string) =>
    directNeighbours.has(path) ||
    isExcludedByFolder(path, exclusionFolders) ||
    isExcludedByProp(path, plugin)

  if (plugin.settings.debugMode) console.time('[GA Visual] getGapCandidates')

  const aaResults = await (plugin.g.algs['Adamic Adar'](focalPath) as Promise<ResultMap>)

  if (plugin.settings.debugMode) console.timeEnd('[GA Visual] getGapCandidates')

  const candidates: GapCandidate[] = []
  for (const [path, { measure }] of Object.entries(aaResults)) {
    if (!isFinite(measure) || measure < gapNodeFloor) continue
    if (isExcluded(path)) continue

    const abstractFile = app.vault.getAbstractFileByPath(path)
    candidates.push({
      path,
      aaScore: measure,
      coCitations: ccMap[path]?.coCitations ?? [],
      fileSize: abstractFile instanceof TFile ? abstractFile.stat.size : 0,
      inDegree: plugin.g.hasNode(path) ? plugin.g.inDegree(path) : 0,
      outDegree: plugin.g.hasNode(path) ? plugin.g.outDegree(path) : 0,
    })
  }

  candidates.sort((a, b) => b.aaScore - a.aaScore)
  return candidates.slice(0, gapNodeCount)
}

export function getHop2Nodes(
  plugin: GraphAnalysisPlugin,
  focalPath: string,
  hop1Seen: Set<string>,        // all hop-1 nodes — used for exclusion only
  hop1DirectSources: Set<string>, // direct wikilink neighbours only — iterated for expansion
  minDegree: number,
  nodeCap: number
): NeighbourhoodResult {
  if (!plugin.g || !plugin.g.hasNode(focalPath)) return { nodes: [], edges: [] }

  const { app } = plugin
  const { exclusionFolders } = plugin.settings

  const isExcluded = (path: string) =>
    isExcludedByFolder(path, exclusionFolders) ||
    isExcludedByProp(path, plugin)

  // candidateMap: path → { inDegree, outDegree, firstHop1Source }
  // Degree stored here and reused for NodeData to avoid double graph lookups.
  // A hop-2 node reachable from multiple hop-1 nodes is added once (first source wins).
  const candidateMap = new Map<string, { inDegree: number; outDegree: number; source: string }>()

  for (const hop1Path of hop1DirectSources) {
    for (const neighbour of plugin.g.neighbors(hop1Path)) {
      if (hop1Seen.has(neighbour)) continue
      if (isExcluded(neighbour)) continue
      if (candidateMap.has(neighbour)) continue
      const inDegree = plugin.g.hasNode(neighbour) ? plugin.g.inDegree(neighbour) : 0
      const outDegree = plugin.g.hasNode(neighbour) ? plugin.g.outDegree(neighbour) : 0
      candidateMap.set(neighbour, { inDegree, outDegree, source: hop1Path })
    }
  }

  const sorted = [...candidateMap.entries()]
    .filter(([, { inDegree, outDegree }]) => inDegree + outDegree >= minDegree)
    .sort(([, a], [, b]) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree))
    .slice(0, nodeCap)

  const nodes: NodeData[] = []
  const edges: EdgeData[] = []

  for (const [path, { inDegree, outDegree, source }] of sorted) {
    const abstractFile = app.vault.getAbstractFileByPath(path)
    nodes.push({
      path,
      edgeType: 'direct',
      inDegree,
      outDegree,
      fileSize: abstractFile instanceof TFile ? abstractFile.stat.size : 0,
      hop: 2,
    })
    edges.push({ source, target: path, type: 'direct', hop: 2 })
  }

  return { nodes, edges }
}

export async function getNeighbourhood(
  plugin: GraphAnalysisPlugin,
  focalPath: string
): Promise<NeighbourhoodBuildResult> {
  const empty: NeighbourhoodBuildResult = {
    neighbourhood: { nodes: [], edges: [] },
    ccMap: {},
  }
  if (!plugin.g || !plugin.g.hasNode(focalPath)) return empty

  const { app } = plugin
  const { exclusionFolders, gapNodeFloor, gapNodeCount } = plugin.settings
  const { resolvedLinks } = app.metadataCache

  const isExcluded = (path: string) =>
    isExcludedByFolder(path, exclusionFolders) ||
    isExcludedByProp(path, plugin)

  const getNodeData = (path: string, edgeType: VisualEdgeType): NodeData => {
    const abstractFile = app.vault.getAbstractFileByPath(path)
    return {
      path,
      edgeType,
      inDegree: plugin.g.hasNode(path) ? plugin.g.inDegree(path) : 0,
      outDegree: plugin.g.hasNode(path) ? plugin.g.outDegree(path) : 0,
      fileSize: abstractFile instanceof TFile ? abstractFile.stat.size : 0,
    }
  }

  const nodes: NodeData[] = [getNodeData(focalPath, 'direct')]
  const edges: EdgeData[] = []
  const seen = new Set<string>([focalPath])

  // Phase 1: direct wikilink neighbours (synchronous)
  for (const neighbour of plugin.g.neighbors(focalPath)) {
    if (isExcluded(neighbour)) continue
    if (!seen.has(neighbour)) {
      seen.add(neighbour)
      nodes.push(getNodeData(neighbour, 'direct'))
    }
    if (resolvedLinks[focalPath]?.[neighbour]) {
      edges.push({ source: focalPath, target: neighbour, type: 'direct' })
    } else if (resolvedLinks[neighbour]?.[focalPath]) {
      edges.push({ source: neighbour, target: focalPath, type: 'direct' })
    } else {
      edges.push({ source: focalPath, target: neighbour, type: 'direct' })
    }
  }

  // Phase 2: Jaccard similarity unlinked (fast graph algorithm)
  try {
    const jaccardResults = await (plugin.g.algs['Jaccard'](focalPath) as Promise<ResultMap>)
    const jaccardUnlinked = Object.entries(jaccardResults)
      .filter(([path, { measure }]) =>
        isFinite(measure) && measure >= gapNodeFloor && !seen.has(path) && !isExcluded(path)
      )
      .sort(([, a], [, b]) => b.measure - a.measure)
      .slice(0, gapNodeCount)

    for (const [path, { measure }] of jaccardUnlinked) {
      if (!seen.has(path)) {
        seen.add(path)
        nodes.push(getNodeData(path, 'jaccard'))
      }
      edges.push({ source: focalPath, target: path, type: 'jaccard', measure })
    }
  } catch {
    // Jaccard unavailable
  }

  // Phase 3: Co-citation unlinked (reads vault files — slower).
  // Returns ccMap so getGapCandidates() can reuse it without a second CC call.
  let ccMap: CoCitationMap = {}
  try {
    ccMap = await (plugin.g.algs['Co-Citations'](focalPath) as Promise<CoCitationMap>)
    const ccUnlinked = Object.entries(ccMap)
      .filter(([path, { measure }]) =>
        isFinite(measure) && measure >= gapNodeFloor && !seen.has(path) && !isExcluded(path)
      )
      .sort(([, a], [, b]) => b.measure - a.measure)
      .slice(0, gapNodeCount)

    for (const [path, { measure }] of ccUnlinked) {
      if (!seen.has(path)) {
        seen.add(path)
        nodes.push(getNodeData(path, 'cocitation'))
      }
      edges.push({ source: focalPath, target: path, type: 'cocitation', measure })
    }
  } catch {
    // Co-citations unavailable
  }

  return { neighbourhood: { nodes, edges }, ccMap }
}
