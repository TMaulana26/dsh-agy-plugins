/**
 * Host half of the provider-usage bundle.
 *
 * Checks live usage and rate limits for configured AI model providers:
 * - Single-provider token quota endpoints (e.g. Dattio AI)
 * - Multi-provider aggregators (e.g. 9Router Quota & Rate Limit API)
 *
 * Automatically resolves the active provider from `agentDefaultModel` or
 * settings, locates the API key from `ctx.credentials`, handles candidate
 * endpoint URLs, normalizes the quota buckets, and serves the snapshot to
 * the Web UI (`/api/provider-usage.quota`) and the agent tool (`provider_usage`).
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Stable plugin name. */
export const name = 'provider-usage'

/** Defaults applied over the row config; the row wins on every key. */
const DEFAULTS = {
  provider: 'auto',
  baseURL: '',
  quotaURL: '',
  quotaPath: '/quota',
  apiKeyEnv: '',
  authHeader: 'Authorization',
  authScheme: 'Bearer',
  refreshSeconds: 60,
  timeoutMs: 10000,
  cacheMs: 5000,
}

/** Exact Fetch route the Client half calls. Must stay inside the `/api` mount. */
const ROUTE_PATH = '/api/provider-usage.quota'

/** In-process memo so a burst of callers shares one upstream request. */
const cache = new Map()
const inFlight = new Map()
const preferredUrlByProvider = new Map()

/**
 * Merge row config over defaults, rejecting values of the wrong shape.
 * @param {Record<string, unknown> | undefined} raw - the Loader row config.
 * @returns {typeof DEFAULTS} resolved config.
 */
function resolveConfig(raw) {
  const config = { ...DEFAULTS }
  if (raw === undefined || raw === null || typeof raw !== 'object') return config
  for (const key of Object.keys(DEFAULTS)) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    if (typeof DEFAULTS[key] === 'number') {
      const numeric = Number(value)
      const valid = key === 'cacheMs' ? numeric >= 0 : numeric > 0
      if (Number.isFinite(numeric) && valid) config[key] = numeric
      continue
    }
    if (typeof value === 'string') config[key] = value.trim()
  }
  return config
}

/**
 * Derive the conventional credential reference for a provider route:
 * `nine-router` becomes `NINE_ROUTER_API_KEY`, `dattio-ai` becomes `DATTIO_AI_API_KEY`.
 * @param {string} provider - provider route id.
 * @returns {string} environment-variable-style credential reference.
 */
