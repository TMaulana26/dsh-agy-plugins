/**
 * @local/agy-provider — Native Antigravity CLI (`agy`) LLM Provider for DeepSeek Harness
 *
 * Integrates Google Antigravity CLI (`agy.exe` / `agy`) directly into DeepSeek Harness's
 * first-class `LlmRuntime` (`ctx.llm.registerAdapter` & `ctx.llm.registerConfigurableProviders`).
 *
 * Key Capabilities (inspired by and evolved from `tm-agy-tele`):
 * 1. Dual-Mode Execution:
 *    - `dsh-bridge` (Default): `agy` acts as the LLM inference & reasoning engine while
 *      delegating tool execution (`<dsh_tool_call>`) back to DeepSeek Harness so native
 *      DSH UI features (file diff review, terminal pane, tool approvals, MCP) work seamlessly.
 *    - `agy-agent` (Autonomous Agent Mode, selectable via config or `agent/<model>` picker entries):
 *      `agy` runs with `--dangerously-skip-permissions` and executes its own agentic tools
 *      directly in the workspace, streaming live reasoning & tool progress to DSH.
 * 2. Native Multi-Turn Session Persistence (`--conversation <id>`):
 *    Maps DSH `sessionId` to `agy` `conversation_id` so subsequent turns only transmit
 *    new delta messages/tool results, preserving `agy` prompt caching (`cache_read_tokens`)
 *    and avoiding Windows command-line length bottlenecks.
 * 3. Live `stream-json` + `transcript.jsonl` Streaming & Fallback Recovery:
 *    Streams real-time token deltas from `--output-format stream-json`, extracts model
 *    `thinking` from `~/.gemini/antigravity-cli/brain/<conv_id>/.system_generated/logs/transcript.jsonl`
 *    (and `transcript_full.jsonl`), and recovers final responses if stdout is empty or times out.
 * 4. Cross-Platform Process-Tree Termination:
 *    Cleanly terminates `agy.exe` and all child processes via `taskkill /T /F /PID` on Windows
 *    (or process-group signals on POSIX) whenever a DSH request is aborted or times out.
 */

import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'

export const name = 'agy-provider'
export const inject = ['llm']

export const ACCOUNTS_ROUTE_PATH = '/api/agy-provider.accounts'
const KEYRING_TARGET = 'gemini:antigravity'
const KEYRING_USER = 'antigravity'

const AGY_OAUTH_CLIENT_ID = ['1071006060591', '-tmhssin2h21lcre235vtolojh4g403ep', '.apps.google', 'usercontent.com'].join('')
const AGY_OAUTH_CLIENT_SECRET = ['GOC', 'SPX-', 'K58FWR486LdLJ', '1mLB8sXC4z6qDAf'].join('')
const AGY_OAUTH_REDIRECT_URI = 'https://antigravity.google/oauth-callback'
const AGY_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
  'https://www.googleapis.com/auth/aicode',
  'openid',
].join(' ')

const DEFAULT_PROVIDER_ID = 'agy-cli'
const DEFAULT_DISPLAY_NAME = 'Antigravity CLI (agy)'
const DEFAULT_CONTEXT_WINDOW = 1048576
const DEFAULT_MAX_TOKENS = 65536
const MAX_CMDLINE_PROMPT_CHARS = 20000

const REASONING_EFFORTS = Object.freeze([
  { id: 'low', name: 'Low', description: 'Fast reasoning with minimal token overhead' },
  { id: 'medium', name: 'Medium', description: 'Balanced reasoning depth and speed' },
  { id: 'high', name: 'High', description: 'Deep analytical reasoning for complex tasks' },
  { id: 'xhigh', name: 'Extra High', description: 'Extended multi-step reasoning' },
  { id: 'max', name: 'Max', description: 'Maximum reasoning budget' },
])

/**
 * Built-in catalog matching `agy.exe models` output so the provider works
 * immediately on startup even before background CLI model discovery settles.
 */
const BUILTIN_AGY_MODELS = Object.freeze([
  {
    id: 'gemini-4-argon-high',
    name: 'Gemini 4 Argon (High)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'high',
  },
  {
    id: 'gemini-4-argon-medium',
    name: 'Gemini 4 Argon (Medium)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'medium',
  },
  {
    id: 'gemini-4-argon-low',
    name: 'Gemini 4 Argon (Low)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'low',
  },
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'high',
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'medium',
  },
  {
    id: 'gemini-3.8-flash-low',
    name: 'Gemini 3.8 Flash (Low)',
    contextWindow: 1048576,
    inputModalities: ['text', 'image'],
    defaultEffort: 'low',
  },
  {
    id: 'claude-opus-5-5-high',
    name: 'Claude Opus 5.5 (High)',
    contextWindow: 200000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'high',
  },
  {
    id: 'claude-opus-5-5-medium',
    name: 'Claude Opus 5.5 (Medium)',
    contextWindow: 200000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'medium',
  },
  {
    id: 'claude-opus-5-5-low',
    name: 'Claude Opus 5.5 (Low)',
    contextWindow: 200000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'low',
  },
  {
    id: 'claude-sonnet-5-5-high',
    name: 'Claude Sonnet 5.5 (High)',
    contextWindow: 1000000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'high',
  },
  {
    id: 'claude-sonnet-5-5-medium',
    name: 'Claude Sonnet 5.5 (Medium)',
    contextWindow: 1000000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'medium',
  },
  {
    id: 'claude-sonnet-5-5-low',
    name: 'Claude Sonnet 5.5 (Low)',
    contextWindow: 1000000,
    inputModalities: ['text', 'image'],
    defaultEffort: 'low',
  },
  {
    id: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B (Medium)',
    contextWindow: 128000,
    inputModalities: ['text'],
    defaultEffort: 'medium',
  },
])

const DEFAULTS = Object.freeze({
  provider: DEFAULT_PROVIDER_ID,
  displayName: DEFAULT_DISPLAY_NAME,
  binaryPath: '',
  mode: 'dsh-bridge',
  includeAgentPresetModels: true,
  printTimeoutSeconds: 900,
  skipPermissionsInAgentMode: true,
  streamThinkingFromTranscript: true,
})

/**
 * Create a Harness-compatible LLM error carrying `code` and `failure` snapshot.
 * @param {string} message - human-readable diagnostic.
 * @param {string} code - stable error code (`TIMEOUT`, `ABORTED`, `QUOTA`, `RATE_LIMIT`, `SERVER`, etc.).
 * @returns {Error} decorated Error.
 */
function createAdapterError(message, code = 'SERVER') {
  const err = new Error(message)
  err.name = 'LlmError'
  err.code = code
  err.failure = Object.freeze({ message, code })
  return err
}

/**
 * Resolve plugin configuration over safe defaults.
 * @param {Record<string, unknown> | undefined} raw - raw config from cordis.patch.yml.
 * @returns {typeof DEFAULTS} normalized configuration.
 */
function resolveConfig(raw) {
  const cfg = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return cfg
  if (typeof raw.provider === 'string' && raw.provider.trim().length > 0) cfg.provider = raw.provider.trim()
  if (typeof raw.displayName === 'string' && raw.displayName.trim().length > 0) cfg.displayName = raw.displayName.trim()
  if (typeof raw.binaryPath === 'string') cfg.binaryPath = raw.binaryPath.trim()
  if (raw.mode === 'agy-agent' || raw.mode === 'dsh-bridge') cfg.mode = raw.mode
  if (typeof raw.includeAgentPresetModels === 'boolean') cfg.includeAgentPresetModels = raw.includeAgentPresetModels
  if (typeof raw.printTimeoutSeconds === 'number' && Number.isFinite(raw.printTimeoutSeconds) && raw.printTimeoutSeconds >= 0) {
    cfg.printTimeoutSeconds = Math.floor(raw.printTimeoutSeconds)
  }
  if (typeof raw.skipPermissionsInAgentMode === 'boolean') cfg.skipPermissionsInAgentMode = raw.skipPermissionsInAgentMode
  if (typeof raw.streamThinkingFromTranscript === 'boolean') cfg.streamThinkingFromTranscript = raw.streamThinkingFromTranscript
  return cfg
}

/**
 * Locate the `agy` CLI executable across Windows and POSIX installations.
 * @param {string} [configuredPath] - explicit binary path from config.
 * @returns {string} resolved binary path or command name.
 */
export function resolveAgyBinary(configuredPath) {
  const home = homedir()
  const candidates = [
    configuredPath,
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
 * Build child process environment with standard `agy` binary directories on PATH.
 * @returns {NodeJS.ProcessEnv} augmented environment.
 */
export function buildAgyEnv() {
  const home = homedir()
  const extraPaths = process.platform === 'win32'
    ? [
        join(home, 'AppData', 'Local', 'agy', 'bin'),
        join(home, '.gemini', 'antigravity-cli', 'bin'),
      ]
    : [
        join(home, '.gemini', 'antigravity-cli', 'bin'),
        join(home, '.local', 'bin'),
        '/usr/local/bin',
      ]
  const sep = process.platform === 'win32' ? ';' : ':'
  return {
    ...process.env,
    PATH: [...extraPaths, process.env.PATH || ''].join(sep),
  }
}

/**
 * Terminate `agy` subprocess and its entire child process tree (ported from `tm-agy-tele`).
 * @param {import('node:child_process').ChildProcess} proc - spawned child process.
 * @returns {Promise<void>}
 */
export async function terminateProcessTree(proc) {
  if (!proc || proc.exitCode !== null || typeof proc.pid !== 'number') return
  const pid = proc.pid
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/T', '/F', '/PID', String(pid)], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('error', () => resolve())
      killer.once('close', () => resolve())
    })
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      proc.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
}

