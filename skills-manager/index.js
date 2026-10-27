/**
 * Host half of `@local/skills-manager`.
 *
 * Provides:
 * 1. Full inventory of installed DSH skills across Global (`~/.dsh/skills`, `~/.agents/skills`)
 *    and per-Workspace (`<workspace>/.dsh/skills`, `<workspace>/.agents/skills`).
 * 2. Local skill discovery & 1-click full-bundle import from Antigravity (`~/.gemini/...`)
 *    and Claude Code (`~/.claude/skills`).
 * 3. Multi-workspace & Global scope assignment, frontmatter invocation toggles
 *    (`disable-model-invocation`, `user-invocable`), inline `SKILL.md` editor, and skill creator.
 * 4. Online Skills Registry & Marketplace integrating `skills.sh` (Popular All-Time,
 *    Trending 24h, Hot, and Algolia Search API) + GitHub Search API (Newly Created / Updated)
 *    with 1-click shallow-clone bundle installation.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export const name = 'skills-manager'
export const ROUTE_PATH = '/api/skills-manager'

const exploreCache = new Map()
const EXPLORE_CACHE_TTL_MS = 3 * 60 * 1000

/**
 * Convert any skill identifier into valid DSH kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
 * @param {string} raw - raw skill name or folder name.
 * @returns {string} normalized kebab-case skill name.
 */
export function toKebabSkillName(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\.md$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'custom-skill'
}

/**
 * Parse YAML frontmatter and markdown body from a `SKILL.md` file.
 * @param {string} content - raw file content.
 * @param {string} fallbackName - fallback name if missing in frontmatter.
 * @returns {{
 *   name: string,
 *   originalName: string,
 *   description: string,
 *   whenToUse: string,
 *   disableModelInvocation: boolean,
 *   userInvocable: boolean,
 *   body: string,
 *   hasFrontmatter: boolean
 * }}
 */