function conventionalApiKeyRef(provider) {
  const base = provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${base || 'PROVIDER'}_API_KEY`
}

/**
 * Check whether Antigravity CLI (`agy`) is installed or configured on this machine.
 * @returns {boolean}
 */
function isAgyCliAvailable() {
  const home = homedir()
  const candidates = [
    process.env.AGY_BIN_PATH,
    join(home, '.dsh', 'storages', 'agy-provider-accounts.json'),
    process.platform === 'win32' ? join(home, 'AppData', 'Local', 'agy', 'bin', 'agy.exe') : '',
    process.platform === 'win32' ? join(home, '.gemini', 'antigravity-cli', 'bin', 'agy.exe') : '',
    join(home, '.gemini', 'antigravity-cli', 'bin', 'agy'),
    join(home, '.local', 'bin', 'agy'),
    '/usr/local/bin/agy',
  ].filter((p) => typeof p === 'string' && p.length > 0)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return true
  }
  return false
}

/**
 * Enumerate all quota-capable configured providers found in the settings projection and local CLI adapters.
 * @param {any} ctx - plugin context.
 * @returns {Array<{ id: string, displayName: string, baseURL?: string, apiKeyEnv?: string }>} list.
 */
function discoverAllProviders(ctx) {
  const map = new Map()
  const settings = ctx.get('settings')
  if (settings !== undefined && typeof settings.describe === 'function') {
    try {
      const descriptors = settings.describe()
      if (Array.isArray(descriptors)) {
        for (const descriptor of descriptors) {
          const value = descriptor?.value
          const providers = value?.providers
          if (providers !== null && typeof providers === 'object') {
            for (const [id, entry] of Object.entries(providers)) {
              if (!entry || typeof entry !== 'object') continue
              if (id === 'deepseek-account') continue
              if (!map.has(id)) {
                map.set(id, {
                  id,
                  displayName: typeof entry.displayName === 'string' && entry.displayName ? entry.displayName : id,
                  baseURL: typeof entry.baseURL === 'string' ? entry.baseURL : undefined,
                  apiKeyEnv: typeof entry.apiKeyEnv === 'string' ? entry.apiKeyEnv : undefined,
                })
              }
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Always include Antigravity CLI (`agy-cli`) when installed or configured on the system
  if (!map.has('agy-cli') && isAgyCliAvailable()) {
    map.set('agy-cli', {
      id: 'agy-cli',
      displayName: 'Antigravity CLI (agy)',
    })
  }

  return Array.from(map.values())
}

/**
 * Read one provider row out of the live settings projection.
 * @param {any} ctx - plugin context.
 * @param {string} provider - provider route id to find.
 * @returns {{ baseURL?: string, apiKeyEnv?: string, displayName?: string }} discovered fields.
 */
function discoverFromSettings(ctx, provider) {
  const settings = ctx.get('settings')
  if (settings === undefined || typeof settings.describe !== 'function') return {}
  let descriptors
  try {
    descriptors = settings.describe()
  } catch {
    return {}
  }
  if (!Array.isArray(descriptors)) return {}
  for (const descriptor of descriptors) {
    const value = descriptor?.value
    const providers = value?.providers
    if (providers !== null && typeof providers === 'object') {
      const entry = providers[provider]
      if (entry !== null && typeof entry === 'object') {
        const found = {}
        if (typeof entry.baseURL === 'string' && entry.baseURL.length > 0) found.baseURL = entry.baseURL
        if (typeof entry.apiKeyEnv === 'string' && entry.apiKeyEnv.length > 0) found.apiKeyEnv = entry.apiKeyEnv
        if (typeof entry.displayName === 'string' && entry.displayName.length > 0) found.displayName = entry.displayName
        return found
      }
    }
  }
  return {}
}

/**
 * Fall back to the LLM package's configurable-provider directory.
 * @param {any} ctx - plugin context.
 * @param {string} provider - provider route id.
 * @returns {{ baseURL?: string, displayName?: string }} discovered fields.
 */
function discoverFromDirectory(ctx, provider) {
  const llm = ctx.get('llm')
  if (llm === undefined || typeof llm.listConfigurableProviders !== 'function') return {}
  let entries
  try {
    entries = llm.listConfigurableProviders()
  } catch {
    return {}
  }
  if (!Array.isArray(entries)) return {}
  const entry = entries.find((candidate) => candidate?.provider === provider)
  if (entry === undefined) return {}
  const found = {}
  if (typeof entry.defaultBaseURL === 'string' && entry.defaultBaseURL.length > 0) found.baseURL = entry.defaultBaseURL
  if (typeof entry.displayName === 'string' && entry.displayName.length > 0) found.displayName = entry.displayName
  return found
}

/**
 * Determine the active provider to inspect.
 * @param {any} ctx - plugin context.
 * @param {typeof DEFAULTS} config - resolved config.
 * @param {string | undefined} requested - explicit override from query/args.
 * @returns {string} provider route id.
 */
function resolveActiveProvider(ctx, config, requested) {
  if (typeof requested === 'string' && requested.trim().length > 0) {
    return requested.trim()
  }
  if (typeof config.provider === 'string' && config.provider !== 'auto' && config.provider.trim().length > 0) {
    return config.provider.trim()
  }
  const all = discoverAllProviders(ctx)
  const defaultModel = ctx.get('agentDefaultModel')
  if (defaultModel !== undefined && typeof defaultModel.currentSelection === 'function') {
    try {
      const sel = defaultModel.currentSelection()
      const candidate = typeof sel?.provider === 'string' ? sel.provider.trim() : ''
      if (candidate.length > 0 && candidate !== 'deepseek-account') {
        const isAgy = candidate === 'agy-cli' || candidate.startsWith('agy')
        const hasTarget = isAgy || all.some((p) => p.id === candidate) || resolveTarget(ctx, config, candidate).candidateUrls.length > 0
        if (hasTarget) {
          return candidate
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (all.length > 0) return all[0].id
  if (isAgyCliAvailable()) return 'agy-cli'
  return 'nine-router'
}

/**
 * Determine the currently active model id, if any.
 * @param {any} ctx - plugin context.
 * @returns {string | undefined} model id.
 */
function resolveActiveModel(ctx) {
  const defaultModel = ctx.get('agentDefaultModel')
  if (defaultModel !== undefined && typeof defaultModel.currentSelection === 'function') {
    try {
      const sel = defaultModel.currentSelection()
      if (typeof sel?.model === 'string' && sel.model.length > 0) {
        return sel.model
      }
    } catch {
      /* ignore */
    }
  }
  return undefined
}

/**
 * Build candidate quota URLs for a provider.
 * For example, if baseURL is `https://9router.mtim.my.id/v1` and quotaPath is `/quota`:
 * Candidate 1: `https://9router.mtim.my.id/v1/quota` (direct composition)
 * Candidate 2: `https://9router.mtim.my.id/quota` (strip /v1)
 * Candidate 3: `https://9router.mtim.my.id/api/quota`
 * Once a candidate URL succeeds for a provider, `resolveTarget` promotes it to first position.
 * @param {string} baseURL - base URL.
 * @param {string} quotaPath - quota path.
 * @returns {string[]} candidate URLs.
 */
function buildCandidateUrls(baseURL, quotaPath) {
  if (!baseURL) return []
  const candidates = []
  const trimmed = baseURL.replace(/\/+$/, '')
  const suffix = quotaPath.startsWith('/') ? quotaPath : `/${quotaPath}`

  // 1. Direct composition (e.g. https://bandelbanget.xyz/v1/quota)
  candidates.push(`${trimmed}${suffix}`)

  // 2. Stripped version prefix if baseURL has /v\d+ (e.g. https://9router.mtim.my.id/quota)
  const withoutVersion = trimmed.replace(/\/v\d+.*$/i, '')
  if (withoutVersion !== trimmed) {
    candidates.push(`${withoutVersion}${suffix}`)
    if (suffix === '/quota') {
      candidates.push(`${withoutVersion}/api/quota`)
    }
  }
  return Array.from(new Set(candidates))
}

/**
 * Resolve target connection details for one provider.
 * Prevents global config overrides from misrouting credentials when switching across providers.
 * @param {any} ctx - plugin context.
 * @param {typeof DEFAULTS} config - resolved config.
 * @param {string} provider - provider route id.
 * @returns {{ provider: string, displayName: string, candidateUrls: string[], apiKeyRef: string }} target.
 */
function resolveTarget(ctx, config, provider) {
  const settings = discoverFromSettings(ctx, provider)
  const directory = Object.keys(settings).length > 0 ? {} : discoverFromDirectory(ctx, provider)
  const isPinnedProvider = config.provider !== 'auto' && config.provider === provider

  const baseURL = isPinnedProvider
    ? (config.baseURL || settings.baseURL || directory.baseURL || '')
    : (settings.baseURL || directory.baseURL || config.baseURL || '')

  const apiKeyRef = isPinnedProvider
    ? (config.apiKeyEnv || settings.apiKeyEnv || conventionalApiKeyRef(provider))
    : (settings.apiKeyEnv || config.apiKeyEnv || conventionalApiKeyRef(provider))

  const useQuotaUrlOverride = Boolean(config.quotaURL) && (isPinnedProvider || (!settings.baseURL && !directory.baseURL))
  let candidateUrls = useQuotaUrlOverride
    ? [config.quotaURL]
    : buildCandidateUrls(baseURL, config.quotaPath)

  const preferred = preferredUrlByProvider.get(provider)
  if (preferred && candidateUrls.length > 1 && candidateUrls.includes(preferred)) {
    candidateUrls = [preferred, ...candidateUrls.filter((u) => u !== preferred)]
  }

  return {
    provider,
    displayName: settings.displayName || directory.displayName || provider,
    candidateUrls,
    apiKeyRef,
  }
}

/**
 * Perform the upstream quota request across candidate URLs.
 * @param {typeof DEFAULTS} config - resolved config.
 * @param {{ candidateUrls: string[] }} target - target info.
 * @param {string} secret - API key.
 * @param {boolean | undefined} force - force fresh upstream check.
 * @param {AbortSignal | undefined} signal - cancellation.
 * @returns {Promise<{ status: number, body: unknown, usedUrl: string }>} response.
 */
async function requestQuota(config, target, secret, force, signal) {
  const headers = { accept: 'application/json' }
  headers[config.authHeader || 'Authorization'] = config.authScheme
    ? `${config.authScheme} ${secret}`
    : secret

  const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(config.timeoutMs) : undefined
  const combined = signal !== undefined && timeout !== undefined && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeout])
    : (timeout ?? signal)

  let lastStatus = 0
  let lastBody = null
  let lastUrl = target.candidateUrls[0] || ''

  for (const rawUrl of target.candidateUrls) {
    try {
      const url = new URL(rawUrl)
      if (force) url.searchParams.set('refresh', '1')
      const response = await fetch(url.href, { method: 'GET', headers, signal: combined })
      lastStatus = response.status
      lastUrl = rawUrl
      const text = await response.text()
      let body
      try {
        body = text.length > 0 ? JSON.parse(text) : undefined
      } catch {
        body = text.slice(0, 400)
      }
      lastBody = body
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json') || (body !== null && typeof body === 'object')
      if (response.status >= 200 && response.status < 300 && isJson) {
        return { status: response.status, body, usedUrl: rawUrl }
      }
      // If 404 or non-JSON (like an HTML SPA fallback), try next candidate URL
      if (response.status !== 404 && isJson) {
        break
      }
    } catch (err) {
      if (signal?.aborted) throw err
      // try next candidate
    }
  }

  return { status: lastStatus, body: lastBody, usedUrl: lastUrl }
}