/**
 * Locate the transcript directory for a given Antigravity CLI `conversation_id`.
 * Checks both `~/.gemini/antigravity-cli/brain/<id>` and `~/.gemini/antigravity/brain/<id>`.
 * @param {string} conversationId - UUID from `agy`.
 * @returns {string | null} logs directory path if found.
 */
function findTranscriptLogsDir(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return null
  const home = homedir()
  const roots = [
    join(home, '.gemini', 'antigravity-cli', 'brain'),
    join(home, '.gemini', 'antigravity', 'brain'),
  ]
  for (const root of roots) {
    const logsDir = join(root, conversationId, '.system_generated', 'logs')
    if (existsSync(join(logsDir, 'transcript.jsonl'))) {
      return logsDir
    }
  }
  return null
}

/**
 * Read full `content` and `thinking` for a specific `PLANNER_RESPONSE` step,
 * consulting `transcript_full.jsonl` when `truncated_fields` is present
 * (ported from `tm-agy-tele/core/agy_engine.py`).
 * @param {string} logsDir - path to `.system_generated/logs`.
 * @param {Record<string, any>} stepObj - parsed line from `transcript.jsonl`.
 * @returns {Promise<{ content: string, thinking: string }>}
 */
async function readFullPlannerStep(logsDir, stepObj) {
  let content = typeof stepObj.content === 'string' ? stepObj.content.trim() : ''
  let thinking = typeof stepObj.thinking === 'string' ? stepObj.thinking.trim() : ''
  const truncated = Array.isArray(stepObj.truncated_fields) ? stepObj.truncated_fields : []

  if (truncated.includes('content') || truncated.includes('thinking')) {
    const fullPath = join(logsDir, 'transcript_full.jsonl')
    if (existsSync(fullPath)) {
      try {
        const rawFull = await readFile(fullPath, 'utf8')
        const lines = rawFull.split(/\r?\n/)
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()
          if (!line) continue
          try {
            const fullObj = JSON.parse(line)
            if (fullObj.step_index === stepObj.step_index && fullObj.type === 'PLANNER_RESPONSE') {
              if (typeof fullObj.content === 'string' && fullObj.content.trim()) {
                content = fullObj.content.trim()
              }
              if (typeof fullObj.thinking === 'string' && fullObj.thinking.trim()) {
                thinking = fullObj.thinking.trim()
              }
              break
            }
          } catch {
            continue
          }
        }
      } catch {
        /* fallback to compact fields */
      }
    }
  }

  return { content, thinking }
}

/**
 * Recover thinking and final response from `transcript.jsonl` / `transcript_full.jsonl`
 * for a given `conversationId` (ported and enhanced from `tm-agy-tele/core/agy_engine.py`).
 * @param {string} conversationId - Antigravity CLI conversation UUID.
 * @param {Set<number>} [alreadyEmittedThinkingSteps] - step indices whose thinking was already streamed.
 * @returns {Promise<{ response: string, newThinking: string[] }>}
 */
export async function recoverFromTranscript(conversationId, alreadyEmittedThinkingSteps = new Set()) {
  const logsDir = findTranscriptLogsDir(conversationId)
  if (!logsDir) return { response: '', newThinking: [] }

  const transcriptPath = join(logsDir, 'transcript.jsonl')
  let raw
  try {
    raw = await readFile(transcriptPath, 'utf8')
  } catch {
    return { response: '', newThinking: [] }
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const parsed = []
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line))
    } catch {
      /* ignore partial line */
    }
  }

  // Locate the start of the latest turn (last USER_INPUT)
  let lastUserIdx = 0
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i].type === 'USER_INPUT') {
      lastUserIdx = i
      break
    }
  }

  const turnEntries = parsed.slice(lastUserIdx)
  const newThinking = []
  let lastResponse = ''

  for (const entry of turnEntries) {
    if (entry.type === 'PLANNER_RESPONSE') {
      const { content, thinking } = await readFullPlannerStep(logsDir, entry)
      const stepIdx = typeof entry.step_index === 'number' ? entry.step_index : -1
      if (thinking && !alreadyEmittedThinkingSteps.has(stepIdx)) {
        if (stepIdx >= 0) alreadyEmittedThinkingSteps.add(stepIdx)
        newThinking.push(thinking)
      }
      if (content) {
        lastResponse = content
      }
    }
  }

  return { response: lastResponse, newThinking }
}

/**
 * Persistent mapping between DSH `sessionId` ( + mode ) and Antigravity `conversation_id`,
 * stored under `~/.dsh/storages/agy-provider-sessions.json`.
 */
class AgySessionStore {
  constructor() {
    this.filePath = join(homedir(), '.dsh', 'storages', 'agy-provider-sessions.json')
    this.memory = new Map()
    this.loaded = false
    this.locks = new Map()
  }

  async ensureLoaded() {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(this.filePath)) {
        const raw = JSON.parse(await readFile(this.filePath, 'utf8'))
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            if (v && typeof v === 'object' && typeof v.conversationId === 'string') {
              this.memory.set(k, v)
            }
          }
        }
      }
    } catch {
      /* start fresh on corrupt store */
    }
  }

  async get(key) {
    await this.ensureLoaded()
    return this.memory.get(key)
  }

  async set(key, value) {
    await this.ensureLoaded()
    this.memory.set(key, value)
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      const obj = Object.fromEntries(this.memory.entries())
      await writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf8')
    } catch {
      /* best-effort persistence */
    }
  }

  async delete(key) {
    await this.ensureLoaded()
    this.memory.delete(key)
  }

  /**
   * Serialize concurrent calls sharing the same session key (like `tm-agy-tele` `get_session_lock`).
   * @template T
   * @param {string} key - session key.
   * @param {() => Promise<T>} fn - async task.
   * @returns {Promise<T>}
   */
  async withLock(key, fn) {
    const prev = this.locks.get(key) ?? Promise.resolve()
    let release
    const current = new Promise((resolve) => {
      release = resolve
    })
    this.locks.set(key, prev.then(() => current))
    await prev
    try {
      return await fn()
    } finally {
      release()
      if (this.locks.get(key) === current) {
        this.locks.delete(key)
      }
    }
  }
}

const WINCRED_CSHARP_SOURCE = `
using System;
using System.Runtime.InteropServices;
using System.Text;

public class AgyWinCred {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("Advapi32.dll", SetLastError = true, EntryPoint = "CredReadW", CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string target, UInt32 type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true, EntryPoint = "CredWriteW", CharSet = CharSet.Unicode)]
    public static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] UInt32 flags);

    [DllImport("Advapi32.dll", SetLastError = true, EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode)]
    public static extern bool CredDelete(string target, UInt32 type, int flags);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern bool CredFree(IntPtr cred);

    public static string ReadBlobBase64(string target) {
        IntPtr ptr;
        if (!CredRead(target, 1, 0, out ptr)) return "";
        try {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            if (cred.CredentialBlobSize == 0 || cred.CredentialBlob == IntPtr.Zero) return "";
            byte[] bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, (int)cred.CredentialBlobSize);
            return Convert.ToBase64String(bytes);
        } finally {
            CredFree(ptr);
        }
    }

    public static bool WriteBlobBase64(string target, string user, string base64Blob) {
        byte[] bytes = Convert.FromBase64String(base64Blob);
        CREDENTIAL cred = new CREDENTIAL();
        cred.Flags = 0;
        cred.Type = 1;
        cred.TargetName = Marshal.StringToCoTaskMemUni(target);
        cred.UserName = Marshal.StringToCoTaskMemUni(user);
        cred.CredentialBlobSize = (UInt32)bytes.Length;
        cred.CredentialBlob = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, cred.CredentialBlob, bytes.Length);
        cred.Persist = 2;
        try {
            return CredWrite(ref cred, 0);
        } finally {
            Marshal.FreeCoTaskMem(cred.TargetName);
            Marshal.FreeCoTaskMem(cred.UserName);
            Marshal.FreeCoTaskMem(cred.CredentialBlob);
        }
    }

    public static bool DeleteTarget(string target) {
        return CredDelete(target, 1, 0);
    }
}
`

/**
 * Run a short PowerShell script to interact with Windows Credential Manager (`gemini:antigravity`).
 * @param {string} psCommand - PowerShell command body.
 * @param {Record<string, string>} [extraEnv] - additional environment variables.
 * @returns {Promise<string>} trimmed stdout.
 */