export function parseSkillMarkdown(content, fallbackName = 'skill') {
  const text = String(content || '').replace(/^\uFEFF/, '')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    const firstParagraph = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^#+\s*/, '').trim())
      .find((l) => l.length > 0) || 'Skill instructions'
    return {
      name: toKebabSkillName(fallbackName),
      originalName: fallbackName,
      description: firstParagraph.slice(0, 280),
      whenToUse: '',
      disableModelInvocation: false,
      userInvocable: true,
      body: text.trim(),
      hasFrontmatter: false,
    }
  }

  const yamlBlock = match[1]
  const body = match[2].trim()
  const fields = {}
  const lines = yamlBlock.split(/\r?\n/)
  let currentKey = null
  let currentVal = []

  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (keyMatch) {
      if (currentKey) {
        fields[currentKey] = currentVal.join(' ').trim()
      }
      currentKey = keyMatch[1]
      const val = keyMatch[2].trim()
      if (val === '|' || val === '>' || val === '|-' || val === '>-') {
        currentVal = []
      } else {
        currentVal = [val.replace(/^['"]|['"]$/g, '')]
      }
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentVal.push(line.trim())
    }
  }
  if (currentKey) {
    fields[currentKey] = currentVal.join(' ').trim()
  }

  const parseBool = (val, defaultVal) => {
    if (val === undefined || val === '') return defaultVal
    const v = String(val).toLowerCase().trim()
    if (['true', 'yes', 'on', '1'].includes(v)) return true
    if (['false', 'no', 'off', '0'].includes(v)) return false
    return defaultVal
  }

  const rawName = fields.name || fallbackName
  const description = fields.description || 'Custom agent skill'

  return {
    name: toKebabSkillName(rawName),
    originalName: rawName,
    description,
    whenToUse: fields.whenToUse || fields['when-to-use'] || '',
    disableModelInvocation: parseBool(fields['disable-model-invocation'], false),
    userInvocable: parseBool(fields['user-invocable'], true),
    body,
    hasFrontmatter: true,
  }
}

/**
 * Serialize a skill's metadata and body into a DSH-compliant `SKILL.md` string.
 * Ensures `name` is strict kebab-case and `description` is single-line YAML safe.
 * @param {{
 *   name: string,
 *   description: string,
 *   whenToUse?: string,
 *   disableModelInvocation?: boolean,
 *   userInvocable?: boolean,
 *   body: string
 * }} skill
 * @returns {string}
 */
export function serializeSkillMarkdown(skill) {
  const kebabName = toKebabSkillName(skill.name)
  const cleanDesc = String(skill.description || 'Agent skill')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const yamlLines = [
    '---',
    `name: ${kebabName}`,
    `description: ${JSON.stringify(cleanDesc)}`,
  ]
  if (skill.whenToUse && String(skill.whenToUse).trim().length > 0) {
    const cleanWhen = String(skill.whenToUse).replace(/\r?\n+/g, ' ').trim()
    yamlLines.push(`whenToUse: ${JSON.stringify(cleanWhen)}`)
  }
  if (skill.disableModelInvocation === true) {
    yamlLines.push('disable-model-invocation: true')
  }
  if (skill.userInvocable === false) {
    yamlLines.push('user-invocable: false')
  }
  yamlLines.push('---', '', String(skill.body || '').trim(), '')
  return yamlLines.join('\n')
}

/**
 * Normalize an existing `SKILL.md` file in-place so `@deepseek-ai/dsh-skill-filesystem`
 * never drops it due to non-kebab `name` or missing `description`.
 * @param {string} skillMdPath - path to `SKILL.md`.
 * @param {string} fallbackName - folder name fallback.
 * @param {Partial<{ disableModelInvocation: boolean, userInvocable: boolean }>} [overrides]
 */
async function normalizeSkillMdFile(skillMdPath, fallbackName, overrides = {}) {
  if (!existsSync(skillMdPath)) return
  const raw = await readFile(skillMdPath, 'utf8')
  const parsed = parseSkillMarkdown(raw, fallbackName)
  const normalized = serializeSkillMarkdown({
    name: toKebabSkillName(fallbackName || parsed.name),
    description: parsed.description,
    whenToUse: parsed.whenToUse,
    disableModelInvocation:
      typeof overrides.disableModelInvocation === 'boolean'
        ? overrides.disableModelInvocation
        : parsed.disableModelInvocation,
    userInvocable:
      typeof overrides.userInvocable === 'boolean'
        ? overrides.userInvocable
        : parsed.userInvocable,
    body: parsed.body,
  })
  await writeFile(skillMdPath, normalized, 'utf8')
}

/**
 * Read all registered DeepSeek Harness workspaces from `~/.dsh/storages/workspace.json`.
 * @returns {Promise<Array<{ id: string, title: string, path: string, exists: boolean }>>}
 */
export async function discoverWorkspaces() {
  const wsFile = join(homedir(), '.dsh', 'storages', 'workspace.json')
  const list = []
  if (existsSync(wsFile)) {
    try {
      const raw = JSON.parse(await readFile(wsFile, 'utf8'))
      const table = raw?.tables?.workspaces
      if (table && typeof table === 'object') {
        for (const [id, entry] of Object.entries(table)) {
          if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string') continue
          list.push({
            id,
            title: typeof entry.title === 'string' && entry.title ? entry.title : basename(entry.path),
            path: entry.path,
            updatedAt: entry.updatedAt || '',
            exists: existsSync(entry.path),
          })
        }
      }
    } catch {
      /* ignore */
    }
  }
  list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return list
}

/**
 * Scan a single skill root directory (`<root>/<name>/SKILL.md` or `<root>/<name>.md`).
 * @param {string} rootDir - directory to scan.
 * @returns {Promise<Array<{
 *   name: string,
 *   originalName: string,
 *   description: string,
 *   whenToUse: string,
 *   disableModelInvocation: boolean,
 *   userInvocable: boolean,
 *   bundlePath: string,
 *   skillMdPath: string,
 *   isDirectory: boolean,
 *   hasResources: boolean
 * }>>}
 */
async function scanSkillRoot(rootDir) {
  if (!existsSync(rootDir)) return []
  let entries = []
  try {
    entries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const results = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(rootDir, entry.name)
    try {
      const st = await stat(fullPath)
      if (st.isDirectory()) {
        const mdPath = join(fullPath, 'SKILL.md')
        if (!existsSync(mdPath)) continue
        const raw = await readFile(mdPath, 'utf8')
        const parsed = parseSkillMarkdown(raw, entry.name)
        const subEntries = await readdir(fullPath)
        const hasResources = subEntries.some((s) =>
          ['scripts', 'references', 'assets', 'examples', 'resources'].includes(s.toLowerCase()),
        )
        results.push({
          ...parsed,
          name: toKebabSkillName(entry.name),
          bundlePath: fullPath,
          skillMdPath: mdPath,
          isDirectory: true,
          hasResources,
        })
      } else if (st.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const baseName = entry.name.replace(/\.md$/i, '')
        const raw = await readFile(fullPath, 'utf8')
        const parsed = parseSkillMarkdown(raw, baseName)
        results.push({
          ...parsed,
          name: toKebabSkillName(baseName),
          bundlePath: fullPath,
          skillMdPath: fullPath,
          isDirectory: false,
          hasResources: false,
        })
      }
    } catch {
      /* ignore unreadable entry */
    }
  }
  return results
}

/**
 * Scan all installed DSH skills across Global and all registered Workspaces.
 * @param {Array<{ id: string, title: string, path: string }>} workspaces
 */
export async function scanInstalledSkills(workspaces) {
  const home = homedir()
  const globalRoots = [
    { path: join(home, '.dsh', 'skills'), kind: 'user-dsh' },
    { path: join(home, '.agents', 'skills'), kind: 'user-agents' },
  ]

  const byName = new Map()

  const recordSkill = (item, scopeType, workspaceId = null, rootKind = '') => {
    let existing = byName.get(item.name)
    if (!existing) {
      existing = {
        name: item.name,
        description: item.description,
        whenToUse: item.whenToUse,
        disableModelInvocation: item.disableModelInvocation,
        userInvocable: item.userInvocable,
        modelInvocable: !item.disableModelInvocation,
        isGlobal: false,
        workspaceIds: [],
        hasResources: item.hasResources,
        primaryBundlePath: item.bundlePath,
        primarySkillMdPath: item.skillMdPath,
        locations: [],
      }
      byName.set(item.name, existing)
    }
    if (item.hasResources) existing.hasResources = true
    if (scopeType === 'global') {
      existing.isGlobal = true
    } else if (workspaceId && !existing.workspaceIds.includes(workspaceId)) {
      existing.workspaceIds.push(workspaceId)
    }
    existing.locations.push({
      scopeType,
      workspaceId,
      rootKind,
      bundlePath: item.bundlePath,
      skillMdPath: item.skillMdPath,
      isDirectory: item.isDirectory,
    })
  }

  for (const gr of globalRoots) {
    const items = await scanSkillRoot(gr.path)
    for (const item of items) {
      recordSkill(item, 'global', null, gr.kind)
    }
  }

  for (const ws of workspaces) {
    if (!ws.path || !existsSync(ws.path)) continue
    const wsRoots = [
      { path: join(ws.path, '.dsh', 'skills'), kind: 'project-dsh' },
      { path: join(ws.path, '.agents', 'skills'), kind: 'project-agents' },
    ]
    for (const wr of wsRoots) {
      const items = await scanSkillRoot(wr.path)
      for (const item of items) {
        recordSkill(item, 'workspace', ws.id, wr.kind)
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Scan local skills from Antigravity (`~/.gemini/...`) and Claude Code (`~/.claude/skills`)
 * that can be imported into DSH.
 * @param {Array<any>} installedSkills - currently installed DSH skills.
 */
export async function scanImportableSkills(installedSkills) {
  const home = homedir()
  const installedMap = new Map(installedSkills.map((s) => [s.name, s]))

  const candidateRoots = [
    {
      group: 'antigravity-user',
      label: 'Antigravity (User Skills)',
      path: join(home, '.gemini', 'config', 'skills'),
    },
    {
      group: 'antigravity-builtin',
      label: 'Antigravity (Built-in)',
      path: join(home, '.gemini', 'antigravity', 'builtin', 'skills'),
    },
    {
      group: 'claude-code',
      label: 'Claude Code (~/.claude/skills)',
      path: join(home, '.claude', 'skills'),
    },
  ]

  // Also scan Antigravity plugins (`~/.gemini/config/plugins/*/skills`)
  const pluginsDir = join(home, '.gemini', 'config', 'plugins')
  if (existsSync(pluginsDir)) {
    try {
      const pEntries = await readdir(pluginsDir, { withFileTypes: true })
      for (const pe of pEntries) {
        if (!pe.isDirectory()) continue
        const pSkills = join(pluginsDir, pe.name, 'skills')
        if (existsSync(pSkills)) {
          candidateRoots.push({
            group: 'antigravity-plugin',
            label: `Antigravity Plugin (${pe.name})`,
            path: pSkills,
          })
        }
      }
    } catch {
      /* ignore */
    }
  }

  const results = []
  const seenKey = new Set()

  for (const root of candidateRoots) {
    const items = await scanSkillRoot(root.path)
    for (const item of items) {
      const key = `${root.group}:${item.name}`
      if (seenKey.has(key)) continue
      seenKey.add(key)

      const installed = installedMap.get(item.name)
      results.push({
        id: key,
        name: item.name,
        originalName: item.originalName,
        description: item.description,
        whenToUse: item.whenToUse,
        sourceGroup: root.group,
        sourceLabel: root.label,
        bundlePath: item.bundlePath,
        skillMdPath: item.skillMdPath,
        isDirectory: item.isDirectory,
        hasResources: item.hasResources,
        installedGlobal: Boolean(installed?.isGlobal),
        installedWorkspaceIds: installed?.workspaceIds ?? [],
      })
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Copy a skill bundle (directory or flat `.md` file) into a target DSH skills root
 * as `<targetRoot>/<kebabName>/SKILL.md` (plus any `scripts/`, `references/`, etc.).
 * @param {string} sourceBundlePath - source directory or `.md` file.
 * @param {string} targetRootDir - e.g. `~/.dsh/skills` or `<ws>/.dsh/skills`.
 * @param {string} skillName - kebab-case skill name.
 */
async function copySkillBundleToRoot(sourceBundlePath, targetRootDir, skillName) {
  const kebab = toKebabSkillName(skillName)
  const destDir = join(targetRootDir, kebab)
  await mkdir(destDir, { recursive: true })

  const st = await stat(sourceBundlePath)
  if (st.isDirectory()) {
    await cp(sourceBundlePath, destDir, {
      recursive: true,
      force: true,
      filter: (src) => !basename(src).startsWith('.git'),
    })
    const destMd = join(destDir, 'SKILL.md')
    await normalizeSkillMdFile(destMd, kebab)
  } else {
    const destMd = join(destDir, 'SKILL.md')
    const raw = await readFile(sourceBundlePath, 'utf8')
    const parsed = parseSkillMarkdown(raw, kebab)
    await writeFile(destMd, serializeSkillMarkdown({ ...parsed, name: kebab }), 'utf8')
  }
  return destDir
}

/**
 * Remove a skill from a given skills root (checks both `<root>/<name>` directory and `<root>/<name>.md`).
 * @param {string} rootDir
 * @param {string} skillName
 */
async function removeSkillFromRoot(rootDir, skillName) {
  const kebab = toKebabSkillName(skillName)
  const candidates = [
    join(rootDir, kebab),
    join(rootDir, `${kebab}.md`),
  ]
  for (const c of candidates) {
    if (existsSync(c)) {
      await rm(c, { recursive: true, force: true })
    }
  }
}

/**
 * Parse `"initialSkills":[...]` embedded inside `skills.sh` Next.js RSC HTML pages.
 * @param {string} html - raw HTML from `https://skills.sh`, `/trending`, or `/hot`.
 * @returns {Array<{ id: string, source: string, skillId: string, name: string, installs: number }>}
 */
function parseSkillsShRscHtml(html) {
  const marker = '\\"initialSkills\\":['
  const startIdx = html.indexOf(marker)
  if (startIdx !== -1) {
    const arrStart = startIdx + marker.length - 1
    let depth = 0
    let endIdx = -1
    for (let i = arrStart; i < html.length; i++) {
      const ch = html[i]
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }
    if (endIdx !== -1) {
      const rawEscaped = html.slice(arrStart, endIdx).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      try {
        const parsed = JSON.parse(rawEscaped)
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 40).map((item) => ({
            id: `${item.source}/${item.skillId}`,
            source: item.source,
            skillId: item.skillId || item.name,
            name: item.name || item.skillId,
            installs: typeof item.installs === 'number' ? item.installs : 0,
            registry: 'skills.sh',
            url: `https://skills.sh/${item.source}/${item.skillId}`,
          }))
        }
      } catch {
        /* fallback below */
      }
    }
  }

  // Regex fallback if RSC chunk boundaries split the array
  const results = []
  const seen = new Set()
  const regex = /\\"source\\":\\"([^\\"]+)\\",\\"skillId\\":\\"([^\\"]+)\\",\\"name\\":\\"([^\\"]+)\\",\\"installs\\":(\d+)/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const [, source, skillId, name, installsStr] = match
    const id = `${source}/${skillId}`
    if (seen.has(id)) continue
    seen.add(id)
    results.push({
      id,
      source,
      skillId,
      name,
      installs: Number(installsStr) || 0,
      registry: 'skills.sh',
      url: `https://skills.sh/${source}/${skillId}`,
    })
    if (results.length >= 40) break
  }
  return results
}

/**
 * Explore or search online skills from `skills.sh` and GitHub REST API.
 * @param {{ category?: string, q?: string, force?: boolean }} options
 * @param {Array<any>} installedSkills
 */
export async function exploreOnlineSkills(options, installedSkills) {
  const category = options.category || 'popular'
  const query = typeof options.q === 'string' ? options.q.trim() : ''
  const cacheKey = query.length >= 2 ? `search:${query.toLowerCase()}` : `cat:${category}`

  const installedMap = new Map(installedSkills.map((s) => [s.name, s]))
  const decorate = (items) =>
    items.map((item) => {
      const kebab = toKebabSkillName(item.skillId || item.name)
      const inst = installedMap.get(kebab)
      return {
        ...item,
        kebabName: kebab,
        installedGlobal: Boolean(inst?.isGlobal),
        installedWorkspaceIds: inst?.workspaceIds ?? [],
      }
    })

  if (!options.force && exploreCache.has(cacheKey)) {
    const cached = exploreCache.get(cacheKey)
    if (Date.now() - cached.at < EXPLORE_CACHE_TTL_MS) {
      return { ok: true, category, query, items: decorate(cached.items), cached: true }
    }
  }

  let items = []

  if (query.length >= 2) {
    // Parallel search: skills.sh Algolia API + GitHub Search API
    const [skillsShRes, ghRes] = await Promise.allSettled([
      fetch(`https://skills.sh/api/search?q=${encodeURIComponent(query)}`, {
        headers: { accept: 'application/json', 'user-agent': 'dsh-skills-manager/1.0' },
        signal: AbortSignal.timeout(10000),
      }).then((r) => (r.ok ? r.json() : { skills: [] })),
      fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+SKILL.md+in:readme&sort=stars&order=desc&per_page=12`,
        {
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-skills-manager/1.0' },
          signal: AbortSignal.timeout(10000),
        },
      ).then((r) => (r.ok ? r.json() : { items: [] })),
    ])

    const seen = new Set()
    if (skillsShRes.status === 'fulfilled' && Array.isArray(skillsShRes.value?.skills)) {
      for (const s of skillsShRes.value.skills.slice(0, 30)) {
        const id = s.id || `${s.source}/${s.skillId}`
        if (seen.has(id)) continue
        seen.add(id)
        items.push({
          id,
          source: s.source,
          skillId: s.skillId || s.name,
          name: s.name || s.skillId,
          description: `Community skill from ${s.source}`,
          installs: typeof s.installs === 'number' ? s.installs : 0,
          registry: 'skills.sh',
          url: `https://skills.sh/${s.source}/${s.skillId}`,
        })
      }
    }

    if (ghRes.status === 'fulfilled' && Array.isArray(ghRes.value?.items)) {
      for (const repo of ghRes.value.items) {
        const id = `${repo.full_name}/${repo.name}`
        if (seen.has(id)) continue
        seen.add(id)
        items.push({
          id,
          source: repo.full_name,
          skillId: repo.name,
          name: repo.name,
          description: repo.description || `GitHub skill repository by ${repo.owner?.login || ''}`,
          stars: repo.stargazers_count || 0,
          updatedAt: repo.updated_at,
          registry: 'github',
          url: repo.html_url,
        })
      }
    }
  } else if (category === 'newest' || category === 'new') {
    const res = await fetch(
      'https://api.github.com/search/repositories?q=SKILL.md+in:readme+agent+skill&sort=updated&order=desc&per_page=25',
      {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-skills-manager/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (res.ok) {
      const data = await res.json()
      items = (data.items || []).map((repo) => ({
        id: `${repo.full_name}/${repo.name}`,
        source: repo.full_name,
        skillId: repo.name,
        name: repo.name,
        description: repo.description || `Newly updated agent skill repository (${repo.full_name})`,
        stars: repo.stargazers_count || 0,
        updatedAt: repo.updated_at,
        registry: 'github',
        url: repo.html_url,
      }))
    }
  } else {
    const pageUrl =
      category === 'trending'
        ? 'https://skills.sh/trending'
        : category === 'hot'
          ? 'https://skills.sh/hot'
          : 'https://skills.sh'
    const res = await fetch(pageUrl, {
      headers: { accept: 'text/html', 'user-agent': 'dsh-skills-manager/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const html = await res.text()
      items = parseSkillsShRscHtml(html)
    }
  }

  if (items.length > 0) {
    exploreCache.set(cacheKey, { at: Date.now(), items })
  }

  return { ok: true, category, query, items: decorate(items), cached: false }
}

/**
 * Recursively search a cloned repository directory for a skill folder matching `skillId`
 * (or any `SKILL.md` if single-skill repo).
 * @param {string} rootDir - cloned repository root.
 * @param {string} targetSkillId - desired skill identifier.
 * @returns {Promise<string | null>} path to the directory containing `SKILL.md`.
 */
async function findSkillFolderInRepo(rootDir, targetSkillId) {
  const targetKebab = toKebabSkillName(targetSkillId)

  // Fast direct path checks first
  const directCandidates = [
    join(rootDir, 'skills', targetSkillId),
    join(rootDir, 'skills', targetKebab),
    join(rootDir, targetSkillId),
    join(rootDir, targetKebab),
    join(rootDir, '.agents', 'skills', targetSkillId),
    join(rootDir, '.claude', 'skills', targetSkillId),
  ]
  for (const cand of directCandidates) {
    if (existsSync(join(cand, 'SKILL.md'))) return cand
  }

  // BFS up to depth 4 for all directories containing SKILL.md
  const foundDirs = []
  async function walk(dir, depth) {
    if (depth > 4) return
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) {
      foundDirs.push(dir)
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      if (['node_modules', 'dist', 'build', 'vendor'].includes(entry.name)) continue
      await walk(join(dir, entry.name), depth + 1)
    }
  }
  await walk(rootDir, 0)

  if (foundDirs.length === 0) return null

  // Match by directory basename
  for (const dir of foundDirs) {
    if (toKebabSkillName(basename(dir)) === targetKebab) return dir
  }

  // Match by frontmatter `name`
  for (const dir of foundDirs) {
    try {
      const raw = await readFile(join(dir, 'SKILL.md'), 'utf8')
      const parsed = parseSkillMarkdown(raw, basename(dir))
      if (parsed.name === targetKebab) return dir
    } catch {
      /* ignore */
    }
  }

  // If repo has a root SKILL.md or only 1 skill, use it
  if (foundDirs.length === 1) return foundDirs[0]
  return foundDirs[0]
}

/**
 * Run `git clone --depth 1` with a timeout.
 * @param {string} repoUrl
 * @param {string} destDir
 * @returns {Promise<boolean>}
 */
function gitShallowClone(repoUrl, destDir) {
  return new Promise((resolvePromise) => {
    const proc = spawn('git', ['clone', '--depth', '1', repoUrl, destDir], {
      stdio: 'ignore',
      windowsHide: true,
    })
    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {
        /* ignore */
      }
      resolvePromise(false)
    }, 25000)
    proc.once('error', () => {
      clearTimeout(timer)
      resolvePromise(false)
    })
    proc.once('close', (code) => {
      clearTimeout(timer)
      resolvePromise(code === 0)
    })
  })
}

/**
 * Fallback extractor that builds a `SKILL.md` from `https://skills.sh/<source>/<skillId>`
 * when the upstream source is not a standard public GitHub `owner/repo`.
 * @param {string} source
 * @param {string} skillId
 * @returns {Promise<{ description: string, body: string } | null>}
 */
async function fetchSkillFromSkillsShPage(source, skillId) {
  try {
    const res = await fetch(`https://skills.sh/${source}/${skillId}`, {
      headers: { accept: 'text/html', 'user-agent': 'dsh-skills-manager/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    const description = descMatch ? descMatch[1] : `Skill ${skillId} from ${source}`

    // Extract rendered prose HTML from RSC payload if present
    const proseMatch = html.match(/\\"dangerouslySetInnerHTML\\":\{\\"__html\\":\\"([\s\S]*?)\\"\}\}\]\]\}\]/i)
    let body = `# ${skillId}\n\n${description}\n\nSource: https://skills.sh/${source}/${skillId}`
    if (proseMatch && proseMatch[1]) {
      const unescaped = proseMatch[1]
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (unescaped.length > 20) {
        body = unescaped
      }
    }
    return { description, body }
  } catch {
    return null
  }
}