/**
 * Format relative reset duration: "resets in 4h 8m" or "resets in 28m".
 * @param {string | null | undefined} resetAt - ISO timestamp.
 * @returns {string | null} formatted string.
 */
function formatResetDuration(resetAt) {
  if (!resetAt) return null
  const target = new Date(resetAt).getTime()
  if (!Number.isFinite(target)) return null
  const diff = target - Date.now()
  if (diff <= 0) return 'resets soon'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `resets in ${days}d ${hours % 24}h`
  }
  if (hours > 0) return `resets in ${hours}h ${mins}m`
  return `resets in ${mins}m`
}

/**
 * Select the highlight bucket for the ambient dock pill from normalized sub-providers.
 * @param {Array<any>} providers - normalized sub-providers list.
 * @param {string | undefined} currentModel - active model id.
 * @returns {Record<string, unknown> | null} highlight bucket.
 */
function pickHighlightBucket(providers, currentModel) {
  if (!Array.isArray(providers) || providers.length === 0) return null
  let highlight = null
  const modelClean = (currentModel || '').replace(/^[a-z0-9_-]+\//i, '').toLowerCase()

  // 1. Try matching active model id against quota keys (e.g. 'gemini-3.8-flash-medium')
  if (modelClean.length > 0) {
    for (const prov of providers) {
      for (const b of prov.quotas || []) {
        const bKey = b.key.toLowerCase().replace(/_/g, '-')
        if (bKey === modelClean || b.displayName.toLowerCase().includes(modelClean)) {
          highlight = {
            providerName: prov.name,
            providerId: prov.provider,
            displayName: b.displayName,
            remainingPercentage: b.remainingPercentage,
            used: b.used,
            total: b.total,
            resetAt: b.resetAt,
            resetIn: b.resetIn,
          }
          break
        }
      }
      if (highlight) break
    }
  }

  // 1b. Family match for grouped providers like Antigravity CLI (Gemini vs Claude/GPT)
  if (!highlight && modelClean.length > 0) {
    const wantClaudeOrGpt = modelClean.includes('claude') || modelClean.includes('gpt')
    const wantGemini = modelClean.includes('gemini')
    for (const prov of providers) {
      const provText = `${prov.provider || ''} ${prov.name || ''}`.toLowerCase()
      const matchesFamily =
        (wantClaudeOrGpt && (provText.includes('claude') || provText.includes('gpt'))) ||
        (wantGemini && provText.includes('gemini'))
      if (matchesFamily && Array.isArray(prov.quotas) && prov.quotas.length > 0) {
        const chosen =
          prov.quotas.find((b) => b.key.includes('5h') || b.key.includes('session')) || prov.quotas[0]
        if (chosen && typeof chosen.remainingPercentage === 'number') {
          highlight = {
            providerName: prov.name,
            providerId: prov.provider,
            displayName: chosen.displayName,
            remainingPercentage: chosen.remainingPercentage,
            used: chosen.used,
            total: chosen.total,
            resetAt: chosen.resetAt,
            resetIn: chosen.resetIn,
          }
          break
        }
      }
    }
  }

  // 2. Fallback: match 5h session bucket for active provider (e.g. gemini_session)
  if (!highlight) {
    for (const prov of providers) {
      for (const b of prov.quotas || []) {
        if (b.key.includes('session') && typeof b.remainingPercentage === 'number') {
          highlight = {
            providerName: prov.name,
            providerId: prov.provider,
            displayName: b.displayName,
            remainingPercentage: b.remainingPercentage,
            used: b.used,
            total: b.total,
            resetAt: b.resetAt,
            resetIn: b.resetIn,
          }
          break
        }
      }
      if (highlight) break
    }
  }

  // 3. Fallback: bucket with lowest remaining percentage
  if (!highlight) {
    let lowest = Infinity
    for (const prov of providers) {
      for (const b of prov.quotas || []) {
        if (typeof b.remainingPercentage === 'number' && b.remainingPercentage < lowest) {
          lowest = b.remainingPercentage
          highlight = {
            providerName: prov.name,
            providerId: prov.provider,
            displayName: b.displayName,
            remainingPercentage: b.remainingPercentage,
            used: b.used,
            total: b.total,
            resetAt: b.resetAt,
            resetIn: b.resetIn,
          }
        }
      }
    }
  }

  return highlight
}

/**
 * Normalize an aggregated 9Router quota response.
 * @param {any} source - raw 9Router JSON body.
 * @param {string} quotaUrl - URL used.
 * @param {string | undefined} currentModel - active model id.
 * @returns {Record<string, unknown>} aggregated snapshot.
 */
function normalizeAggregatedQuota(source, quotaUrl, currentModel) {
  const rawProviders = Array.isArray(source.providers) ? source.providers : []
  const providers = rawProviders.map((p) => {
    const rawQuotas = p?.quotas !== null && typeof p?.quotas === 'object' ? p.quotas : {}
    const buckets = []
    for (const [key, q] of Object.entries(rawQuotas)) {
      if (!q || typeof q !== 'object') continue
      const displayName = q.displayName || q.name || key
      let remainingPct = q.remainingPercentage
      if (typeof remainingPct !== 'number') {
        if (typeof q.percentage === 'number') {
          remainingPct = q.percentageIsUsed ? Math.max(0, 100 - q.percentage) : q.percentage
        } else if (typeof q.remaining === 'number' && typeof q.total === 'number' && q.total > 0) {
          remainingPct = Math.round((q.remaining / q.total) * 10000) / 100
        }
      }
      buckets.push({
        key,
        displayName,
        remainingPercentage: typeof remainingPct === 'number' ? Math.round(remainingPct * 10) / 10 : undefined,
        used: typeof q.used === 'number' ? q.used : undefined,
        total: typeof q.total === 'number' ? q.total : undefined,
        remaining: typeof q.remaining === 'number' ? q.remaining : undefined,
        resetAt: typeof q.resetAt === 'string' ? q.resetAt : null,
        resetIn: formatResetDuration(q.resetAt),
        unlimited: q.unlimited === true,
        emptyMessage: typeof q.emptyMessage === 'string' ? q.emptyMessage : null,
      })
    }
    return {
      id: String(p.id ?? p.provider ?? ''),
      provider: String(p.provider ?? 'unknown'),
      name: String(p.name || p.email || p.provider || 'Provider'),
      email: typeof p.email === 'string' ? p.email : null,
      plan: typeof p.plan === 'string' ? p.plan : (typeof p.tier === 'string' ? p.tier : undefined),
      tier: typeof p.tier === 'string' ? p.tier : undefined,
      rawMessage: typeof p.rawMessage === 'string' ? p.rawMessage : null,
      error: typeof p.error === 'string' ? p.error : null,
      quotas: buckets,
    }
  })

  const highlight = pickHighlightBucket(providers, currentModel)

  return {
    type: 'aggregated',
    totalProviders: typeof source.totalProviders === 'number' ? source.totalProviders : providers.length,
    authenticatedKey: typeof source.authenticatedKey === 'string' ? source.authenticatedKey : undefined,
    cached: source.cached === true,
    cacheAgeSeconds: typeof source.cacheAgeSeconds === 'number' ? source.cacheAgeSeconds : undefined,
    providers,
    highlight,
  }
}

/**
 * Normalize a single-provider token quota response (e.g. Dattio AI).
 * @param {any} source - raw JSON body.
 * @returns {Record<string, unknown>} single snapshot.
 */
function normalizeSingleQuota(source) {
  const pick = (...keys) => {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value))) return Number(value)
    }
    return undefined
  }
  const usage = source.usage !== null && typeof source.usage === 'object' ? source.usage : {}
  const usageNumber = (key) => {
    const value = usage[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }
  const maxTokens = pick('maxTokens', 'max_tokens', 'limit', 'quota', 'totalAllowed')
  const remainingTokens = pick('remainingTokens', 'remaining_tokens', 'remaining', 'left')
  const usedTokens = usageNumber('total_tokens') ?? (maxTokens !== undefined && remainingTokens !== undefined ? maxTokens - remainingTokens : undefined)
  const computedPercent = maxTokens !== undefined && maxTokens > 0 && usedTokens !== undefined
    ? Math.round((usedTokens / maxTokens) * 10000) / 100
    : undefined
  const usagePercent = pick('usagePercent', 'usage_percent') ?? computedPercent

  return {
    type: 'single',
    status: typeof source.status === 'string' ? source.status : undefined,
    planName: typeof source.name === 'string' ? source.name : undefined,
    accountId: typeof source.id === 'number' || typeof source.id === 'string' ? source.id : undefined,
    maxTokens,
    remainingTokens,
    usagePercent,
    usage: {
      promptTokens: usageNumber('prompt_tokens'),
      completionTokens: usageNumber('completion_tokens'),
      totalTokens: usageNumber('total_tokens'),
      cachedTokens: usageNumber('cached_tokens'),
      requests: usageNumber('requests'),
    },
    validDays: pick('validDays', 'valid_days'),
    expiresAt: typeof source.expiresAt === 'string' ? source.expiresAt : undefined,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : undefined,
    penaltyActive: typeof source.penaltyActive === 'boolean' ? source.penaltyActive : undefined,
    penaltyReason: typeof source.penaltyReason === 'string' ? source.penaltyReason : undefined,
    billingType: typeof source.billingType === 'string' ? source.billingType : undefined,
    bannedReason: typeof source.bannedReason === 'string' ? source.bannedReason : undefined,
  }
}

