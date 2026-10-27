/**
 * Client half of `@local/skills-manager`.
 *
 * Mounts:
 * 1. Settings Menu (`settings.section`, id `skills-manager`, order `11` — "Skills")
 * 2. Right Sidebar Tab & Start Guide (`@local/skills-manager/tab`, kind `skills-manager`)
 *
 * Features:
 * - Tab 1 ("Installed"): Search & filter installed skills, toggle Global and per-Workspace
 *   assignments with 1 click, toggle Model Auto-Invocation, edit SKILL.md inline, or delete.
 * - Tab 2 ("Import Local"): Auto-discovers all skills from Antigravity (`~/.gemini/...`)
 *   and Claude Code (`~/.claude/skills`) with single or batch 1-click full-bundle import
 *   into Global and/or selected Workspaces.
 * - Tab 3 ("Explore Online"): Browse Popular (All-Time), Trending (24h), Hot (`skills.sh`),
 *   and Newly Created (`GitHub Search API`), or live-search 50,000+ community skills and
 *   install with 1 click into Global and/or selected Workspaces.
 */

window.__ModuleLoader__.load({
  id: '@local/skills-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NAMESPACE = 'skills-manager'
    const SETTINGS_SLOT = 'settings.section'
    const SETTINGS_ID = 'skills-manager'
    const SIDEBAR_TAB_ID = '@local/skills-manager/tab'
    const SIDEBAR_TAB_KIND = 'skills-manager'
    const ROUTE = 'api/skills-manager'

    const DICTIONARIES = {
      en: {
        settingsSection: 'Skills',
        sidebarTitle: 'Skills Manager',
        title: 'AI Agent Skills Manager',
        subtitle: 'Manage installed skills across Global & Workspaces, import from Antigravity or Claude Code, and discover community skills from skills.sh & GitHub.',
        tabInstalled: 'Installed',
        tabImport: 'Import (Antigravity / Claude)',
        tabExplore: 'Explore & Search Online',
        newSkillBtn: '+ New Skill',
        refreshBtn: 'Refresh',
        searchInstalledPlaceholder: 'Search installed skills by name or description…',
        searchImportPlaceholder: 'Filter local Antigravity / Claude Code skills…',
        searchOnlinePlaceholder: 'Search 50,000+ skills on skills.sh & GitHub (min 2 chars)…',
        searchBtn: 'Search',
        scopeFilterAll: 'All Scopes',
        scopeGlobal: 'Global (~/.dsh/skills)',
        scopeGlobalShort: 'Global',
        targetScopesLabel: 'Install / Import Target Scopes:',
        activeModelAuto: 'Auto-Invoke',
        activeModelOff: 'Slash Only',
        editBtn: 'Edit',
        deleteBtn: 'Delete',
        importBtn: 'Import',
        reimportBtn: 'Re-import',
        importBatchBtn: 'Import All Visible',
        installBtn: 'Install',
        reinstallBtn: 'Reinstall',
        installingBtn: 'Installing…',
        installedBadge: 'Installed',
        resourcesBadge: '+ scripts/resources',
        emptyInstalled: 'No skills installed in this scope yet. Import from Antigravity/Claude Code or Explore Online!',
        emptyImport: 'No local skills found matching your filter.',
        emptyExplore: 'No online skills found.',
        catPopular: 'Popular (All-Time)',
        catTrending: 'Trending (24h)',
        catHot: 'Hot (Surging)',
        catNewest: 'Newly Created (GitHub)',
        sourceAll: 'All Sources',
        sourceAgyUser: 'Antigravity (User)',
        sourceAgyBuiltin: 'Antigravity (Built-in)',
        sourceAgyPlugin: 'Antigravity (Plugins)',
        sourceClaude: 'Claude Code',
        editorCreateTitle: 'Create Custom Skill',
        editorEditTitle: 'Edit Skill:',
        fieldName: 'Skill Name (kebab-case)',
        fieldDesc: 'Description (When the agent should use this skill)',
        fieldBody: 'Instructions (Markdown body of SKILL.md)',
        saveSkillBtn: 'Save Skill',
        cancelBtn: 'Cancel',
        scopeAssignLabel: 'Applied Scopes (click to toggle):',
        installsUnit: 'installs',
        customRepoHint: 'Install directly from GitHub (owner/repo):',
        customSkillIdPlaceholder: 'skill-name',
      },
      id: {
        settingsSection: 'Skills',
        sidebarTitle: 'Manajer Skill',
        title: 'Manajer & Marketplace Skill AI',
        subtitle: 'Kelola skill terpasang di Global maupun per Workspace, impor dari Antigravity atau Claude Code, serta cari & instal skill populer/terbaru dari skills.sh & GitHub.',
        tabInstalled: 'Terpasang',
        tabImport: 'Impor (Antigravity / Claude)',
        tabExplore: 'Jelajah & Cari Online',
        newSkillBtn: '+ Buat Skill',
        refreshBtn: 'Muat Ulang',
        searchInstalledPlaceholder: 'Cari skill terpasang berdasarkan nama atau deskripsi…',
        searchImportPlaceholder: 'Saring skill lokal Antigravity / Claude Code…',
        searchOnlinePlaceholder: 'Cari 50.000+ skill di skills.sh & GitHub (min 2 huruf)…',
        searchBtn: 'Cari',
        scopeFilterAll: 'Semua Scope',
        scopeGlobal: 'Global (~/.dsh/skills)',
        scopeGlobalShort: 'Global',
        targetScopesLabel: 'Target Scope Instalasi / Impor:',
        activeModelAuto: 'Aktif Otomatis',
        activeModelOff: 'Hanya /slash',
        editBtn: 'Edit',
        deleteBtn: 'Hapus',
        importBtn: 'Impor',
        reimportBtn: 'Impor Ulang',
        importBatchBtn: 'Impor Semua yang Tampil',
        installBtn: 'Instal',
        reinstallBtn: 'Instal Ulang',
        installingBtn: 'Menginstal…',
        installedBadge: 'Terpasang',
        resourcesBadge: '+ scripts/resources',
        emptyInstalled: 'Belum ada skill terpasang di scope ini. Silakan impor dari tab Antigravity/Claude Code atau Jelajah Online!',
        emptyImport: 'Tidak ada skill lokal yang cocok dengan filter.',
        emptyExplore: 'Tidak ditemukan skill online.',
        catPopular: 'Populer (Sepanjang Waktu)',
        catTrending: 'Trending (24 Jam)',
        catHot: 'Hot (Naik Daun)',
        catNewest: 'Baru Dibuat (GitHub)',
        sourceAll: 'Semua Sumber',
        sourceAgyUser: 'Antigravity (User)',
        sourceAgyBuiltin: 'Antigravity (Bawaan)',
        sourceAgyPlugin: 'Antigravity (Plugin)',
        sourceClaude: 'Claude Code',
        editorCreateTitle: 'Buat Skill Baru',
        editorEditTitle: 'Edit Skill:',
        fieldName: 'Nama Skill (kebab-case)',
        fieldDesc: 'Deskripsi (Kapan agen harus memakai skill ini)',
        fieldBody: 'Instruksi (Isi Markdown SKILL.md)',
        saveSkillBtn: 'Simpan Skill',
        cancelBtn: 'Batal',
        scopeAssignLabel: 'Terapkan pada Scope (klik untuk toggle):',
        installsUnit: 'instalasi',
        customRepoHint: 'Instal langsung dari GitHub (owner/repo):',
        customSkillIdPlaceholder: 'nama-skill',
      },
    }

    const CSS = [
      '@keyframes dsm-fade-up{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes dsm-spin{to{transform:rotate(360deg)}}',
      '.dsm-spin{animation:dsm-spin .75s linear infinite}',
      '.dsm-root{display:flex;flex-direction:column;gap:14px;width:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary,#f1f5f9);font-size:13px;line-height:1.45;animation:dsm-fade-up .2s cubic-bezier(.16,1,.3,1)}',
      '.dsm-root-settings{max-width:900px;padding:4px 0}',
      '.dsm-root-sidebar{padding:12px;overflow-y:auto;height:100%}',
      '.dsm-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1,#263040);padding-bottom:10px}',
      '.dsm-title{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,#f8fafc);letter-spacing:-.01em}',
      '.dsm-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#94a3b8);margin-top:2px}',
      '.dsm-top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dsm-nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dsm-nav-tab{appearance:none;border:1px solid var(--dsw-alias-border-l1,#2a3546);background:var(--dsw-alias-bg-layer-1,#18202c);color:var(--dsw-alias-label-secondary,#94a3b8);font-size:12.5px;font-weight:500;padding:7px 13px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .16s cubic-bezier(.16,1,.3,1)}',
      '.dsm-nav-tab:hover{color:var(--dsw-alias-label-primary,#f1f5f9);border-color:var(--dsw-alias-border-l2,#3b4a61)}',
      '.dsm-nav-tab[data-active="true"]{background:rgba(79,70,229,.2);color:var(--dsw-alias-label-primary,#ffffff);border-color:#6366f1;font-weight:600}',
      '.dsm-count-pill{font-size:11px;font-variant-numeric:tabular-nums;padding:1px 6px;border-radius:999px;background:rgba(148,163,184,.16);color:var(--dsw-alias-label-primary,#e2e8f0)}',
      '.dsm-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,#2e3a4c);background:var(--dsw-alias-bg-layer-1,#1c2430);color:var(--dsw-alias-label-primary,#e2e8f0);font-size:12px;font-weight:500;padding:6px 12px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;flex:0 0 auto;transition:all .16s cubic-bezier(.16,1,.3,1)}',
      '.dsm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#253040);border-color:var(--dsw-alias-border-l2,#475569)}',
      '.dsm-btn:active:not(:disabled){transform:scale(.98)}',
      '.dsm-btn:disabled{opacity:.45;cursor:default}',
      '.dsm-btn.dsm-btn-primary{background:#4f46e5!important;border-color:#6366f1!important;color:#ffffff!important;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.25)}',
      '.dsm-btn.dsm-btn-primary:hover:not(:disabled){background:#4338ca!important;border-color:#818cf8!important;color:#ffffff!important}',
      '.dsm-btn-danger{color:var(--dsw-alias-state-error-primary,#ef4444);border-color:rgba(239,68,68,.3)}',
      '.dsm-btn-danger:hover:not(:disabled){background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.55)}',
      '.dsm-target-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#161e29);border:1px solid var(--dsw-alias-border-l1,#283344)}',
      '.dsm-target-group{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
      '.dsm-target-label{font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary,#94a3b8);margin-right:4px}',
      '.dsm-scope-chip{appearance:none;border:1px solid var(--dsw-alias-border-l1,#2c384a);background:var(--dsw-alias-bg-layer-2,#1e2736);color:var(--dsw-alias-label-secondary,#94a3b8);font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s ease}',
      '.dsm-scope-chip:hover{border-color:var(--dsw-alias-border-l2,#475569);color:var(--dsw-alias-label-primary,#f1f5f9)}',
      '.dsm-scope-chip[data-selected="true"]{background:rgba(44,201,133,.16);border-color:rgba(44,201,133,.55);color:var(--dsw-alias-state-success-primary,#2cc985);font-weight:600}',
      '.dsm-filter-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dsm-input{width:100%;height:36px;flex:none;background:var(--dsw-alias-bg-layer-1,#141b24);border:1px solid var(--dsw-alias-border-l1,#2a3546);color:var(--dsw-alias-label-primary,#f1f5f9);border-radius:7px;padding:0 11px;font-size:12.5px;line-height:34px;outline:none;box-sizing:border-box}',
      '.dsm-filter-bar>.dsm-input{flex:1 1 220px;width:auto;min-width:160px}',
      '.dsm-input:focus{border-color:#6366f1}',
      '.dsm-textarea{width:100%;min-height:170px;flex:none;font-family:var(--dsw-alias-font-mono,monospace);background:var(--dsw-alias-bg-layer-1,#141b24);border:1px solid var(--dsw-alias-border-l1,#2a3546);color:var(--dsw-alias-label-primary,#f1f5f9);border-radius:7px;padding:9px 11px;font-size:12px;line-height:1.5;outline:none;box-sizing:border-box;resize:vertical}',
      '.dsm-textarea-desc{min-height:68px;font-family:inherit;font-size:12.5px;line-height:1.45}',
      '.dsm-textarea:focus{border-color:#6366f1}',
      '.dsm-pill-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '.dsm-sub-pill{appearance:none;border:1px solid var(--dsw-alias-border-l1,#283344);background:transparent;color:var(--dsw-alias-label-secondary,#94a3b8);font-size:11.5px;padding:4px 10px;border-radius:999px;cursor:pointer;transition:all .15s ease}',
      '.dsm-sub-pill:hover{color:var(--dsw-alias-label-primary,#f1f5f9);border-color:var(--dsw-alias-border-l2,#3e4e68)}',
      '.dsm-sub-pill[data-active="true"]{background:var(--dsw-alias-bg-layer-2,#243042);color:var(--dsw-alias-label-primary,#ffffff);border-color:#6366f1;font-weight:600}',
      '.dsm-list{display:flex;flex-direction:column;gap:9px}',
      '.dsm-card{display:flex;flex-direction:column;gap:8px;padding:13px 15px;border-radius:9px;background:var(--dsw-alias-bg-layer-1,#18202a);border:1px solid var(--dsw-alias-border-l1,#283344);transition:border-color .16s ease}',
      '.dsm-card:hover{border-color:var(--dsw-alias-border-l2,#38475e)}',
      '.dsm-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:nowrap}',
      '.dsm-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1 1 0%;min-width:0}',
      '.dsm-skill-name{font-family:var(--dsw-alias-font-mono,monospace);font-size:13.5px;font-weight:600;color:var(--dsw-alias-label-primary,#ffffff);background:rgba(99,102,241,.14);border:1px solid rgba(99,102,241,.3);padding:2px 8px;border-radius:6px}',
      '.dsm-badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#232f40);color:var(--dsw-alias-label-secondary,#94a3b8);border:1px solid var(--dsw-alias-border-l1,#2f3d52);white-space:nowrap}',
      '.dsm-badge-ok{background:rgba(44,201,133,.14);color:var(--dsw-alias-state-success-primary,#2cc985);border-color:rgba(44,201,133,.35)}',
      '.dsm-badge-info{background:rgba(59,130,246,.14);color:#60a5fa;border-color:rgba(59,130,246,.35)}',
      '.dsm-desc{font-size:12.5px;color:var(--dsw-alias-label-secondary,#cbd5e1);line-height:1.45;word-break:break-word}',
      '.dsm-card-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding-top:4px;border-top:1px dashed rgba(148,163,184,.12)}',
      '.dsm-editor{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#1c2533);border:1px solid #6366f1}',
      '.dsm-field{display:flex;flex-direction:column;gap:5px}',
      '.dsm-label{font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary,#94a3b8)}',
      '.dsm-msg{padding:9px 12px;border-radius:8px;font-size:12px;background:rgba(44,201,133,.14);border:1px solid rgba(44,201,133,.35);color:var(--dsw-alias-state-success-primary,#2cc985)}',
      '.dsm-err{padding:9px 12px;border-radius:8px;font-size:12px;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35);color:var(--dsw-alias-state-error-primary,#ef4444)}',
      '.dsm-link{color:#818cf8;text-decoration:none;font-size:12px;font-family:var(--dsw-alias-font-mono,monospace)}',
      '.dsm-link:hover{text-decoration:underline}',
      '@media (prefers-reduced-motion:reduce){.dsm-root,.dsm-spin,.dsm-btn,.dsm-nav-tab,.dsm-scope-chip{animation:none!important;transition:none!important}}',
    ].join('\n')

    function routeUrl(params) {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string'
        ? document.baseURI
        : window.location.href
      const url = new URL(ROUTE, base)
      if (params && typeof params === 'object') {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
        }
      }
      return url.href
    }

    async function apiGet(params) {
      const res = await fetch(routeUrl(params), {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      return await res.json()
    }

    async function apiPost(payload) {
      const res = await fetch(routeUrl(), {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      return await res.json()
    }

    function compactCount(num) {
      if (typeof num !== 'number' || !Number.isFinite(num)) return null
      if (num >= 1e6) return `${(num / 1e6).toFixed(1).replace(/\.0$/, '')}M`
      if (num >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.0$/, '')}K`
      return String(num)
    }

    const SKILLS_NAV_SVG =
      '<rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.35"/>' +
      '<rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.35"/>' +
      '<rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.35"/>' +
      '<path d="M11.5 1.5L12.2 3.7L14.4 4.4L12.2 5.1L11.5 7.3L10.8 5.1L8.6 4.4L10.8 3.7L11.5 1.5Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>'

    const QUOTA_NAV_SVG =
      '<path d="M2.2 11.8a6 6 0 1 1 11.6 0" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
      '<path d="M8 9.5L11.2 5.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
      '<circle cx="8" cy="9.5" r="1.25" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M4.5 13.2h7" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>'

    function patchSettingsNavIcons() {
      if (typeof document === 'undefined') return
      const buttons = document.querySelectorAll('[data-shortcut-modal="settings"] nav button')
      for (const btn of buttons) {
        const labelEl = btn.querySelector('span')
        const svgEl = btn.querySelector('svg')
        if (!labelEl || !svgEl) continue
        const text = (labelEl.textContent || '').trim()
        if (text === 'Skills' || text === 'Manajer Skill') {
          if (svgEl.getAttribute('data-dsh-custom-icon') !== 'skills') {
            svgEl.setAttribute('viewBox', '0 0 16 16')
            svgEl.setAttribute('fill', 'none')
            svgEl.setAttribute('data-dsh-custom-icon', 'skills')
            svgEl.innerHTML = SKILLS_NAV_SVG
          }
        } else if (text === 'Quota & Usage' || text === 'Kuota & Pemakaian') {
          if (svgEl.getAttribute('data-dsh-custom-icon') !== 'quota') {
            svgEl.setAttribute('viewBox', '0 0 16 16')
            svgEl.setAttribute('fill', 'none')
            svgEl.setAttribute('data-dsh-custom-icon', 'quota')
            svgEl.innerHTML = QUOTA_NAV_SVG
          }
        }
      }
    }

    function SkillsManagerView({ mode, t }) {
      const [activeTab, setActiveTab] = React.useState('installed')
      const [busy, setBusy] = React.useState(true)
      const [actionBusyKey, setActionBusyKey] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)

      const [workspaces, setWorkspaces] = React.useState([])
      const [installedSkills, setInstalledSkills] = React.useState([])
      const [importableSkills, setImportableSkills] = React.useState([])

      // Target scopes for Import & Online Install (defaults to Global = true)
      const [targetGlobal, setTargetGlobal] = React.useState(true)
      const [targetWorkspaceIds, setTargetWorkspaceIds] = React.useState([])

      // Tab 1 (Installed) filters
      const [installedSearch, setInstalledSearch] = React.useState('')
      const [installedScopeFilter, setInstalledScopeFilter] = React.useState('all')

      // Tab 2 (Import) filters
      const [importSearch, setImportSearch] = React.useState('')
      const [importSourceFilter, setImportSourceFilter] = React.useState('all')

      // Tab 3 (Explore Online) state
      const [exploreCategory, setExploreCategory] = React.useState('popular')
      const [exploreQuery, setExploreQuery] = React.useState('')
      const [exploreItems, setExploreItems] = React.useState([])
      const [exploreBusy, setExploreBusy] = React.useState(false)
      const [customSource, setCustomSource] = React.useState('')
      const [customSkillId, setCustomSkillId] = React.useState('')

      // Inline Skill Editor / Creator state
      const [editorState, setEditorState] = React.useState(null)

      const loadOverview = React.useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
          const data = await apiGet({ action: 'overview' })
          if (data?.ok) {
            setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : [])
            setInstalledSkills(Array.isArray(data.installedSkills) ? data.installedSkills : [])
            setImportableSkills(Array.isArray(data.importableSkills) ? data.importableSkills : [])
          } else {
            setError(data?.error || 'Failed to load skills overview')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }, [])

      const loadExplore = React.useCallback(async (category, q, force) => {
        setExploreBusy(true)
        setError(null)
        try {
          const data = await apiGet({
            action: 'explore',
            category,
            q: q && q.trim().length >= 2 ? q.trim() : '',
            refresh: force ? '1' : '',
          })
          if (data?.ok) {
            setExploreItems(Array.isArray(data.items) ? data.items : [])
          } else {
            setError(data?.error || 'Failed to query online skills registry')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setExploreBusy(false)
        }
      }, [])

      React.useEffect(() => {
        patchSettingsNavIcons()
        loadOverview()
      }, [loadOverview])

      React.useEffect(() => {
        if (activeTab === 'explore') {
          loadExplore(exploreCategory, exploreQuery, false)
        }
      }, [activeTab, exploreCategory])

      const toggleTargetWorkspace = (wsId) => {
        setTargetWorkspaceIds((prev) =>
          prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId]
        )
      }

      const handleToggleSkillScope = async (skill, scopeType, wsId) => {
        setActionBusyKey(`scope:${skill.name}`)
        setError(null)
        try {
          let nextGlobal = skill.isGlobal
          let nextWs = [...(skill.workspaceIds || [])]
          if (scopeType === 'global') {
            nextGlobal = !nextGlobal
          } else if (wsId) {
            nextWs = nextWs.includes(wsId) ? nextWs.filter((id) => id !== wsId) : [...nextWs, wsId]
          }
          const data = await apiPost({
            action: 'set-scopes',
            name: skill.name,
            global: nextGlobal,
            workspaceIds: nextWs,
          })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
            setImportableSkills(data.importableSkills || [])
          } else {
            setError(data?.error || 'Failed to update skill scopes')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleToggleAutoInvoke = async (skill) => {
        setActionBusyKey(`inv:${skill.name}`)
        try {
          const data = await apiPost({
            action: 'toggle-invocation',
            name: skill.name,
            disableModelInvocation: !skill.disableModelInvocation,
          })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleDeleteSkill = async (skillName) => {
        setActionBusyKey(`del:${skillName}`)
        try {
          const data = await apiPost({ action: 'delete-skill', name: skillName })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
            setImportableSkills(data.importableSkills || [])
            setNotice(`Removed skill /${skillName}`)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleOpenEditor = async (skill) => {
        if (!skill) {
          setEditorState({
            isNew: true,
            name: '',
            description: '',
            body: '# Instructions\n\nWrite clear step-by-step instructions for the AI agent here.',
            global: true,
            workspaceIds: [],
          })
          return
        }
        setActionBusyKey(`edit:${skill.name}`)
        try {
          const data = await apiGet({ action: 'read-skill', name: skill.name })
          if (data?.ok) {
            setEditorState({
              isNew: false,
              name: data.name,
              description: data.parsed?.description || skill.description || '',
              body: data.parsed?.body || '',
              global: Boolean(data.isGlobal),
              workspaceIds: Array.isArray(data.workspaceIds) ? data.workspaceIds : [],
            })
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleSaveEditor = async () => {
        if (!editorState || !editorState.name.trim()) return
        setActionBusyKey('save-editor')
        setError(null)
        try {
          const data = await apiPost({
            action: 'save-skill',
            name: editorState.name,
            description: editorState.description,
            body: editorState.body,
            global: editorState.global,
            workspaceIds: editorState.workspaceIds,
          })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
            setImportableSkills(data.importableSkills || [])
            setEditorState(null)
            setNotice(`Saved skill /${editorState.name}`)
          } else {
            setError(data?.error || 'Failed to save skill')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleImportLocal = async (items, keyLabel) => {
        setActionBusyKey(keyLabel)
        setError(null)
        setNotice(null)
        try {
          const data = await apiPost({
            action: 'import-local',
            items,
            global: targetGlobal,
            workspaceIds: targetWorkspaceIds,
          })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
            setImportableSkills(data.importableSkills || [])
            setNotice(`Imported ${data.importedCount || items.length} skill(s) successfully!`)
          } else {
            setError(data?.error || 'Import failed')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      const handleInstallRemote = async (item) => {
        const busyId = `remote:${item.id}`
        setActionBusyKey(busyId)
        setError(null)
        setNotice(null)
        try {
          const data = await apiPost({
            action: 'install-remote',
            source: item.source,
            skillId: item.skillId || item.name,
            global: targetGlobal,
            workspaceIds: targetWorkspaceIds,
          })
          if (data?.ok) {
            setInstalledSkills(data.installedSkills || [])
            setImportableSkills(data.importableSkills || [])
            setNotice(`Installed /${item.skillId || item.name} from ${item.source}!`)
            loadExplore(exploreCategory, exploreQuery, false)
          } else {
            setError(data?.error || 'Remote skill installation failed')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setActionBusyKey(null)
        }
      }

      // Render Target Scopes Bar (used in Import & Explore tabs)
      const renderTargetScopesBar = (rightExtra) =>
        h('div', { className: 'dsm-target-bar' },
          h('div', { className: 'dsm-target-group' },
            h('span', { className: 'dsm-target-label' }, t('targetScopesLabel')),
            h('button', {
              type: 'button',
              className: 'dsm-scope-chip',
              'data-selected': targetGlobal ? 'true' : 'false',
              onClick: () => setTargetGlobal(!targetGlobal),
            }, `🌐 ${t('scopeGlobalShort')}`),
            workspaces.map((ws) => {
              const selected = targetWorkspaceIds.includes(ws.id)
              return h('button', {
                key: ws.id,
                type: 'button',
                className: 'dsm-scope-chip',
                'data-selected': selected ? 'true' : 'false',
                title: ws.path,
                onClick: () => toggleTargetWorkspace(ws.id),
              }, `📁 ${ws.title}`)
            })
          ),
          rightExtra || null
        )

      // Top Header & Navigation Tabs
      const header = h('div', { className: 'dsm-header' },
        h('div', null,
          h('div', { className: 'dsm-title' }, t('title')),
          h('div', { className: 'dsm-sub' }, t('subtitle'))
        ),
        h('div', { className: 'dsm-top-actions' },
          h('button', {
            type: 'button',
            className: 'dsm-btn dsm-btn-primary',
            onClick: () => handleOpenEditor(null),
          }, t('newSkillBtn')),
          h('button', {
            type: 'button',
            className: 'dsm-btn',
            disabled: busy || exploreBusy,
            onClick: () => {
              loadOverview()
              if (activeTab === 'explore') loadExplore(exploreCategory, exploreQuery, true)
            },
          }, t('refreshBtn'))
        )
      )

      const navTabs = h('div', { className: 'dsm-nav' },
        h('button', {
          type: 'button',
          className: 'dsm-nav-tab',
          'data-active': activeTab === 'installed' ? 'true' : 'false',
          onClick: () => setActiveTab('installed'),
        },
          h('span', null, t('tabInstalled')),
          h('span', { className: 'dsm-count-pill' }, String(installedSkills.length))
        ),
        h('button', {
          type: 'button',
          className: 'dsm-nav-tab',
          'data-active': activeTab === 'import' ? 'true' : 'false',
          onClick: () => setActiveTab('import'),
        },
          h('span', null, t('tabImport')),
          h('span', { className: 'dsm-count-pill' }, String(importableSkills.length))
        ),
        h('button', {
          type: 'button',
          className: 'dsm-nav-tab',
          'data-active': activeTab === 'explore' ? 'true' : 'false',
          onClick: () => setActiveTab('explore'),
        },
          h('span', null, `🌐 ${t('tabExplore')}`)
        )
      )

      // Inline Editor / Creator Box
      const editorBox = editorState
        ? h('div', { className: 'dsm-editor' },
            h('div', { className: 'dsm-title' },
              editorState.isNew ? t('editorCreateTitle') : `${t('editorEditTitle')} /${editorState.name}`
            ),
            h('div', { className: 'dsm-field' },
              h('label', { className: 'dsm-label' }, t('fieldName')),
              h('input', {
                type: 'text',
                className: 'dsm-input',
                disabled: !editorState.isNew,
                placeholder: 'e.g. code-review-checklist',
                value: editorState.name,
                onChange: (e) => setEditorState({ ...editorState, name: e.target.value }),
              })
            ),
            h('div', { className: 'dsm-field' },
              h('label', { className: 'dsm-label' }, t('fieldDesc')),
              h('textarea', {
                className: 'dsm-textarea dsm-textarea-desc',
                rows: 3,
                placeholder: 'Describe what this skill does and when the AI agent should use it…',
                value: editorState.description,
                onChange: (e) => setEditorState({ ...editorState, description: e.target.value }),
              })
            ),
            h('div', { className: 'dsm-field' },
              h('label', { className: 'dsm-label' }, t('scopeAssignLabel')),
              h('div', { className: 'dsm-target-group' },
                h('button', {
                  type: 'button',
                  className: 'dsm-scope-chip',
                  'data-selected': editorState.global ? 'true' : 'false',
                  onClick: () => setEditorState({ ...editorState, global: !editorState.global }),
                }, `🌐 ${t('scopeGlobalShort')}`),
                workspaces.map((ws) => {
                  const sel = editorState.workspaceIds.includes(ws.id)
                  return h('button', {
                    key: ws.id,
                    type: 'button',
                    className: 'dsm-scope-chip',
                    'data-selected': sel ? 'true' : 'false',
                    onClick: () => {
                      const next = sel
                        ? editorState.workspaceIds.filter((id) => id !== ws.id)
                        : [...editorState.workspaceIds, ws.id]
                      setEditorState({ ...editorState, workspaceIds: next })
                    },
                  }, `📁 ${ws.title}`)
                })
              )
            ),
            h('div', { className: 'dsm-field' },
              h('label', { className: 'dsm-label' }, t('fieldBody')),
              h('textarea', {
                className: 'dsm-textarea',
                value: editorState.body,
                onChange: (e) => setEditorState({ ...editorState, body: e.target.value }),
              })
            ),
            h('div', { className: 'dsm-top-actions' },
              h('button', {
                type: 'button',
                className: 'dsm-btn dsm-btn-primary',
                disabled: actionBusyKey === 'save-editor' || !editorState.name.trim(),
                onClick: handleSaveEditor,
              }, t('saveSkillBtn')),
              h('button', {
                type: 'button',
                className: 'dsm-btn',
                onClick: () => setEditorState(null),
              }, t('cancelBtn'))
            )
          )
        : null

      // Tab Body
      let tabBody = null

      if (activeTab === 'installed') {
        const q = installedSearch.trim().toLowerCase()
        const filtered = installedSkills.filter((s) => {
          if (installedScopeFilter === 'global' && !s.isGlobal) return false
          if (installedScopeFilter !== 'all' && installedScopeFilter !== 'global') {
            if (!s.workspaceIds?.includes(installedScopeFilter)) return false
          }
          if (!q) return true
          return (
            s.name.toLowerCase().includes(q) ||
            String(s.description || '').toLowerCase().includes(q)
          )
        })

        const scopeFilterRow = h('div', { className: 'dsm-filter-bar' },
          h('input', {
            type: 'text',
            className: 'dsm-input',
            placeholder: t('searchInstalledPlaceholder'),
            value: installedSearch,
            onChange: (e) => setInstalledSearch(e.target.value),
          }),
          h('div', { className: 'dsm-pill-row' },
            h('button', {
              type: 'button',
              className: 'dsm-sub-pill',
              'data-active': installedScopeFilter === 'all' ? 'true' : 'false',
              onClick: () => setInstalledScopeFilter('all'),
            }, t('scopeFilterAll')),
            h('button', {
              type: 'button',
              className: 'dsm-sub-pill',
              'data-active': installedScopeFilter === 'global' ? 'true' : 'false',
              onClick: () => setInstalledScopeFilter('global'),
            }, `🌐 ${t('scopeGlobalShort')}`),
            workspaces.map((ws) =>
              h('button', {
                key: ws.id,
                type: 'button',
                className: 'dsm-sub-pill',
                'data-active': installedScopeFilter === ws.id ? 'true' : 'false',
                onClick: () => setInstalledScopeFilter(ws.id),
              }, `📁 ${ws.title}`)
            )
          )
        )

        const listEl =
          filtered.length === 0
            ? h('div', { className: 'dsm-card', style: { opacity: 0.75 } }, t('emptyInstalled'))
            : h('div', { className: 'dsm-list' },
                filtered.map((skill) =>
                  h('div', { key: skill.name, className: 'dsm-card' },
                    h('div', { className: 'dsm-card-top' },
                      h('div', { className: 'dsm-card-head' },
                        h('span', { className: 'dsm-skill-name' }, `/${skill.name}`),
                        skill.hasResources
                          ? h('span', { className: 'dsm-badge dsm-badge-info' }, t('resourcesBadge'))
                          : null,
                        h('button', {
                          type: 'button',
                          className: `dsm-badge ${skill.modelInvocable ? 'dsm-badge-ok' : ''}`,
                          style: { cursor: 'pointer' },
                          disabled: actionBusyKey === `inv:${skill.name}`,
                          onClick: () => handleToggleAutoInvoke(skill),
                        }, skill.modelInvocable ? `● ${t('activeModelAuto')}` : `○ ${t('activeModelOff')}`)
                      ),
                      h('div', { className: 'dsm-top-actions' },
                        h('button', {
                          type: 'button',
                          className: 'dsm-btn',
                          disabled: actionBusyKey === `edit:${skill.name}`,
                          onClick: () => handleOpenEditor(skill),
                        }, t('editBtn')),
                        h('button', {
                          type: 'button',
                          className: 'dsm-btn dsm-btn-danger',
                          disabled: actionBusyKey === `del:${skill.name}`,
                          onClick: () => handleDeleteSkill(skill.name),
                        }, t('deleteBtn'))
                      )
                    ),
                    h('div', { className: 'dsm-desc' }, skill.description),
                    h('div', { className: 'dsm-card-foot' },
                      h('div', { className: 'dsm-target-group' },
                        h('span', { className: 'dsm-target-label' }, t('scopeAssignLabel')),
                        h('button', {
                          type: 'button',
                          className: 'dsm-scope-chip',
                          'data-selected': skill.isGlobal ? 'true' : 'false',
                          disabled: actionBusyKey === `scope:${skill.name}`,
                          onClick: () => handleToggleSkillScope(skill, 'global', null),
                        }, `🌐 ${t('scopeGlobalShort')}`),
                        workspaces.map((ws) => {
                          const hasWs = skill.workspaceIds?.includes(ws.id)
                          return h('button', {
                            key: ws.id,
                            type: 'button',
                            className: 'dsm-scope-chip',
                            'data-selected': hasWs ? 'true' : 'false',
                            title: ws.path,
                            disabled: actionBusyKey === `scope:${skill.name}`,
                            onClick: () => handleToggleSkillScope(skill, 'workspace', ws.id),
                          }, `📁 ${ws.title}`)
                        })
                      )
                    )
                  )
                )
              )

        tabBody = h(React.Fragment, null, scopeFilterRow, listEl)
      } else if (activeTab === 'import') {
        const q = importSearch.trim().toLowerCase()
        const filtered = importableSkills.filter((item) => {
          if (importSourceFilter !== 'all' && item.sourceGroup !== importSourceFilter) return false
          if (!q) return true
          return (
            item.name.toLowerCase().includes(q) ||
            String(item.description || '').toLowerCase().includes(q) ||
            String(item.sourceLabel || '').toLowerCase().includes(q)
          )
        })

        const filterRow = h('div', { className: 'dsm-filter-bar' },
          h('input', {
            type: 'text',
            className: 'dsm-input',
            placeholder: t('searchImportPlaceholder'),
            value: importSearch,
            onChange: (e) => setImportSearch(e.target.value),
          }),
          h('div', { className: 'dsm-pill-row' },
            [
              { id: 'all', label: t('sourceAll') },
              { id: 'antigravity-user', label: t('sourceAgyUser') },
              { id: 'antigravity-builtin', label: t('sourceAgyBuiltin') },
              { id: 'antigravity-plugin', label: t('sourceAgyPlugin') },
              { id: 'claude-code', label: t('sourceClaude') },
            ].map((src) =>
              h('button', {
                key: src.id,
                type: 'button',
                className: 'dsm-sub-pill',
                'data-active': importSourceFilter === src.id ? 'true' : 'false',
                onClick: () => setImportSourceFilter(src.id),
              }, src.label)
            )
          )
        )

        const batchBtn =
          filtered.length > 0
            ? h('button', {
                type: 'button',
                className: 'dsm-btn dsm-btn-primary',
                disabled: actionBusyKey === 'batch-import',
                onClick: () =>
                  handleImportLocal(
                    filtered.map((f) => ({ name: f.name, bundlePath: f.bundlePath })),
                    'batch-import'
                  ),
              }, `${t('importBatchBtn')} (${filtered.length})`)
            : null

        const listEl =
          filtered.length === 0
            ? h('div', { className: 'dsm-card', style: { opacity: 0.75 } }, t('emptyImport'))
            : h('div', { className: 'dsm-list' },
                filtered.map((item) => {
                  const isInstalled = item.installedGlobal || (item.installedWorkspaceIds?.length > 0)
                  const bKey = `imp:${item.id}`
                  return h('div', { key: item.id, className: 'dsm-card' },
                    h('div', { className: 'dsm-card-top' },
                      h('div', { className: 'dsm-card-head' },
                        h('span', { className: 'dsm-skill-name' }, `/${item.name}`),
                        h('span', { className: 'dsm-badge' }, item.sourceLabel),
                        item.hasResources
                          ? h('span', { className: 'dsm-badge dsm-badge-info' }, t('resourcesBadge'))
                          : null,
                        isInstalled
                          ? h('span', { className: 'dsm-badge dsm-badge-ok' },
                              `✓ ${t('installedBadge')}${item.installedGlobal ? ' (Global)' : ''}${
                                item.installedWorkspaceIds?.length
                                  ? ` (+${item.installedWorkspaceIds.length} WS)`
                                  : ''
                              }`
                            )
                          : null
                      ),
                      h('button', {
                        type: 'button',
                        className: `dsm-btn ${isInstalled ? '' : 'dsm-btn-primary'}`,
                        disabled: actionBusyKey === bKey,
                        onClick: () =>
                          handleImportLocal([{ name: item.name, bundlePath: item.bundlePath }], bKey),
                      }, isInstalled ? t('reimportBtn') : t('importBtn'))
                    ),
                    h('div', { className: 'dsm-desc' }, item.description)
                  )
                })
              )

        tabBody = h(React.Fragment, null, renderTargetScopesBar(batchBtn), filterRow, listEl)
      } else if (activeTab === 'explore') {
        const searchRow = h('div', { className: 'dsm-filter-bar' },
          h('input', {
            type: 'text',
            className: 'dsm-input',
            placeholder: t('searchOnlinePlaceholder'),
            value: exploreQuery,
            onChange: (e) => setExploreQuery(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') loadExplore(exploreCategory, exploreQuery, false)
            },
          }),
          h('button', {
            type: 'button',
            className: 'dsm-btn dsm-btn-primary',
            disabled: exploreBusy,
            onClick: () => loadExplore(exploreCategory, exploreQuery, false),
          }, t('searchBtn')),
          h('div', { className: 'dsm-pill-row' },
            [
              { id: 'popular', label: `🔥 ${t('catPopular')}` },
              { id: 'trending', label: `📈 ${t('catTrending')}` },
              { id: 'hot', label: `⚡ ${t('catHot')}` },
              { id: 'newest', label: `🆕 ${t('catNewest')}` },
            ].map((cat) =>
              h('button', {
                key: cat.id,
                type: 'button',
                className: 'dsm-sub-pill',
                'data-active': exploreCategory === cat.id && !exploreQuery.trim() ? 'true' : 'false',
                onClick: () => {
                  setExploreQuery('')
                  setExploreCategory(cat.id)
                  loadExplore(cat.id, '', false)
                },
              }, cat.label)
            )
          )
        )

        const directInstallRow = h('div', { className: 'dsm-filter-bar' },
          h('span', { className: 'dsm-target-label' }, t('customRepoHint')),
          h('input', {
            type: 'text',
            className: 'dsm-input',
            style: { maxWidth: '220px' },
            placeholder: 'owner/repo (e.g. anthropics/skills)',
            value: customSource,
            onChange: (e) => setCustomSource(e.target.value),
          }),
          h('input', {
            type: 'text',
            className: 'dsm-input',
            style: { maxWidth: '180px' },
            placeholder: t('customSkillIdPlaceholder'),
            value: customSkillId,
            onChange: (e) => setCustomSkillId(e.target.value),
          }),
          h('button', {
            type: 'button',
            className: 'dsm-btn',
            disabled: !customSource.trim() || !customSkillId.trim() || actionBusyKey === 'remote:custom',
            onClick: () =>
              handleInstallRemote({
                id: 'custom',
                source: customSource.trim(),
                skillId: customSkillId.trim(),
                name: customSkillId.trim(),
              }),
          }, t('installBtn'))
        )

        const listEl = exploreBusy
          ? h('div', { className: 'dsm-card', style: { opacity: 0.75 } }, 'Loading skills registry…')
          : exploreItems.length === 0
            ? h('div', { className: 'dsm-card', style: { opacity: 0.75 } }, t('emptyExplore'))
            : h('div', { className: 'dsm-list' },
                exploreItems.map((item) => {
                  const isInstalled = item.installedGlobal || (item.installedWorkspaceIds?.length > 0)
                  const bKey = `remote:${item.id}`
                  const isInstalling = actionBusyKey === bKey
                  const countText =
                    typeof item.installs === 'number' && item.installs > 0
                      ? `⬇ ${compactCount(item.installs)} ${t('installsUnit')}`
                      : typeof item.stars === 'number'
                        ? `★ ${compactCount(item.stars)}`
                        : null

                  return h('div', { key: item.id, className: 'dsm-card' },
                    h('div', { className: 'dsm-card-top' },
                      h('div', { className: 'dsm-card-head' },
                        h('span', { className: 'dsm-skill-name' }, `/${item.kebabName || item.name}`),
                        h('a', {
                          href: item.url || `https://github.com/${item.source}`,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          className: 'dsm-link',
                        }, item.source),
                        countText ? h('span', { className: 'dsm-badge dsm-badge-info' }, countText) : null,
                        isInstalled
                          ? h('span', { className: 'dsm-badge dsm-badge-ok' }, `✓ ${t('installedBadge')}`)
                          : null
                      ),
                      h('button', {
                        type: 'button',
                        className: `dsm-btn ${isInstalled ? '' : 'dsm-btn-primary'}`,
                        disabled: isInstalling,
                        onClick: () => handleInstallRemote(item),
                      }, isInstalling ? t('installingBtn') : isInstalled ? t('reinstallBtn') : t('installBtn'))
                    ),
                    item.description ? h('div', { className: 'dsm-desc' }, item.description) : null
                  )
                })
              )

        tabBody = h(React.Fragment, null, renderTargetScopesBar(null), searchRow, directInstallRow, listEl)
      }

      return h(
        'div',
        { className: `dsm-root ${mode === 'settings' ? 'dsm-root-settings' : 'dsm-root-sidebar'}` },
        header,
        navTabs,
        error ? h('div', { className: 'dsm-err' }, error) : null,
        notice ? h('div', { className: 'dsm-msg' }, notice) : null,
        editorBox,
        tabBody
      )
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        ctx.effect(() => {
          if (typeof document === 'undefined' || !document.head) return
          let styleEl = document.getElementById('dsm-shared-styles')
          let created = false
          if (!styleEl) {
            styleEl = document.createElement('style')
            styleEl.id = 'dsm-shared-styles'
            styleEl.textContent = CSS
            document.head.appendChild(styleEl)
            created = true
          } else {
            styleEl.textContent = CSS
          }
          return () => {
            if (created && styleEl.parentNode) {
              styleEl.parentNode.removeChild(styleEl)
            }
          }
        }, 'skills-manager: styles')

        ctx.effect(() => {
          if (typeof document === 'undefined' || !document.body) return
          patchSettingsNavIcons()
          const obs = new MutationObserver(() => patchSettingsNavIcons())
          obs.observe(document.body, { childList: true, subtree: true })
          return () => obs.disconnect()
        }, 'skills-manager: settings nav icons')

        const locale = ctx.locale ?? ctx.get('locale')
        let t = (key) => DICTIONARIES.en[key] ?? key
        if (locale !== undefined && typeof locale.register === 'function') {
          ctx.effect(() => {
            try {
              const disp = locale.register(NAMESPACE, {
                en: DICTIONARIES.en,
                id: DICTIONARIES.id,
              })
              if (typeof disp === 'function') return disp
            } catch {
              const disposers = [
                locale.register(NAMESPACE, 'en', DICTIONARIES.en),
                locale.register(NAMESPACE, 'id', DICTIONARIES.id),
              ]
              return () => {
                for (const d of disposers) {
                  try {
                    if (typeof d === 'function') d()
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }, 'skills-manager: dictionaries')
          const bound = locale.bind(NAMESPACE)
          t = (key) => {
            const val = bound(key)
            return val && val !== key ? val : (DICTIONARIES.en[key] ?? key)
          }
        }

        // 1. Register in Settings Menu (`settings.section`, order 11)
        ctx.effect(
          () =>
            ctx.slots.inject(SETTINGS_SLOT, () =>
              ctx.slots.register(
                {
                  name: SETTINGS_SLOT,
                  id: SETTINGS_ID,
                  order: 11,
                  label: () => t('settingsSection'),
                },
                () => h(SkillsManagerView, { mode: 'settings', t })
              )
            ),
          'skills-manager: settings section'
        )

        // 2. Register in Right Sidebar Tab Registry & Start Guide
        ctx.effect(() => {
          const sidebarTabs = ctx.sidebarRightTabs ?? ctx.get('sidebarRightTabs')
          if (sidebarTabs !== undefined && typeof sidebarTabs.register === 'function') {
            return sidebarTabs.register({
              id: SIDEBAR_TAB_ID,
              kind: SIDEBAR_TAB_KIND,
              priority: 'extension',
              title: () => t('sidebarTitle'),
              guide: [
                {
                  id: 'skills-manager',
                  order: 45,
                  title: () => t('sidebarTitle'),
                  description: () => t('subtitle'),
                },
              ],
            })
          }
        }, 'skills-manager: sidebar tab registry')

        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.right.pane.tab', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.right.pane.tab',
                  key: SIDEBAR_TAB_ID,
                },
                () => h(SkillsManagerView, { mode: 'sidebar', t })
              )
            ),
          'skills-manager: sidebar body'
        )

        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.right.pane.tab.title', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.right.pane.tab.title',
                  key: SIDEBAR_TAB_ID,
                },
                () => h('span', null, t('sidebarTitle'))
              )
            ),
          'skills-manager: sidebar title'
        )
      },
    }
  },
})