/**
 * Install a remote skill from `skills.sh` or GitHub (`source: "owner/repo"`, `skillId`)
 * into Global (`~/.dsh/skills`) and/or selected Workspaces (`<ws>/.dsh/skills`).
 */
export async function installRemoteSkill(payload, workspaces) {
  const source = String(payload?.source || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '')
  const skillId = String(payload?.skillId || payload?.name || '').trim()
  const installGlobal = payload?.global !== false
  const workspaceIds = Array.isArray(payload?.workspaceIds) ? payload.workspaceIds : []

  if (!source || !skillId) {
    throw new Error('Both source repository and skillId are required')
  }

  const kebabName = toKebabSkillName(skillId)
  const targetRoots = []
  if (installGlobal) {
    targetRoots.push(join(homedir(), '.dsh', 'skills'))
  }
  for (const wsId of workspaceIds) {
    const ws = workspaces.find((w) => w.id === wsId)
    if (ws && ws.path) {
      targetRoots.push(join(ws.path, '.dsh', 'skills'))
    }
  }
  if (targetRoots.length === 0) {
    targetRoots.push(join(homedir(), '.dsh', 'skills'))
  }

  const isGitHubRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source) && !source.startsWith('site/')
  const tempRoot = join(tmpdir(), `dsh-skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  try {
    let copiedFromGit = false
    if (isGitHubRepo) {
      const repoUrl = `https://github.com/${source}.git`
      const cloned = await gitShallowClone(repoUrl, tempRoot)
      if (cloned) {
        const skillFolder = await findSkillFolderInRepo(tempRoot, skillId)
        if (skillFolder) {
          for (const targetRoot of targetRoots) {
            await copySkillBundleToRoot(skillFolder, targetRoot, kebabName)
          }
          copiedFromGit = true
        }
      }
    }

    if (!copiedFromGit) {
      const fallback = await fetchSkillFromSkillsShPage(source, skillId)
      if (!fallback) {
        throw new Error(`Could not locate SKILL.md in ${source} for "${skillId}"`)
      }
      const mdContent = serializeSkillMarkdown({
        name: kebabName,
        description: fallback.description,
        body: fallback.body,
      })
      for (const targetRoot of targetRoots) {
        const destDir = join(targetRoot, kebabName)
        await mkdir(destDir, { recursive: true })
        await writeFile(join(destDir, 'SKILL.md'), mdContent, 'utf8')
      }
    }

    return { ok: true, name: kebabName, installedRoots: targetRoots.length }
  } finally {
    if (existsSync(tempRoot)) {
      await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
    }
  }
}