/**
 * Universal quota normalizer that delegates to aggregated or single shape.
 * @param {unknown} body - parsed response.
 * @param {{ provider: string, displayName: string }} target - target info.
 * @param {string} quotaUrl - URL used.
 * @param {number} status - HTTP status.
 * @param {string | undefined} currentModel - active model.
 * @returns {Record<string, unknown>} unified normalized snapshot.
 */
function normalizeQuota(body, target, quotaUrl, status, currentModel) {
  const source = body !== null && typeof body === 'object' ? body : {}
  const isAggregated = Array.isArray(source.providers) || source.totalProviders !== undefined

  const specific = isAggregated
    ? normalizeAggregatedQuota(source, quotaUrl, currentModel)
    : normalizeSingleQuota(source)

  return {
    ok: status >= 200 && status < 300,
    provider: target.provider,
    displayName: target.displayName,
    quotaURL: quotaUrl,
    httpStatus: status,
    fetchedAt: new Date().toISOString(),
    currentModel,
    raw: body,
    ...specific,
  }
}

/**
 * Build the failure snapshot.
 * @param {string} code - stable failure code.
 * @param {string} message - human-readable reason.
 * @param {Record<string, unknown>} extra - extra fields.
 * @returns {Record<string, unknown>} failure.
 */
function failure(code, message, extra) {
  return {
    ok: false,
    code,
    error: message,
    fetchedAt: new Date().toISOString(),
    ...(extra ?? {}),
  }
}