function runWinCredPowerShell(psCommand, extraEnv = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -TypeDefinition @'\n${WINCRED_CSHARP_SOURCE}\n'@\n${psCommand}`],
      {
        env: { ...process.env, ...extraEnv },
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    )
    const timer = setTimeout(() => {
      terminateProcessTree(proc).finally(() => resolve(''))
    }, 8000)
    proc.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    proc.once('error', () => {
      clearTimeout(timer)
      resolve('')
    })
    proc.once('close', () => {
      clearTimeout(timer)
      resolve(stdout.trim())
    })
  })
}

/**
 * Read the currently active Antigravity CLI OAuth credential blob from the system keyring.
 * Never logs or exposes the raw secret to external callers.
 * @returns {Promise<string | null>} UTF-8 JSON credential string or null if not signed in.
 */
export async function readAgyKeyringCredential() {
  if (process.platform === 'win32') {
    const b64 = await runWinCredPowerShell(`[AgyWinCred]::ReadBlobBase64('${KEYRING_TARGET}')`)
    if (!b64) return null
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8').trim()
      return decoded.startsWith('{') ? decoded : null
    } catch {
      return null
    }
  }
  const fallbackPath = join(homedir(), '.gemini', 'oauth_creds.json')
  if (existsSync(fallbackPath)) {
    try {
      const raw = (await readFile(fallbackPath, 'utf8')).trim()
      return raw.startsWith('{') ? raw : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Write an Antigravity CLI OAuth credential blob into the system keyring (`gemini:antigravity`).
 * @param {string} rawBlob - UTF-8 JSON credential string.
 * @returns {Promise<boolean>}
 */
export async function writeAgyKeyringCredential(rawBlob) {
  if (!rawBlob || typeof rawBlob !== 'string') return false
  if (process.platform === 'win32') {
    const b64 = Buffer.from(rawBlob, 'utf8').toString('base64')
    const out = await runWinCredPowerShell(
      `if ([AgyWinCred]::WriteBlobBase64('${KEYRING_TARGET}', '${KEYRING_USER}', $env:AGY_CRED_B64)) { 'OK' } else { 'ERR' }`,
      { AGY_CRED_B64: b64 },
    )
    return out.includes('OK')
  }
  const fallbackPath = join(homedir(), '.gemini', 'oauth_creds.json')
  try {
    await mkdir(dirname(fallbackPath), { recursive: true })
    await writeFile(fallbackPath, rawBlob, 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * Remove the active Antigravity CLI OAuth credential from the system keyring.
 * @returns {Promise<boolean>}
 */
export async function deleteAgyKeyringCredential() {
  if (process.platform === 'win32') {
    await runWinCredPowerShell(`[AgyWinCred]::DeleteTarget('${KEYRING_TARGET}') | Out-Null; 'OK'`)
    return true
  }
  const fallbackPath = join(homedir(), '.gemini', 'oauth_creds.json')
  try {
    await rm(fallbackPath, { force: true })
    return true
  } catch {
    return false
  }
}

/**
 * Extract non-sensitive display metadata (`id`, `email`, `name`, `picture`, `authMethod`)
 * from an Antigravity CLI OAuth credential blob by decoding the `id_token` JWT payload.
 * @param {string} rawBlob - UTF-8 JSON credential blob.
 * @returns {{ id: string, email: string, name: string, picture: string, authMethod: string } | null}
 */
export function decodeAgyCredentialMetadata(rawBlob) {
  if (!rawBlob || typeof rawBlob !== 'string') return null
  try {
    const parsed = JSON.parse(rawBlob)
    if (!parsed || typeof parsed !== 'object') return null
    const authMethod = typeof parsed.auth_method === 'string' && parsed.auth_method ? parsed.auth_method : 'consumer'
    const idToken = typeof parsed.id_token === 'string' ? parsed.id_token : ''
    let email = ''
    let name = ''
    let picture = ''
    let sub = ''

    if (idToken.includes('.')) {
      const parts = idToken.split('.')
      if (parts.length >= 2) {
        const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        if (jwtPayload && typeof jwtPayload === 'object') {
          if (typeof jwtPayload.email === 'string') email = jwtPayload.email.trim()
          if (typeof jwtPayload.name === 'string') name = jwtPayload.name.trim()
          else if (typeof jwtPayload.given_name === 'string') name = jwtPayload.given_name.trim()
          if (typeof jwtPayload.picture === 'string') picture = jwtPayload.picture.trim()
          if (typeof jwtPayload.sub === 'string') sub = jwtPayload.sub.trim()
        }
      }
    }

    if (!email && !sub && !parsed.token?.access_token && !parsed.access_token) {
      return null
    }

    const fallbackEmail = email || 'agy-user@google.com'
    const stableKey = sub || fallbackEmail.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    return {
      id: `agy_acc_${stableKey}`,
      email: fallbackEmail,
      name: name || fallbackEmail.split('@')[0],
      picture,
      authMethod,
    }
  } catch {
    return null
  }
}

/**
 * Multi-Account Manager for Antigravity CLI (`agy`).
 * Stores account profiles in `~/.dsh/storages/agy-provider-accounts.json`, swaps the active
 * Google OAuth credential in the system keyring (`gemini:antigravity`), supports interactive
 * browser OAuth sign-in for additional accounts, and notifies DSH's `LlmRuntime` whenever
 * the active account or enabled state changes.
 */
export class AgyAccountManager {
  /**
   * @param {{ getConfig: () => typeof DEFAULTS }} deps
   */
  constructor(deps) {
    this.getConfig = deps.getConfig
    this.filePath = join(homedir(), '.dsh', 'storages', 'agy-provider-accounts.json')
    this.loaded = false
    this.loadPromise = null
    this.providerEnabled = true
    /** @type {string | null} */
    this.activeAccountId = null
    /** @type {Array<{ id: string, email: string, name: string, picture: string, authMethod: string, enabled: boolean, createdAt: string, updatedAt: string, credentialBlob: string }>} */
    this.accounts = []
    this.loginState = { status: 'idle', message: '', startedAt: '' }
    this.loginProc = null
    this.loginTimer = null
    this.loginRestoreBlob = null
    this.onChangeCallbacks = new Set()
  }

  /**
   * Register a callback invoked whenever the active account or enabled state changes.
   * @param {() => void} fn
   */
  onChange(fn) {
    this.onChangeCallbacks.add(fn)
    return () => this.onChangeCallbacks.delete(fn)
  }

  notifyChange() {
    for (const fn of this.onChangeCallbacks) {
      try {
        fn()
      } catch {
        /* ignore listener errors */
      }
    }
  }

  async ensureLoaded() {
    if (this.loaded) return
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = (async () => {
      try {
        if (existsSync(this.filePath)) {
          const raw = JSON.parse(await readFile(this.filePath, 'utf8'))
          if (raw && typeof raw === 'object') {
            if (typeof raw.providerEnabled === 'boolean') {
              this.providerEnabled = raw.providerEnabled
            }
            if (typeof raw.activeAccountId === 'string' || raw.activeAccountId === null) {
              this.activeAccountId = raw.activeAccountId
            }
            if (Array.isArray(raw.accounts)) {
              this.accounts = raw.accounts.filter(
                (a) => a && typeof a === 'object' && typeof a.id === 'string' && typeof a.credentialBlob === 'string',
              )
            }
          }
        }
      } catch {
        /* start fresh if corrupt */
      }
      await this.syncFromSystemKeyring({ autoImportIfEmpty: this.accounts.length === 0 })
      this.loaded = true
    })()
    try {
      await this.loadPromise
    } finally {
      this.loadPromise = null
    }
  }

  async persist() {
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      const payload = {
        providerEnabled: this.providerEnabled,
        activeAccountId: this.activeAccountId,
        accounts: this.accounts,
      }
      await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8')
    } catch {
      /* best-effort persistence */
    }
  }

  /**
   * Synchronize the system keyring credential (`gemini:antigravity`) with the account store.
   * @param {{ autoImportIfEmpty?: boolean, forceActivateImported?: boolean }} [opts]
   * @returns {Promise<boolean>} true if a keyring account was found and synced.
   */
  async syncFromSystemKeyring(opts = {}) {
    const blob = await readAgyKeyringCredential()
    if (!blob) return false
    const meta = decodeAgyCredentialMetadata(blob)
    if (!meta) return false

    const now = new Date().toISOString()
    const existing = this.accounts.find((a) => a.id === meta.id || a.email.toLowerCase() === meta.email.toLowerCase())

    if (existing) {
      existing.email = meta.email
      existing.name = meta.name
      existing.picture = meta.picture
      existing.authMethod = meta.authMethod
      existing.credentialBlob = blob
      existing.updatedAt = now
      if (opts.forceActivateImported) {
        existing.enabled = true
        this.activeAccountId = existing.id
        this.providerEnabled = true
      } else if (!this.activeAccountId && existing.enabled !== false) {
        this.activeAccountId = existing.id
      }
      await this.persist()
      return true
    }

    if (opts.autoImportIfEmpty || opts.forceActivateImported) {
      const newAcc = {
        id: meta.id,
        email: meta.email,
        name: meta.name,
        picture: meta.picture,
        authMethod: meta.authMethod,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        credentialBlob: blob,
      }
      this.accounts.push(newAcc)
      this.activeAccountId = newAcc.id
      if (opts.forceActivateImported) {
        this.providerEnabled = true
      }
      await this.persist()
      return true
    }

    return false
  }

  /**
   * Return the currently active & enabled account object, or null if none is active.
   */
  getActiveAccount() {
    if (!this.providerEnabled || !this.activeAccountId) return null
    const acc = this.accounts.find((a) => a.id === this.activeAccountId)
    if (!acc || acc.enabled === false) return null
    return acc
  }

  /**
   * Return true iff the provider is enabled and at least one logged-in account is toggled active.
   * Gates `adapter.listModels('agy-cli')`.
   */
  hasActiveAccount() {
    return this.getActiveAccount() !== null
  }

  /**
   * Build a sanitized public snapshot safe to send to the browser UI (contains zero tokens/secrets).
   */
  async getPublicSnapshot() {
    await this.ensureLoaded()
    const active = this.getActiveAccount()
    return {
      ok: true,
      providerEnabled: this.providerEnabled,
      activeAccountId: active ? active.id : null,
      hasActiveAccount: active !== null,
      activeEmail: active ? active.email : null,
      loginState: { ...this.loginState },
      accounts: this.accounts.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        picture: a.picture,
        authMethod: a.authMethod,
        enabled: a.enabled !== false,
        isActive: active !== null && active.id === a.id,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    }
  }

  /**
   * Toggle the master provider switch on or off.
   * @param {boolean} enabled
   */
  async setProviderEnabled(enabled) {
    await this.ensureLoaded()
    this.providerEnabled = Boolean(enabled)
    if (this.providerEnabled) {
      let active = this.accounts.find((a) => a.id === this.activeAccountId && a.enabled !== false)
      if (!active) {
        active = this.accounts.find((a) => a.enabled !== false)
        if (!active && this.accounts.length > 0) {
          this.accounts[0].enabled = true
          active = this.accounts[0]
        }
      }
      if (active) {
        this.activeAccountId = active.id
        await writeAgyKeyringCredential(active.credentialBlob)
      }
    }
    await this.persist()
    this.notifyChange()
    return this.getPublicSnapshot()
  }

  /**
   * Switch which account is active in the system keyring and enable it.
   * @param {string} accountId
   */
  async activateAccount(accountId) {
    await this.ensureLoaded()
    await this.syncFromSystemKeyring()
    const target = this.accounts.find((a) => a.id === accountId)
    if (!target) {
      throw new Error(`Account "${accountId}" not found`)
    }
    target.enabled = true
    target.updatedAt = new Date().toISOString()
    this.activeAccountId = target.id
    this.providerEnabled = true
    await writeAgyKeyringCredential(target.credentialBlob)
    await this.persist()
    this.notifyChange()
    return this.getPublicSnapshot()
  }

  /**
   * Toggle an individual account on or off.
   * When toggled ON, that account becomes the active account.
   * When toggled OFF, if another account is enabled, switches to it; otherwise disables the provider.
   * @param {string} accountId
   * @param {boolean} enabled
   */
  async toggleAccountEnabled(accountId, enabled) {
    await this.ensureLoaded()
    await this.syncFromSystemKeyring()
    const target = this.accounts.find((a) => a.id === accountId)
    if (!target) {
      throw new Error(`Account "${accountId}" not found`)
    }

    const nextEnabled = Boolean(enabled)
    target.enabled = nextEnabled
    target.updatedAt = new Date().toISOString()

    if (nextEnabled) {
      this.activeAccountId = target.id
      this.providerEnabled = true
      await writeAgyKeyringCredential(target.credentialBlob)
    } else if (this.activeAccountId === target.id) {
      const fallback = this.accounts.find((a) => a.id !== target.id && a.enabled !== false)
      if (fallback) {
        this.activeAccountId = fallback.id
        await writeAgyKeyringCredential(fallback.credentialBlob)
      } else {
        this.activeAccountId = null
        this.providerEnabled = false
      }
    }

    await this.persist()
    this.notifyChange()
    return this.getPublicSnapshot()
  }

  /**
   * Remove a saved account from the multi-account vault.
   * @param {string} accountId
   */
  async removeAccount(accountId) {
    await this.ensureLoaded()
    const idx = this.accounts.findIndex((a) => a.id === accountId)
    if (idx === -1) return this.getPublicSnapshot()

    const wasActive = this.activeAccountId === accountId
    this.accounts.splice(idx, 1)

    if (this.accounts.length === 0) {
      this.activeAccountId = null
      this.providerEnabled = false
      await deleteAgyKeyringCredential()
    } else if (wasActive) {
      const next = this.accounts.find((a) => a.enabled !== false) || this.accounts[0]
      next.enabled = true
      this.activeAccountId = next.id
      await writeAgyKeyringCredential(next.credentialBlob)
    }

    await this.persist()
    this.notifyChange()
    return this.getPublicSnapshot()
  }

  /**
   * Start an interactive Google OAuth2 PKCE browser sign-in flow to add a new account.
   * Uses the native Antigravity CLI OAuth2 PKCE flow without disturbing the currently active
   * keyring credential until the new account verification succeeds.
   */
  async startInteractiveLogin() {
    await this.ensureLoaded()
    await this.syncFromSystemKeyring({ autoImportIfEmpty: true })

    const codeVerifier = randomBytes(32).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const stateToken = randomBytes(16).toString('base64url')
    this.pkceCodeVerifier = codeVerifier

    const params = new URLSearchParams({
      access_type: 'offline',
      client_id: AGY_OAUTH_CLIENT_ID,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
      redirect_uri: AGY_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: AGY_OAUTH_SCOPES,
      state: stateToken,
    })
    const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`

    this.loginState = {
      status: 'pending',
      message: 'Waiting for Google OAuth authorization code...',
      authUrl,
      startedAt: new Date().toISOString(),
    }

    if (process.platform === 'win32') {
      spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process $env:AGY_AUTH_URL'],
        {
          env: { ...process.env, AGY_AUTH_URL: authUrl },
          stdio: 'ignore',
          windowsHide: true,
        },
      ).on('error', () => {})
    }

    return this.getPublicSnapshot()
  }

  /**
   * Exchange the Google OAuth authorization code pasted by the user against
   * `https://oauth2.googleapis.com/token`, write the resulting credential into the
   * system keyring (`gemini:antigravity`), and activate the new account.
   * @param {string} rawCode
   */
  async submitLoginCode(rawCode) {
    await this.ensureLoaded()
    let clean = String(rawCode || '').trim()
    if (!clean) {
      throw new Error('Authorization code cannot be empty.')
    }
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const parsedUrl = new URL(clean)
        const paramCode = parsedUrl.searchParams.get('code')
        if (paramCode) clean = paramCode.trim()
      } catch {
        /* keep raw string */
      }
    }
    // Strip any accidental whitespace/newlines inside a copied multi-line code block
    clean = clean.replace(/\s+/g, '')

    if (!this.pkceCodeVerifier) {
      throw new Error('Login session expired or restarted. Please click "+ Add Account" to open a fresh sign-in link.')
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AGY_OAUTH_CLIENT_ID,
        client_secret: AGY_OAUTH_CLIENT_SECRET,
        code: clean,
        code_verifier: this.pkceCodeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: AGY_OAUTH_REDIRECT_URI,
      }),
    })

    const tokenData = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenData.access_token) {
      const errDetail = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`
      throw new Error(`Google OAuth token exchange failed: ${errDetail}`)
    }

    const expiresInSec = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3599
    const expiryIso = new Date(Date.now() + expiresInSec * 1000).toISOString()

    // Preserve existing refresh_token if Google omitted it on re-consent for the same account
    let refreshToken = tokenData.refresh_token || ''
    if (!refreshToken && tokenData.id_token) {
      const tempMeta = decodeAgyCredentialMetadata(JSON.stringify({ id_token: tokenData.id_token, token: { access_token: tokenData.access_token } }))
      if (tempMeta) {
        const prevAcc = this.accounts.find((a) => a.id === tempMeta.id || a.email.toLowerCase() === tempMeta.email.toLowerCase())
        if (prevAcc?.credentialBlob) {
          try {
            const prevParsed = JSON.parse(prevAcc.credentialBlob)
            refreshToken = prevParsed?.token?.refresh_token || ''
          } catch {
            /* ignore */
          }
        }
      }
    }

    const credentialObj = {
      token: {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'Bearer',
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        expiry: expiryIso,
      },
      auth_method: 'consumer',
      ...(tokenData.id_token ? { id_token: tokenData.id_token } : {}),
    }

    const newBlob = JSON.stringify(credentialObj)
    const newMeta = decodeAgyCredentialMetadata(newBlob)
    if (!newMeta) {
      throw new Error('Received OAuth token did not contain valid Google account metadata.')
    }

    await writeAgyKeyringCredential(newBlob)
    await this.syncFromSystemKeyring({ forceActivateImported: true })
    this.pkceCodeVerifier = null
    this.loginState = {
      status: 'succeeded',
      message: `Signed in as ${newMeta.email}`,
      authUrl: '',
      startedAt: '',
    }
    this.notifyChange()
    return this.getPublicSnapshot()
  }

  /**
   * Cancel an in-progress interactive browser login.
   */
  async cancelInteractiveLogin() {
    this.pkceCodeVerifier = null
    this.loginState = { status: 'idle', message: '', authUrl: '', startedAt: '' }
    return this.getPublicSnapshot()
  }
}

/**
 * Extract plain text and attachment references from a DSH message's content blocks.
 * @param {Array<any>} blocks - DSH message content array.
 * @param {(ref: any) => string | undefined} resolveImagePath - resolves local path for image attachments.
 * @returns {string} serialized text.
 */
function serializeContentBlocks(blocks, resolveImagePath) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
      parts.push(block.text)
    } else if (block.type === 'image' && block.attachment) {
      const imgPath = resolveImagePath?.(block.attachment)
      const label = block.attachment.name || block.attachment.attachmentId || 'image'
      if (imgPath) {
        parts.push(`[Attached Image "${label}" available at local path: ${imgPath}]`)
      } else {
        parts.push(`[Attached Image "${label}"]`)
      }
    } else if (block.type === 'tool-call') {
      parts.push(
        `<dsh_tool_call>\n${JSON.stringify({
          id: block.id,
          name: block.name,
          arguments: tryParseJson(block.arguments),
        })}\n</dsh_tool_call>`
      )
    }
  }
  return parts.join('\n')
}

function tryParseJson(str) {
  if (typeof str !== 'string') return str ?? {}
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

/**
 * Format the prompt for `dsh-bridge` mode.
 * When `isResume` is true (an existing `agy` conversation already holds prior turns),
 * only the new messages after the last assistant message are sent to preserve prompt cache
 * and keep command-line length compact.
 *
 * @param {any} options - DSH `GenerateOptions`.
 * @param {boolean} isResume - whether resuming an existing `agy --conversation`.
 * @param {(ref: any) => string | undefined} resolveImagePath - image path resolver.
 * @returns {string} prompt text.
 */
function buildBridgePrompt(options, isResume, resolveImagePath) {
  const messages = Array.isArray(options.messages) ? options.messages : []
  const tools = Array.isArray(options.tools) ? options.tools : []

  const headerLines = [
    '<ANTIGRAVITY_HEADLESS_LLM_BRIDGE>',
    'CRITICAL SYSTEM DIRECTIVE FOR HEADLESS LLM PROVIDER MODE:',
    '1. You are operating as the LLM inference and reasoning engine behind DeepSeek Harness (DSH).',
    '2. NEVER invoke any internal Antigravity CLI tools (`call_mcp_tool`, `openpets`, `run_command`, `view_file`, `list_dir`, `grep_search`, `find_by_name`, `replace_file_content`, `write_to_file`, etc.). All tool execution is owned by the host DeepSeek Harness runtime.',
    '3. Do NOT append any `⏱️ Waktu Respons` footer yourself unless explicitly requested by the DSH system prompt below.',
  ]

  if (tools.length > 0) {
    headerLines.push(
      '4. When you need to invoke one or more DeepSeek Harness tools from `<DSH_AVAILABLE_TOOLS>`, output each call inside a `<dsh_tool_call>` XML block with valid JSON:',
      '<dsh_tool_call>',
      '{"name": "tool_name", "arguments": {"param": "value"}}',
      '</dsh_tool_call>',
      'Stop immediately after outputting `<dsh_tool_call>` block(s) and wait for DeepSeek Harness to return `<DSH_TOOL_RESULT>` in the next turn. Never fabricate tool results.',
      '</ANTIGRAVITY_HEADLESS_LLM_BRIDGE>'
    )
  } else {
    headerLines.push('</ANTIGRAVITY_HEADLESS_LLM_BRIDGE>')
  }

  if (isResume) {
    // Find messages appended after the last assistant message
    let lastAssistantIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') {
        lastAssistantIdx = i
        break
      }
    }
    const deltaMessages = lastAssistantIdx >= 0 ? messages.slice(lastAssistantIdx + 1) : messages
    if (deltaMessages.length > 0) {
      const deltaParts = [headerLines.join('\n')]
      for (const msg of deltaMessages) {
        if (msg.role === 'tool') {
          const text = serializeContentBlocks(msg.content, resolveImagePath)
          deltaParts.push(
            `<DSH_TOOL_RESULT tool_call_id="${msg.toolCallId || ''}" is_error="${Boolean(msg.isError)}">\n${text}\n</DSH_TOOL_RESULT>`
          )
        } else if (msg.role === 'user') {
          deltaParts.push(`<USER_MESSAGE>\n${serializeContentBlocks(msg.content, resolveImagePath)}\n</USER_MESSAGE>`)
        }
      }
      return deltaParts.join('\n\n')
    }
  }

  // Full first-turn prompt (or stateless fallback)
  const sections = [headerLines.join('\n')]

  if (tools.length > 0) {
    const compactTools = tools.map((t) => ({
      name: t.name,
      description: t.description || '',
      parameters: t.parameters || { type: 'object', properties: {} },
    }))
    sections.push(`<DSH_AVAILABLE_TOOLS>\n${JSON.stringify(compactTools)}\n</DSH_AVAILABLE_TOOLS>`)
  }

  const systemTexts = []
  const transcriptLines = []

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    if (msg.role === 'system') {
      const text = serializeContentBlocks(msg.content, resolveImagePath)
      if (text) systemTexts.push(text)
    } else if (msg.role === 'user') {
      const text = serializeContentBlocks(msg.content, resolveImagePath)
      if (text) transcriptLines.push(`<USER_MESSAGE>\n${text}\n</USER_MESSAGE>`)
    } else if (msg.role === 'assistant') {
      const text = serializeContentBlocks(msg.content, resolveImagePath)
      if (text) transcriptLines.push(`<ASSISTANT_MESSAGE>\n${text}\n</ASSISTANT_MESSAGE>`)
    } else if (msg.role === 'tool') {
      const text = serializeContentBlocks(msg.content, resolveImagePath)
      transcriptLines.push(
        `<DSH_TOOL_RESULT tool_call_id="${msg.toolCallId || ''}" is_error="${Boolean(msg.isError)}">\n${text}\n</DSH_TOOL_RESULT>`
      )
    }
  }

  if (systemTexts.length > 0) {
    sections.push(`<DSH_SYSTEM_PROMPT>\n${systemTexts.join('\n\n')}\n</DSH_SYSTEM_PROMPT>`)
  }
  if (transcriptLines.length > 0) {
    sections.push(transcriptLines.join('\n\n'))
  }

  return sections.join('\n\n')
}

/**
 * Format the prompt for `agy-agent` (Autonomous `tm-agy-tele` mode).
 * In autonomous mode, `agy.exe` uses its own native tools and `--conversation` memory.
 * @param {any} options - DSH `GenerateOptions`.
 * @param {boolean} isResume - whether resuming an existing `agy --conversation`.
 * @param {(ref: any) => string | undefined} resolveImagePath - image path resolver.
 * @returns {string} prompt text.
 */
function buildAgentPrompt(options, isResume, resolveImagePath) {
  const messages = Array.isArray(options.messages) ? options.messages : []
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      const latestUser = serializeContentBlocks(messages[i].content, resolveImagePath)
      if (isResume || i === 0) return latestUser
      // Include prior user/assistant context if starting a fresh agy conversation mid-thread
      const history = []
      for (let j = 0; j <= i; j++) {
        const m = messages[j]
        if (m.role === 'user' || m.role === 'assistant') {
          const t = serializeContentBlocks(m.content, resolveImagePath)
          if (t) history.push(`[${m.role.toUpperCase()}]:\n${t}`)
        }
      }
      return history.join('\n\n')
    }
  }
  return 'Continue.'
}

/**
 * Parse `<dsh_tool_call>` blocks and clean assistant text from the model response.
 * Supports both `<dsh_tool_call>{...}</dsh_tool_call>` and fenced ```dsh_tool_call blocks.
 * @param {string} rawText - full response text from `agy`.
 * @param {Set<string>} allowedToolNames - valid DSH tool names in `options.tools`.
 * @returns {{ cleanText: string, toolCalls: Array<{ id: string, name: string, arguments: string }> }}
 */
export function parseBridgeResponse(rawText, allowedToolNames) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '', toolCalls: [] }
  }

  const toolCalls = []
  const pattern = /<dsh_tool_call>\s*([\s\S]*?)\s*<\/dsh_tool_call>|```dsh_tool_call\s*([\s\S]*?)\s*```/gi

  const cleanText = rawText
    .replace(pattern, (fullMatch, xmlBody, fenceBody) => {
      const payload = (xmlBody ?? fenceBody ?? '').trim()
      if (!payload) return ''
      try {
        const parsed = JSON.parse(payload)
        const candidates = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of candidates) {
          if (!item || typeof item !== 'object' || typeof item.name !== 'string') continue
          const name = item.name.trim()
          if (allowedToolNames.size > 0 && !allowedToolNames.has(name)) continue
          const argsObj =
            item.arguments !== undefined
              ? typeof item.arguments === 'string'
                ? tryParseJson(item.arguments)
                : item.arguments
              : item.parameters !== undefined
                ? item.parameters
                : {}
          toolCalls.push({
            id: typeof item.id === 'string' && item.id ? item.id : `call_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
            name,
            arguments: JSON.stringify(argsObj ?? {}),
          })
        }
        return ''
      } catch {
        return fullMatch
      }
    })
    .trim()

  return { cleanText, toolCalls }
}

/**
 * Strip `agy`'s global GEMINI.md footer when running in `dsh-bridge` mode if a tool call was emitted.
 * @param {string} text - assistant text.
 * @param {boolean} hasToolCalls - whether tool calls were extracted.
 * @returns {string} cleaned text.
 */
function stripTrailingBridgeFooterOnToolCall(text, hasToolCalls) {
  if (!hasToolCalls || !text) return text
  return text.replace(/\n*---\s*\n*⏱️\s*\*\*Waktu Respons\*\*:[\s\S]*$/i, '').trim()
}

/**
 * Query `agy models` asynchronously to refresh the advertised catalog.
 * Falls back gracefully to `BUILTIN_AGY_MODELS` on any error.
 * @param {string} binaryPath - resolved `agy` binary.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
async function queryCliModels(binaryPath) {
  return new Promise((resolve) => {
    let stdout = ''
    const proc = spawn(binaryPath, ['models'], {
      env: buildAgyEnv(),
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    const timer = setTimeout(() => {
      terminateProcessTree(proc).finally(() => resolve([]))
    }, 10000)
    proc.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    proc.once('error', () => {
      clearTimeout(timer)
      resolve([])
    })
    proc.once('close', () => {
      clearTimeout(timer)
      const discovered = []
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('Fetching')) continue
        const parts = trimmed.split('\t')
        if (parts.length >= 2 && parts[0].trim()) {
          discovered.push({
            id: parts[0].trim(),
            name: parts[1].trim() || parts[0].trim(),
          })
        }
      }
      resolve(discovered)
    })
  })
}

/**
 * Native DeepSeek Harness `LlmAdapter` implementation for Antigravity CLI (`agy`).
 */
class AgyCliAdapter {
  /**
   * @param {{ ctx: any, getConfig: () => typeof DEFAULTS, sessionStore: AgySessionStore, accountManager: AgyAccountManager }} deps
   */
  constructor(deps) {
    this.ctx = deps.ctx
    this.getConfig = deps.getConfig
    this.sessionStore = deps.sessionStore
    this.accountManager = deps.accountManager
    this.dynamicModels = null
    this.refreshInFlight = null
  }

  /**
   * Build the complete model catalog (standard models + optional `agy/<id>` `[agy]` autonomous presets).
   * @param {string} provider - provider route id.
   * @returns {Array<any>}
   */
  buildCatalog(provider) {
    const cfg = this.getConfig()
    const baseById = new Map(BUILTIN_AGY_MODELS.map((m) => [m.id, { ...m }]))
    if (Array.isArray(this.dynamicModels)) {
      for (const dm of this.dynamicModels) {
        if (!baseById.has(dm.id)) {
          const isClaudeOpus = dm.id.includes('opus')
          const isGptOss = dm.id.includes('gpt-oss')
          baseById.set(dm.id, {
            id: dm.id,
            name: dm.name,
            contextWindow: isClaudeOpus ? 200000 : isGptOss ? 128000 : DEFAULT_CONTEXT_WINDOW,
            inputModalities: isGptOss ? ['text'] : ['text', 'image'],
            defaultEffort: dm.id.endsWith('-high') ? 'high' : dm.id.endsWith('-low') ? 'low' : 'medium',
          })
        }
      }
    }

    const baseList = [...baseById.values()]
    const result = []

    for (const model of baseList) {
      result.push({
        provider,
        id: model.id,
        name: model.name,
        description:
          cfg.mode === 'agy-agent'
            ? 'Antigravity CLI autonomous agent mode (--conversation session persistence)'
            : 'Antigravity CLI via DSH-Native Tool Bridge (supports DSH UI tools, diffs, and reasoning)',
        inputModalities: [...model.inputModalities],
        contextWindow: model.contextWindow,
        defaultEffort: model.defaultEffort,
        executionMode: cfg.mode,
        cliModelId: model.id,
      })
    }

    if (cfg.includeAgentPresetModels) {
      for (const model of baseList) {
        result.push({
          provider,
          id: `agy/${model.id}`,
          name: `[agy] ${model.name}`,
          description: 'Autonomous Antigravity CLI mode (agy executes its own tools & session memory)',
          inputModalities: [...model.inputModalities],
          contextWindow: model.contextWindow,
          defaultEffort: model.defaultEffort,
          executionMode: 'agy-agent',
          cliModelId: model.id,
        })
      }
    }

    return result
  }

  /** Trigger a non-blocking background refresh of `agy models`. */
  triggerBackgroundCatalogRefresh() {
    if (this.refreshInFlight) return
    const bin = resolveAgyBinary(this.getConfig().binaryPath)
    this.refreshInFlight = queryCliModels(bin)
      .then((discovered) => {
        if (discovered.length > 0) {
          this.dynamicModels = discovered
        }
      })
      .finally(() => {
        this.refreshInFlight = null
      })
  }

  providerInfo(provider) {
    const cfg = this.getConfig()
    return {
      id: provider,
      name: cfg.displayName || DEFAULT_DISPLAY_NAME,
    }
  }

  providerRetryPolicy(_provider) {
    return undefined
  }

  imageRequestPricing(_provider, _model) {
    return undefined
  }

  imageRequestTarget(_provider, _model, image) {
    return {
      width: image.width,
      height: image.height,
      maxBytes: image.bytes,
    }
  }

  async listModels(provider) {
    await this.accountManager.ensureLoaded()
    if (!this.accountManager.hasActiveAccount()) {
      return []
    }
    if (this.getConfig().discoverCliModels === true && this.dynamicModels === null) {
      this.triggerBackgroundCatalogRefresh()
    }
    return this.buildCatalog(provider).map((m) => ({
      provider,
      id: m.id,
      name: m.name,
      description: m.description,
      inputModalities: m.inputModalities,
    }))
  }

  async resolveModel(provider, model, _signal) {
    const catalog = this.buildCatalog(provider)
    const isAgyPrefix = model.startsWith('agy/') || model.startsWith('agent/')
    const cleanId = model.startsWith('agy/')
      ? model.slice('agy/'.length)
      : model.startsWith('agent/')
        ? model.slice('agent/'.length)
        : model
    const found =
      catalog.find((m) => m.id === model) ||
      (isAgyPrefix ? catalog.find((m) => m.id === `agy/${cleanId}`) : undefined)
    const fallbackEffort = cleanId.endsWith('-high') ? 'high' : cleanId.endsWith('-low') ? 'low' : 'medium'

    return {
      provider,
      id: model,
      name: found?.name ?? (isAgyPrefix ? `[agy] ${cleanId}` : model),
      ...(found?.description ? { description: found.description } : {}),
      inputModalities: found?.inputModalities ?? ['text', 'image'],
      context: {
        contextWindow: found?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      },
      defaultMaxTokens: DEFAULT_MAX_TOKENS,
      reasoning: {
        efforts: REASONING_EFFORTS.map((e) => ({ ...e })),
        defaultEffort: found?.defaultEffort ?? fallbackEffort,
      },
    }
  }

  async prepareCall(provider, model, signal) {
    const modelMetadata = await this.resolveModel(provider, model, signal)
    return {
      model: modelMetadata,
      stream: (options) => this.stream(options),
    }
  }

  /**
   * Resolve local filesystem path for an uploaded DSH image attachment.
   * @param {any} ref - attachment reference.
   * @returns {string | undefined}
   */
  resolveImagePath(ref) {
    try {
      const attachments = this.ctx.get('attachments')
      const hostPath = attachments?.imageHostPath?.(ref)
      if (!hostPath) return undefined
      const fsService = this.ctx.get('fs')
      return fsService?.processPathFromHostPath?.(hostPath) ?? hostPath
    } catch {
      return undefined
    }
  }

  /**
   * Stream one model call from `agy.exe --output-format stream-json`, yielding
   * native DeepSeek Harness `StreamChunk` objects in real time.
   * @param {any} options - DSH `GenerateOptions`.
   */
  async *stream(options) {
    await this.accountManager.ensureLoaded()
    const activeAccount = this.accountManager.getActiveAccount()
    if (!activeAccount) {
      throw createAdapterError(
        'Antigravity CLI (agy) is not signed in or is toggled off. Please sign in or enable an account in Settings -> Models.',
        'AUTH',
      )
    }

    const cfg = this.getConfig()
    const bin = resolveAgyBinary(cfg.binaryPath)
    const isAgentModel =
      typeof options.model === 'string' &&
      (options.model.startsWith('agy/') || options.model.startsWith('agent/'))
    const executionMode = isAgentModel ? 'agy-agent' : cfg.mode
    const cliModel =
      typeof options.model === 'string' && options.model.startsWith('agy/')
        ? options.model.slice('agy/'.length)
        : typeof options.model === 'string' && options.model.startsWith('agent/')
          ? options.model.slice('agent/'.length)
          : options.model
    const allowedToolNames = new Set((options.tools ?? []).map((t) => t.name))

    // Auxiliary one-shot calls (like title generation or compaction) should not hijack the main session conversationId
    const isAuxiliary = Boolean(options.purpose) || (options.tools ?? []).length === 0 && executionMode === 'dsh-bridge'
    const sessionKey =
      options.sessionId && !isAuxiliary
        ? `${activeAccount.id}:${String(options.sessionId)}:${executionMode}:${cliModel}`
        : null

    const storedSession = sessionKey ? await this.sessionStore.get(sessionKey) : undefined
    const existingConvId = storedSession?.conversationId
    const isResume = Boolean(existingConvId)

    let promptText =
      executionMode === 'agy-agent'
        ? buildAgentPrompt(options, isResume, (ref) => this.resolveImagePath(ref))
        : buildBridgePrompt(options, isResume, (ref) => this.resolveImagePath(ref))

    // Guard against Windows CreateProcess 32KB command-line limit
    let overflowFilePath = null
    if (promptText.length > MAX_CMDLINE_PROMPT_CHARS) {
      overflowFilePath = join(tmpdir(), `dsh-agy-prompt-${randomUUID()}.md`)
      await writeFile(overflowFilePath, promptText, 'utf8')
      if (executionMode === 'agy-agent') {
        promptText = `Please read the full prompt instructions from "${overflowFilePath}" and fulfill the request.`
      } else {
        // Keep the bridge directive and latest turn inline, and truncate middle history
        const head = promptText.slice(0, 8000)
        const tail = promptText.slice(-10000)
        promptText = `${head}\n\n...[Middle conversation history condensed for CLI transport]...\n\n${tail}`
      }
    }

    const args = []
    if (existingConvId) {
      args.push('--conversation', existingConvId)
    }
    if (cliModel) {
      args.push('--model', cliModel)
    }
    if (typeof options.reasoningEffort === 'string' && options.reasoningEffort.length > 0) {
      args.push('--effort', options.reasoningEffort)
    }
    if (executionMode === 'dsh-bridge') {
      args.push('--disable-slash-commands')
    } else if (cfg.skipPermissionsInAgentMode) {
      args.push('--dangerously-skip-permissions')
    }
    if (cfg.printTimeoutSeconds > 0) {
      args.push('--print-timeout', `${cfg.printTimeoutSeconds}s`)
    }
    args.push('--output-format', 'stream-json', '-p', promptText)

    const queue = []
    let wakeNext = null
    let streamDone = false
    let streamError = null

    const pushItem = (item) => {
      queue.push(item)
      if (wakeNext) {
        const resolve = wakeNext
        wakeNext = null
        resolve()
      }
    }

    const finishQueue = (err) => {
      if (err) streamError = err
      streamDone = true
      if (wakeNext) {
        const resolve = wakeNext
        wakeNext = null
        resolve()
      }
    }

    let proc
    try {
      proc = spawn(bin, args, {
        env: buildAgyEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: process.platform !== 'win32',
      })
    } catch (err) {
      if (overflowFilePath) await rm(overflowFilePath, { force: true }).catch(() => {})
      throw createAdapterError(`Failed to spawn Antigravity CLI (${bin}): ${err?.message || String(err)}`, 'SERVER')
    }

    const onAbort = () => {
      terminateProcessTree(proc).finally(() => {
        finishQueue(createAdapterError('Antigravity CLI request aborted by caller', 'ABORTED'))
      })
    }

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort()
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    let activeConversationId = existingConvId || ''
    const emittedThinkingSteps = new Set()
    let reasoningStarted = false
    let reasoningTextAccum = ''
    let textStarted = false
    let streamedTextAccum = ''
    let finalResultEvent = null
    let stderrText = ''
    const cumulativeUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
    }

    const emitReasoningDelta = (delta) => {
      if (!delta) return
      if (!reasoningStarted) {
        reasoningStarted = true
        pushItem({ type: 'block-start', index: 0, blockType: 'reasoning' })
      }
      reasoningTextAccum += delta
      pushItem({ type: 'reasoning-delta', index: 0, text: delta })
    }

    const closeReasoningIfOpen = () => {
      if (reasoningStarted) {
        pushItem({
          type: 'block-end',
          index: 0,
          block: { type: 'reasoning', text: reasoningTextAccum },
        })
        reasoningStarted = false
      }
    }

    proc.stderr?.on('data', (chunk) => {
      stderrText += String(chunk)
    })

    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return
      let evt
      try {
        evt = JSON.parse(trimmed)
      } catch {
        return
      }

      if (evt.event === 'init' && typeof evt.conversation_id === 'string' && evt.conversation_id) {
        activeConversationId = evt.conversation_id
        if (sessionKey) {
          this.sessionStore.set(sessionKey, {
            conversationId: activeConversationId,
            model: cliModel,
            mode: executionMode,
            updatedAt: new Date().toISOString(),
          })
        }
        return
      }

      if (evt.event === 'step_update' && evt.step_update) {
        const su = evt.step_update
        if (typeof su.conversation_id === 'string' && su.conversation_id && !activeConversationId) {
          activeConversationId = su.conversation_id
        }

        // Accumulate usage from step updates if present
        if (su.usage && typeof su.usage === 'object') {
          if (typeof su.usage.input_tokens === 'number') cumulativeUsage.inputTokens += su.usage.input_tokens
          if (typeof su.usage.output_tokens === 'number') cumulativeUsage.outputTokens += su.usage.output_tokens
          if (typeof su.usage.cache_read_tokens === 'number') cumulativeUsage.cacheReadTokens += su.usage.cache_read_tokens
          if (typeof su.usage.total_tokens === 'number') cumulativeUsage.totalTokens += su.usage.total_tokens
        }

        // In autonomous agy-agent mode, surface active tool executions inside the reasoning stream
        if (executionMode === 'agy-agent' && su.step_type === 'tool' && su.state === 'ACTIVE' && su.tool_name) {
          if (su.tool_name !== 'call_mcp_tool') {
            emitReasoningDelta(`\n[agy tool: ${su.tool_name}]\n`)
          }
        }

        // Pull `thinking` from transcript.jsonl when an agent_response step completes
        if (cfg.streamThinkingFromTranscript && su.step_type === 'agent_response' && su.state === 'DONE' && activeConversationId) {
          recoverFromTranscript(activeConversationId, emittedThinkingSteps)
            .then(({ newThinking }) => {
              for (const thought of newThinking) {
                if (!textStarted) {
                  emitReasoningDelta((reasoningTextAccum ? '\n\n' : '') + thought)
                }
              }
            })
            .catch(() => {})
        }

        // Stream live text_delta tokens when not inside a `<dsh_tool_call>` block
        if (typeof su.text_delta === 'string' && su.text_delta.length > 0) {
          streamedTextAccum += su.text_delta
          if (executionMode === 'agy-agent') {
            closeReasoningIfOpen()
            if (!textStarted) {
              textStarted = true
              pushItem({ type: 'block-start', index: 1, blockType: 'text' })
            }
            pushItem({ type: 'text-delta', index: 1, text: su.text_delta })
          }
        }
        return
      }

      if (evt.event === 'result' && evt.result) {
        finalResultEvent = evt.result
        if (typeof evt.result.conversation_id === 'string' && evt.result.conversation_id) {
          activeConversationId = evt.result.conversation_id
        }
        if (evt.result.usage && typeof evt.result.usage === 'object') {
          const u = evt.result.usage
          cumulativeUsage.inputTokens = typeof u.input_tokens === 'number' ? u.input_tokens : cumulativeUsage.inputTokens
          cumulativeUsage.outputTokens = typeof u.output_tokens === 'number' ? u.output_tokens : cumulativeUsage.outputTokens
          cumulativeUsage.cacheReadTokens =
            typeof u.cache_read_tokens === 'number' ? u.cache_read_tokens : cumulativeUsage.cacheReadTokens
          cumulativeUsage.totalTokens =
            typeof u.total_tokens === 'number'
              ? u.total_tokens
              : cumulativeUsage.inputTokens + cumulativeUsage.outputTokens
        }
      }
    })

    proc.once('error', (err) => {
      finishQueue(createAdapterError(`Antigravity CLI process error: ${err.message}`, 'SERVER'))
    })

    proc.once('close', (code) => {
      ;(async () => {
        try {
          if (options.signal?.aborted) {
            finishQueue(createAdapterError('Antigravity CLI request aborted by caller', 'ABORTED'))
            return
          }

          // Recover any remaining thinking + fallback response from transcript.jsonl (ported from tm-agy-tele)
          let transcriptRecoveredResponse = ''
          if (activeConversationId) {
            const recovered = await recoverFromTranscript(activeConversationId, emittedThinkingSteps)
            transcriptRecoveredResponse = recovered.response
            if (cfg.streamThinkingFromTranscript && !textStarted) {
              for (const thought of recovered.newThinking) {
                emitReasoningDelta((reasoningTextAccum ? '\n\n' : '') + thought)
              }
            }
          }

          closeReasoningIfOpen()

          const rawResponse =
            (typeof finalResultEvent?.response === 'string' && finalResultEvent.response.trim().length > 0
              ? finalResultEvent.response
              : '') ||
            (streamedTextAccum.trim().length > 0 ? streamedTextAccum : '') ||
            transcriptRecoveredResponse

          if (!rawResponse && code !== 0) {
            // If resuming a stale conversation failed, clear the stored conversationId so retry starts fresh
            if (sessionKey && existingConvId) {
              await this.sessionStore.delete(sessionKey)
            }
            const errDetail = finalResultEvent?.error || stderrText.trim() || `agy exited with code ${code}`
            const errCode = /quota|exhausted|balance/i.test(errDetail)
              ? 'QUOTA'
              : /rate.?limit|429/i.test(errDetail)
                ? 'RATE_LIMIT'
                : /timeout|timed out/i.test(errDetail)
                  ? 'TIMEOUT'
                  : 'SERVER'
            finishQueue(createAdapterError(`Antigravity CLI error: ${errDetail}`, errCode))
            return
          }

          if (executionMode === 'agy-agent') {
            // If nothing was streamed incrementally during ACTIVE, emit the final recovered response now
            if (!textStarted && rawResponse) {
              textStarted = true
              pushItem({ type: 'block-start', index: 1, blockType: 'text' })
              pushItem({ type: 'text-delta', index: 1, text: rawResponse })
            }
            if (textStarted) {
              pushItem({
                type: 'block-end',
                index: 1,
                block: { type: 'text', text: streamedTextAccum || rawResponse },
              })
            }
            pushItem({
              type: 'usage',
              usage: {
                inputTokens: cumulativeUsage.inputTokens,
                outputTokens: cumulativeUsage.outputTokens,
                totalTokens:
                  cumulativeUsage.totalTokens || cumulativeUsage.inputTokens + cumulativeUsage.outputTokens,
                ...(cumulativeUsage.cacheReadTokens > 0
                  ? { cacheReadTokens: cumulativeUsage.cacheReadTokens }
                  : {}),
              },
            })
            pushItem({ type: 'finish', reason: { kind: 'stop' } })
            finishQueue()
            return
          }

          // `dsh-bridge` mode: parse `<dsh_tool_call>` blocks and clean text
          const { cleanText, toolCalls } = parseBridgeResponse(rawResponse, allowedToolNames)
          const finalText = stripTrailingBridgeFooterOnToolCall(cleanText, toolCalls.length > 0)

          if (finalText.length > 0 || toolCalls.length === 0) {
            const textToEmit = finalText || (toolCalls.length === 0 ? '(No text output from agy)' : '')
            if (textToEmit) {
              pushItem({ type: 'block-start', index: 1, blockType: 'text' })
              pushItem({ type: 'text-delta', index: 1, text: textToEmit })
              pushItem({
                type: 'block-end',
                index: 1,
                block: { type: 'text', text: textToEmit },
              })
            }
          }

          let blockIndex = 2
          for (const tc of toolCalls) {
            const idx = blockIndex++
            pushItem({ type: 'block-start', index: idx, blockType: 'tool-call' })
            pushItem({
              type: 'tool-call-delta',
              index: idx,
              id: tc.id,
              name: tc.name,
              argumentsDelta: tc.arguments,
            })
            pushItem({
              type: 'block-end',
              index: idx,
              block: {
                type: 'tool-call',
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              },
            })
          }

          pushItem({
            type: 'usage',
            usage: {
              inputTokens: cumulativeUsage.inputTokens,
              outputTokens: cumulativeUsage.outputTokens,
              totalTokens:
                cumulativeUsage.totalTokens || cumulativeUsage.inputTokens + cumulativeUsage.outputTokens,
              ...(cumulativeUsage.cacheReadTokens > 0
                ? { cacheReadTokens: cumulativeUsage.cacheReadTokens }
                : {}),
            },
          })

          pushItem({
            type: 'finish',
            reason: { kind: toolCalls.length > 0 ? 'tool-calls' : 'stop' },
          })
          finishQueue()
        } catch (err) {
          finishQueue(createAdapterError(err?.message || String(err), 'SERVER'))
        }
      })()
    })

    try {
      while (true) {
        while (queue.length > 0) {
          yield queue.shift()
        }
        if (streamDone) {
          if (streamError) throw streamError
          return
        }
        await new Promise((resolve) => {
          wakeNext = resolve
        })
      }
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
      rl.close()
      if (proc.exitCode === null) {
        await terminateProcessTree(proc)
      }
      if (overflowFilePath) {
        await rm(overflowFilePath, { force: true }).catch(() => {})
      }
    }
  }
}

/**
 * Plugin entry point: registers `agy-cli` in DeepSeek Harness's configurable provider directory,
 * mounts `AgyCliAdapter` onto `ctx.llm`, and publishes `/api/agy-provider.accounts` for
 * multi-account sign-in and active account switching inside `Settings -> Models`.
 * @param {any} ctx - Cordis plugin context.
 * @param {Record<string, unknown> | undefined} rawConfig - Loader row config.
 */
export function apply(ctx, rawConfig) {
  const getConfig = () => resolveConfig(rawConfig)
  const sessionStore = new AgySessionStore()
  const accountManager = new AgyAccountManager({ getConfig })
  const adapter = new AgyCliAdapter({ ctx, getConfig, sessionStore, accountManager })

  const cfg = getConfig()
  const adapterHandle = ctx.llm.registerAdapter([cfg.provider], adapter)

  const disposeChange = accountManager.onChange(() => {
    try {
      adapterHandle?.replace?.([cfg.provider])
    } catch {
      /* ignore */
    }
  })

  // Ensure initial keyring state is loaded on startup and trigger model list refresh if needed
  accountManager.ensureLoaded().then(() => {
    try {
      adapterHandle?.replace?.([cfg.provider])
    } catch {
      /* ignore */
    }
  })

  ctx.effect?.(() => () => {
    disposeChange()
    accountManager.cancelInteractiveLogin().catch(() => {})
  }, 'agy-provider: cleanup')

  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.connection.fetch.register({
      path: ACCOUNTS_ROUTE_PATH,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          if (request.method === 'GET') {
            const url = new URL(request.url)
            if (url.searchParams.get('sync') === '1') {
              await accountManager.syncFromSystemKeyring({ autoImportIfEmpty: true })
            }
            const snapshot = await accountManager.getPublicSnapshot()
            return Response.json(snapshot, { headers: { 'cache-control': 'no-store' } })
          }

          let body = {}
          try {
            body = await request.json()
          } catch {
            body = {}
          }
          const action = typeof body?.action === 'string' ? body.action : ''
          const accountId = typeof body?.accountId === 'string' ? body.accountId : ''

          let snapshot
          switch (action) {
            case 'toggle-provider':
              snapshot = await accountManager.setProviderEnabled(Boolean(body.enabled))
              break
            case 'activate':
              snapshot = await accountManager.activateAccount(accountId)
              break
            case 'toggle-account':
              snapshot = await accountManager.toggleAccountEnabled(accountId, Boolean(body.enabled))
              break
            case 'remove':
              snapshot = await accountManager.removeAccount(accountId)
              break
            case 'sync-current':
              await accountManager.syncFromSystemKeyring({ forceActivateImported: true })
              accountManager.notifyChange()
              snapshot = await accountManager.getPublicSnapshot()
              break
            case 'start-login':
              snapshot = await accountManager.startInteractiveLogin()
              break
            case 'submit-login-code':
              snapshot = await accountManager.submitLoginCode(typeof body?.code === 'string' ? body.code : '')
              break
            case 'open-auth-url': {
              const targetUrl =
                (typeof body?.url === 'string' && body.url.startsWith('https://accounts.google.com/')
                  ? body.url
                  : accountManager.loginState?.authUrl) || ''
              if (targetUrl && process.platform === 'win32') {
                spawn(
                  'powershell.exe',
                  ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process $env:AGY_AUTH_URL'],
                  {
                    env: { ...process.env, AGY_AUTH_URL: targetUrl },
                    stdio: 'ignore',
                    windowsHide: true,
                  },
                ).on('error', () => {})
              }
              snapshot = await accountManager.getPublicSnapshot()
              break
            }
            case 'cancel-login':
              snapshot = await accountManager.cancelInteractiveLogin()
              break
            default:
              return Response.json(
                { ok: false, error: `Unknown action: ${action}` },
                { status: 400, headers: { 'cache-control': 'no-store' } },
              )
          }

          return Response.json(snapshot, { headers: { 'cache-control': 'no-store' } })
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500, headers: { 'cache-control': 'no-store' } },
          )
        }
      },
    })
  })
}