/**
 * Build the complete overview state (`workspaces`, `installedSkills`, `importableSkills`).
 */
async function buildOverview() {
  const workspaces = await discoverWorkspaces()
  const installedSkills = await scanInstalledSkills(workspaces)
  const importableSkills = await scanImportableSkills(installedSkills)
  return {
    ok: true,
    workspaces,
    installedSkills,
    importableSkills,
  }
}

export function apply(ctx) {
  ctx.inject(['connection'], (connCtx) => {
    connCtx.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          const url = new URL(request.url)
          if (request.method === 'GET') {
            const action = url.searchParams.get('action') || 'overview'
            if (action === 'overview') {
              return Response.json(await buildOverview(), { headers: { 'cache-control': 'no-store' } })
            }
            if (action === 'explore') {
              const category = url.searchParams.get('category') || 'popular'
              const q = url.searchParams.get('q') || ''
              const force = url.searchParams.get('refresh') === '1'
              const workspaces = await discoverWorkspaces()
              const installed = await scanInstalledSkills(workspaces)
              const res = await exploreOnlineSkills({ category, q, force }, installed)
              return Response.json(res, { headers: { 'cache-control': 'no-store' } })
            }
            if (action === 'read-skill') {
              const skillName = toKebabSkillName(url.searchParams.get('name') || '')
              const workspaces = await discoverWorkspaces()
              const installed = await scanInstalledSkills(workspaces)
              const found = installed.find((s) => s.name === skillName)
              if (!found || !found.primarySkillMdPath || !existsSync(found.primarySkillMdPath)) {
                return Response.json({ ok: false, error: `Skill "${skillName}" not found` }, { status: 404 })
              }
              const raw = await readFile(found.primarySkillMdPath, 'utf8')
              const parsed = parseSkillMarkdown(raw, skillName)
              return Response.json({
                ok: true,
                name: found.name,
                raw,
                parsed,
                isGlobal: found.isGlobal,
                workspaceIds: found.workspaceIds,
              })
            }
            return Response.json({ ok: false, error: `Unknown GET action: ${action}` }, { status: 400 })
          }

          // POST actions
          const body = await request.json()
          const action = body?.action
          const workspaces = await discoverWorkspaces()

          if (action === 'import-local') {
            const items = Array.isArray(body.items) ? body.items : [body]
            const targetGlobal = body.global !== false
            const targetWorkspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds : []

            const targetRoots = []
            if (targetGlobal) {
              targetRoots.push(join(homedir(), '.dsh', 'skills'))
            }
            for (const wsId of targetWorkspaceIds) {
              const ws = workspaces.find((w) => w.id === wsId)
              if (ws && ws.path) targetRoots.push(join(ws.path, '.dsh', 'skills'))
            }
            if (targetRoots.length === 0) {
              targetRoots.push(join(homedir(), '.dsh', 'skills'))
            }

            let importedCount = 0
            for (const item of items) {
              const bundlePath = item?.bundlePath
              const skillName = item?.name || basename(String(bundlePath || ''))
              if (!bundlePath || !existsSync(bundlePath)) continue
              for (const root of targetRoots) {
                await copySkillBundleToRoot(bundlePath, root, skillName)
              }
              importedCount++
            }

            return Response.json({
              ...(await buildOverview()),
              importedCount,
            })
          }

          if (action === 'set-scopes') {
            const skillName = toKebabSkillName(body.name)
            const wantGlobal = Boolean(body.global)
            const wantWorkspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds : []

            const installed = await scanInstalledSkills(workspaces)
            const current = installed.find((s) => s.name === skillName)
            if (!current) {
              return Response.json({ ok: false, error: `Skill "${skillName}" is not installed` }, { status: 404 })
            }

            // Copy to newly requested scopes first before removing from old scopes
            const sourceBundle = current.primaryBundlePath
            if (wantGlobal && !current.isGlobal) {
              await copySkillBundleToRoot(sourceBundle, join(homedir(), '.dsh', 'skills'), skillName)
            }
            for (const wsId of wantWorkspaceIds) {
              if (!current.workspaceIds.includes(wsId)) {
                const ws = workspaces.find((w) => w.id === wsId)
                if (ws && ws.path) {
                  await copySkillBundleToRoot(sourceBundle, join(ws.path, '.dsh', 'skills'), skillName)
                }
              }
            }

            // Remove from unchecked scopes (only if at least one scope remains, or if user explicitly unchecked)
            if (!wantGlobal && current.isGlobal) {
              await removeSkillFromRoot(join(homedir(), '.dsh', 'skills'), skillName)
              await removeSkillFromRoot(join(homedir(), '.agents', 'skills'), skillName)
            }
            for (const oldWsId of current.workspaceIds) {
              if (!wantWorkspaceIds.includes(oldWsId)) {
                const ws = workspaces.find((w) => w.id === oldWsId)
                if (ws && ws.path) {
                  await removeSkillFromRoot(join(ws.path, '.dsh', 'skills'), skillName)
                  await removeSkillFromRoot(join(ws.path, '.agents', 'skills'), skillName)
                }
              }
            }

            return Response.json(await buildOverview())
          }

          if (action === 'toggle-invocation') {
            const skillName = toKebabSkillName(body.name)
            const installed = await scanInstalledSkills(workspaces)
            const current = installed.find((s) => s.name === skillName)
            if (!current) {
              return Response.json({ ok: false, error: `Skill "${skillName}" not found` }, { status: 404 })
            }

            const disableModelInvocation =
              typeof body.disableModelInvocation === 'boolean'
                ? body.disableModelInvocation
                : !current.disableModelInvocation
            const userInvocable =
              typeof body.userInvocable === 'boolean' ? body.userInvocable : current.userInvocable

            for (const loc of current.locations) {
              await normalizeSkillMdFile(loc.skillMdPath, skillName, {
                disableModelInvocation,
                userInvocable,
              })
            }

            return Response.json(await buildOverview())
          }

          if (action === 'save-skill') {
            const skillName = toKebabSkillName(body.name)
            const description = String(body.description || 'Custom agent skill').trim()
            const whenToUse = String(body.whenToUse || '').trim()
            const markdownBody = String(body.body || '').trim()
            const wantGlobal = body.global !== false
            const wantWorkspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds : []

            const serialized = serializeSkillMarkdown({
              name: skillName,
              description,
              whenToUse,
              disableModelInvocation: Boolean(body.disableModelInvocation),
              userInvocable: body.userInvocable !== false,
              body: markdownBody || `# ${skillName}\n\n${description}`,
            })

            const targetRoots = []
            if (wantGlobal) targetRoots.push(join(homedir(), '.dsh', 'skills'))
            for (const wsId of wantWorkspaceIds) {
              const ws = workspaces.find((w) => w.id === wsId)
              if (ws && ws.path) targetRoots.push(join(ws.path, '.dsh', 'skills'))
            }
            if (targetRoots.length === 0) {
              targetRoots.push(join(homedir(), '.dsh', 'skills'))
            }

            for (const root of targetRoots) {
              const dir = join(root, skillName)
              await mkdir(dir, { recursive: true })
              await writeFile(join(dir, 'SKILL.md'), serialized, 'utf8')
            }

            return Response.json(await buildOverview())
          }

          if (action === 'delete-skill') {
            const skillName = toKebabSkillName(body.name)
            const installed = await scanInstalledSkills(workspaces)
            const current = installed.find((s) => s.name === skillName)
            if (current) {
              for (const loc of current.locations) {
                await rm(loc.bundlePath, { recursive: true, force: true }).catch(() => {})
              }
            }
            return Response.json(await buildOverview())
          }

          if (action === 'install-remote') {
            await installRemoteSkill(body, workspaces)
            return Response.json(await buildOverview())
          }

          return Response.json({ ok: false, error: `Unknown POST action: ${action}` }, { status: 400 })
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    })
  })

  // Also register `skills_manager` tool so the in-chat Agent can list/search/install skills for the user
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register({
      name: 'skills_manager',
      description:
        'List installed DSH skills (Global & per-Workspace), import local skills from Antigravity or Claude Code, or search/install community skills from skills.sh and GitHub.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['overview', 'search', 'install-remote'],
            description: 'Action to execute.',
          },
          query: {
            type: 'string',
            description: 'Search query or category (popular, trending, hot, newest) when action is "search".',
          },
          source: {
            type: 'string',
            description: 'Repository owner/repo (e.g. "vercel-labs/agent-skills") when action is "install-remote".',
          },
          skillId: {
            type: 'string',
            description: 'Skill identifier (e.g. "web-design-guidelines") when action is "install-remote".',
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            summary: { type: 'string' },
          },
          additionalProperties: true,
        },
        render: (_args, val) => [{ type: 'text', text: val?.summary || JSON.stringify(val) }],
      },
      execute: async (args) => {
        const workspaces = await discoverWorkspaces()
        if (args.action === 'search') {
          const installed = await scanInstalledSkills(workspaces)
          const q = args.query || ''
          const isCategory = ['popular', 'trending', 'hot', 'newest'].includes(q.toLowerCase())
          const res = await exploreOnlineSkills(
            isCategory ? { category: q.toLowerCase() } : { q },
            installed,
          )
          const top = (res.items || [])
            .slice(0, 10)
            .map((i) => `- ${i.name} (${i.source})${i.installs ? ` [${i.installs.toLocaleString()} installs]` : ''}`)
            .join('\n')
          return {
            ok: true,
            summary: `Found ${(res.items || []).length} skills:\n${top}`,
            items: (res.items || []).slice(0, 15),
          }
        }
        if (args.action === 'install-remote') {
          const res = await installRemoteSkill(
            { source: args.source, skillId: args.skillId, global: true },
            workspaces,
          )
          return {
            ok: true,
            summary: `Installed skill "${res.name}" from ${args.source} into ~/.dsh/skills/${res.name}`,
          }
        }
        const ov = await buildOverview()
        return {
          ok: true,
          summary: `Installed DSH skills: ${ov.installedSkills.length} | Importable (Antigravity/Claude): ${ov.importableSkills.length} | Workspaces: ${ov.workspaces.length}`,
          installedCount: ov.installedSkills.length,
          importableCount: ov.importableSkills.length,
        }
      },
    })
  })
}