/**
 * Attach contextual model/providers metadata and recompute highlight if needed.
 * @param {Record<string, unknown>} snapshot - base snapshot.
 * @param {Array<any>} allProviders - configured providers list.
 * @param {string | undefined} currentModel - active model id.
 * @returns {Record<string, unknown>} contextualized snapshot copy.
 */
function contextualizeSnapshot(snapshot, allProviders, currentModel) {
  const copy = {
    ...snapshot,
    configuredProviders: allProviders,
    currentModel,
  }
  if (copy.ok === true && copy.type === 'aggregated' && Array.isArray(copy.providers)) {
    copy.highlight = pickHighlightBucket(copy.providers, currentModel)
  }
  return copy
}

/**
 * Locate the `agy` CLI binary for local quota inspection.
 * @returns {string} binary path or executable name.
 */
function resolveAgyBinaryForUsage() {
  const home = homedir()
  const candidates = [
    process.env.AGY_BIN_PATH,
    process.platform === 'win32' ? join(home, 'AppData', 'Local', 'agy', 'bin', 'agy.exe') : '',
    process.platform === 'win32' ? join(home, '.gemini', 'antigravity-cli', 'bin', 'agy.exe') : '',
    join(home, '.gemini', 'antigravity-cli', 'bin', 'agy'),
    join(home, '.local', 'bin', 'agy'),
    '/usr/local/bin/agy',
  ].filter((p) => typeof p === 'string' && p.length > 0)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return process.platform === 'win32' ? 'agy.exe' : 'agy'
}

/**
 * Query `agy -p /usage --output-format json` and normalize into the `aggregated` snapshot shape
 * (ported from `tm-agy-tele/core/usage.py`).
 * @param {typeof DEFAULTS} config - resolved config.
 * @param {{ provider: string, displayName: string }} target - target info.
 * @param {Array<any>} allProviders - configured providers list.
 * @param {string | undefined} currentModel - active model id.
 * @returns {Promise<Record<string, unknown>>} snapshot.
 */
async function collectAgyCliUsage(config, target, allProviders, currentModel) {
  const bin = resolveAgyBinaryForUsage()
  const timeoutSec = Math.max(25, Math.min(45, Math.ceil((config.timeoutMs || 25000) / 1000)))

  const rawOutput = await new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let proc
    try {
      proc = spawn(bin, ['-p', '/usage', '--output-format', 'json', '--print-timeout', `${timeoutSec}s`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (err) {
      reject(err)
      return
    }
    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {
        /* ignore */
      }
      reject(new Error(`Antigravity CLI /usage timed out after ${timeoutSec}s`))
    }, (timeoutSec + 2) * 1000)

    proc.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    proc.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    proc.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.once('close', (code) => {
      clearTimeout(timer)
      if (stdout.trim().length > 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(stderr.trim() || `agy /usage exited with code ${code}`))
      }
    })
  })

  let parsed = null
  for (const line of rawOutput.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        parsed = JSON.parse(trimmed)
        break
      } catch {
        /* continue */
      }
    }
  }
  if (!parsed) {
    parsed = JSON.parse(rawOutput)
  }

  const groups = Array.isArray(parsed?.command?.data?.groups) ? parsed.command.data.groups : []
  const providers = groups.map((g, idx) => {
    const gName = typeof g?.name === 'string' && g.name ? g.name : `Group ${idx + 1}`
    const isClaude = gName.toLowerCase().includes('claude')
    const rawBuckets = Array.isArray(g?.buckets) ? g.buckets : []
    const quotas = rawBuckets.map((b) => {
      const fraction = typeof b?.remaining_fraction === 'number' ? b.remaining_fraction : 1
      const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 10
      const resetAt = typeof b?.reset_time === 'string' && b.reset_time ? b.reset_time : null
      const windowKey = typeof b?.window === 'string' && b.window ? b.window : 'limit'
      const rawId = typeof b?.id === 'string' && b.id ? b.id : `${isClaude ? 'claude' : 'gemini'}-${windowKey}`
      const key = windowKey === '5h' ? `${rawId}-session` : rawId
      return {
        key,
        displayName: typeof b?.name === 'string' && b.name ? b.name : rawId,
        remainingPercentage: pct,
        resetAt,
        resetIn: formatResetDuration(resetAt),
        unlimited: false,
        emptyMessage: null,
      }
    })
    return {
      id: isClaude ? 'agy-claude-gpt' : `agy-gemini-${idx}`,
      provider: isClaude ? 'claude' : 'gemini',
      name: gName,
      email: typeof g?.description === 'string' ? g.description : null,
      plan: 'Antigravity CLI',
      tier: 'Native CLI',
      rawMessage: null,
      error: null,
      quotas,
    }
  })

  const highlight = pickHighlightBucket(providers, currentModel)

  return {
    ok: true,
    provider: target.provider,
    displayName: target.displayName || 'Antigravity CLI (agy)',
    quotaURL: 'agy -p /usage --output-format json',
    httpStatus: 200,
    fetchedAt: new Date().toISOString(),
    currentModel,
    configuredProviders: allProviders,
    type: 'aggregated',
    totalProviders: providers.length,
    cached: false,
    providers,
    highlight,
    refreshSeconds: config.refreshSeconds,
  }
}

/**
 * Collect one usage snapshot, coalescing concurrent in-flight requests per provider.
 * @param {any} ctx - plugin context.
 * @param {typeof DEFAULTS} config - resolved config.
 * @param {{ provider?: string, force?: boolean, signal?: AbortSignal }} options - call options.
 * @returns {Promise<Record<string, unknown>>} snapshot.
 */
async function collectUsage(ctx, config, options) {
  const provider = resolveActiveProvider(ctx, config, options.provider)
  const currentModel = resolveActiveModel(ctx)
  const allProviders = discoverAllProviders(ctx)
  const target = resolveTarget(ctx, config, provider)

  const cached = cache.get(provider)
  if (options.force !== true && config.cacheMs > 0 && cached !== undefined && Date.now() - cached.at < config.cacheMs) {
    return contextualizeSnapshot(cached.snapshot, allProviders, currentModel)
  }

  if (options.force !== true && inFlight.has(provider)) {
    const shared = await inFlight.get(provider)
    return contextualizeSnapshot(shared, allProviders, currentModel)
  }

  // Native Antigravity CLI (`agy-cli`) quota path via `agy -p /usage --output-format json`
  if (provider === 'agy-cli' || provider.startsWith('agy')) {
    const agyTask = (async () => {
      try {
        const snapshot = await collectAgyCliUsage(config, target, allProviders, currentModel)
        if (config.cacheMs > 0) {
          cache.set(provider, { at: Date.now(), snapshot })
        }
        return snapshot
      } catch (error) {
        return failure('AGY_CLI_USAGE_FAILED', describe(error), {
          provider,
          quotaURL: 'agy -p /usage',
          configuredProviders: allProviders,
        })
      }
    })()

    if (options.force !== true) {
      inFlight.set(provider, agyTask)
    }
    try {
      const result = await agyTask
      return contextualizeSnapshot(result, allProviders, currentModel)
    } finally {
      if (inFlight.get(provider) === agyTask) {
        inFlight.delete(provider)
      }
    }
  }

  if (target.candidateUrls.length === 0) {
    return failure('NO_ENDPOINT', `no quota endpoint for provider "${provider}": set baseURL or quotaURL in config`, {
      provider,
      configuredProviders: allProviders,
    })
  }

  const credentials = ctx.get('credentials')
  if (credentials === undefined || typeof credentials.resolve !== 'function') {
    return failure('NO_CREDENTIAL_SERVICE', 'the credentials service is not mounted in this composition', {
      provider,
      configuredProviders: allProviders,
    })
  }

  const task = (async () => {
    let resolved
    try {
      resolved = await credentials.resolve(target.apiKeyRef)
    } catch (error) {
      return failure('CREDENTIAL_READ_FAILED', describe(error), {
        provider,
        apiKeyRef: target.apiKeyRef,
        configuredProviders: allProviders,
      })
    }

    if (resolved === undefined || typeof resolved.value !== 'string' || resolved.value.length === 0) {
      return failure('NO_API_KEY', `credential ${target.apiKeyRef} is not configured`, {
        provider,
        apiKeyRef: target.apiKeyRef,
        configuredProviders: allProviders,
      })
    }

    let reply
    try {
      reply = await requestQuota(config, target, resolved.value, options.force, options.signal)
    } catch (error) {
      return failure('REQUEST_FAILED', describe(error), {
        provider,
        quotaURL: target.candidateUrls[0],
        configuredProviders: allProviders,
      })
    }

    const snapshot = normalizeQuota(reply.body, target, reply.usedUrl, reply.status, currentModel)
    snapshot.configuredProviders = allProviders

    if (!snapshot.ok) {
      return {
        ...failure('UPSTREAM_STATUS', `quota endpoint answered ${reply.status}`, {
          provider,
          quotaURL: reply.usedUrl,
          configuredProviders: allProviders,
        }),
        httpStatus: reply.status,
        raw: reply.body,
      }
    }

    preferredUrlByProvider.set(provider, reply.usedUrl)
    snapshot.refreshSeconds = config.refreshSeconds
    if (config.cacheMs > 0) {
      cache.set(provider, { at: Date.now(), snapshot })
    }
    return snapshot
  })()

  if (options.force !== true) {
    inFlight.set(provider, task)
  }
  try {
    const result = await task
    return contextualizeSnapshot(result, allProviders, currentModel)
  } finally {
    if (inFlight.get(provider) === task) {
      inFlight.delete(provider)
    }
  }
}

/**
 * Extract error message text.
 * @param {unknown} error - thrown value.
 * @returns {string} message.
 */
function describe(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Render one snapshot as a single line summary for agent tools or logs.
 * @param {Record<string, unknown>} snapshot - snapshot.
 * @returns {string} summary.
 */
function summarize(snapshot) {
  if (snapshot.ok !== true) {
    return `${String(snapshot.displayName ?? snapshot.provider ?? 'provider')}: ${String(snapshot.error ?? 'usage unavailable')}`
  }

  if (snapshot.type === 'aggregated') {
    const provs = Array.isArray(snapshot.providers) ? snapshot.providers : []
    const parts = provs.map((p) => {
      if (p.rawMessage) return `${p.name}: ${p.rawMessage}`
      const qSummaries = (p.quotas || [])
        .filter((q) => q.remainingPercentage !== undefined || q.remaining !== undefined)
        .slice(0, 3)
        .map((q) => {
          const pct = q.remainingPercentage !== undefined ? `${q.remainingPercentage}% left` : `${q.remaining}/${q.total}`
          const reset = q.resetIn ? ` (${q.resetIn})` : ''
          return `${q.displayName}: ${pct}${reset}`
        })
      return `${p.name} [${qSummaries.join('; ') || 'active'}]`
    })
    return `${String(snapshot.displayName ?? snapshot.provider)} (${snapshot.totalProviders} providers): ${parts.join(' | ')}`
  }

  // Single provider
  const percent = typeof snapshot.usagePercent === 'number' ? `${snapshot.usagePercent}% used` : 'usage unknown'
  const remaining = typeof snapshot.remainingTokens === 'number'
    ? `${snapshot.remainingTokens} of ${typeof snapshot.maxTokens === 'number' ? snapshot.maxTokens : '?'} tokens left`
    : 'remaining tokens unknown'
  const expiry = typeof snapshot.expiresAt === 'string' ? `, expires ${snapshot.expiresAt}` : ''
  return `${String(snapshot.displayName ?? snapshot.provider)}: ${percent}, ${remaining}${expiry}`
}

/**
 * Plugin entry: publish the Fetch route and the agent tool.
 * @param {any} ctx - plugin context.
 * @param {Record<string, unknown> | undefined} rawConfig - Loader row config.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)

  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const url = new URL(request.url)
        const provider = url.searchParams.get('provider') ?? undefined
        const force = url.searchParams.get('refresh') !== null || url.searchParams.get('force') !== null
        const snapshot = await collectUsage(connectionCtx, config, {
          provider,
          force,
          signal: request.signal,
        })
        return Response.json(snapshot, { headers: { 'cache-control': 'no-store' } })
      },
    })
  })

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register({
      name: 'provider_usage',
      description:
        'Check the live token quota or rate limits of a configured model provider (supports single-provider token counters like Dattio AI and multi-provider aggregators like 9Router). Reads the same snapshot shown under the composer.',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'Provider route id, for example "nine-router" or "dattio-ai". Defaults to the active provider.',
          },
          refresh: {
            type: 'boolean',
            description: 'Bypass the in-process and upstream cache and query the quota endpoint now.',
          },
        },
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
        render: (_args, value) => {
          const text = value !== null && typeof value === 'object' && typeof value.summary === 'string'
            ? value.summary
            : JSON.stringify(value)
          return [{ type: 'text', text }]
        },
      },
      execute: async (args, exec) => {
        const request = args !== null && typeof args === 'object' ? args : {}
        const snapshot = await collectUsage(toolCtx, config, {
          provider: typeof request.provider === 'string' ? request.provider : undefined,
          force: request.refresh === true,
          signal: exec?.signal,
        })
        const { raw: _raw, ...cleanSnapshot } = snapshot
        const result = { ...cleanSnapshot, summary: summarize(snapshot) }
        return JSON.parse(JSON.stringify(result))
      },
    })
  })
}
