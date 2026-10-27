/**
 * Client half of the provider-usage bundle.
 *
 * Three integrated UI surfaces:
 * 1. Settings Menu (`settings.section`):
 *    A full, dedicated "Quota & Usage" settings section displaying real-time rate limits,
 *    Active Model Hero Spotlight with 8-segment progress meter, flat sub-provider sections
 *    (9Router, Dattio AI), quota buckets, and reset countdowns.
 * 2. Right Sidebar Tab (`sidebar.right.pane.tab` - Ctrl+Alt+B):
 *    A dedicated sidebar tab for instant monitoring beside your conversation.
 * 3. Composer Dock Pill (`conversation.composer.dock`):
 *    An enriched single-line status pill under the composer with status dot, active model,
 *    inline mini progress bar, tabular percentage, and direct "Show Details" sidebar trigger.
 */

window.__ModuleLoader__.load({
  id: '@local/provider-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NAMESPACE = 'provider-usage'
    const SETTINGS_SLOT = 'settings.section'
    const SETTINGS_ID = 'provider-quota'
    const DOCK_SLOT = 'conversation.composer.dock'
    const DOCK_ID = 'provider-usage'
    const SIDEBAR_TAB_ID = '@local/provider-usage/tab'
    const SIDEBAR_TAB_KIND = 'provider-quota'
    const ROUTE = 'api/provider-usage.quota'
    const POLL_MS = 60000
    const HERO_SEGMENTS = 8

    const DICTIONARIES = {
      en: {
        title: 'Quota & Usage',
        settingsSection: 'Quota & Usage',
        settingsTitle: 'Provider Quota & Rate Limits',
        settingsDesc: 'Monitor real-time token quotas, 5-hour rolling limits, and reset schedules across your active AI providers.',
        sidebarTitle: 'Quota & Limits',
        composerPillBtn: 'Show Details',
        refresh: 'Refresh (Bypass Cache)',
        refreshing: 'Refreshing…',
        loading: 'Checking quota…',
        unavailable: 'Usage unavailable',
        remaining: 'Remaining',
        usagePercent: 'Usage percent',
        used: 'used',
        left: 'left',
        via: 'via',
        resetsIn: 'Resets in',
        resetsInline: 'resets in',
        resetsAt: 'Resets at',
        resetsSoon: 'Resets soon',
        providers: 'providers',
        cached: 'cached',
        prompt: 'Prompt tokens',
        completion: 'Completion tokens',
        cachedTokens: 'Cached tokens',
        requests: 'Requests',
        total: 'Total tokens',
        maxTokens: 'Token limit',
        expires: 'Account expires',
        status: 'Status',
        plan: 'Plan',
        authenticatedKey: 'Authenticated Key',
        activeModel: 'Active Model',
        openSidebarHint: 'Click to open in Sidebar (Ctrl+Alt+B)',
      },
      id: {
        title: 'Kuota & Pemakaian',
        settingsSection: 'Kuota & Pemakaian',
        settingsTitle: 'Kuota & Batasan Provider Model',
        settingsDesc: 'Pantau kuota token langsung, batas durasi 5 jam, dan jadwal reset untuk provider AI yang aktif.',
        sidebarTitle: 'Kuota & Batasan',
        composerPillBtn: 'Lihat Rincian',
        refresh: 'Muat Ulang (Abaikan Cache)',
        refreshing: 'Memuat…',
        loading: 'Memeriksa kuota…',
        unavailable: 'Pemakaian tidak tersedia',
        remaining: 'Sisa',
        usagePercent: 'Persentase pakai',
        used: 'terpakai',
        left: 'sisa',
        via: 'via',
        resetsIn: 'Reset dalam',
        resetsInline: 'reset dalam',
        resetsAt: 'Reset pada',
        resetsSoon: 'Segera reset',
        providers: 'provider',
        cached: 'cache',
        prompt: 'Token prompt',
        completion: 'Token completion',
        cachedTokens: 'Token cache',
        requests: 'Permintaan',
        total: 'Total token',
        maxTokens: 'Batas token',
        expires: 'Akun kedaluwarsa',
        status: 'Status',
        plan: 'Paket',
        authenticatedKey: 'Kunci API',
        activeModel: 'Model Aktif',
        openSidebarHint: 'Klik untuk membuka di Sidebar (Ctrl+Alt+B)',
      },
    }

    const CSS = [
      '/* Motion & Keyframes */',
      '@keyframes dpu-spin{to{transform:rotate(360deg)}}',
      '@keyframes dpu-fade-up{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes dpu-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
      '.dpu-spin{animation:dpu-spin .75s linear infinite}',

      '/* Status Dot */',
      '.dpu-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary,#64748b);transition:background-color .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-dot[data-tone="ok"]{background:var(--dsw-alias-state-success-primary,#2cc985);box-shadow:0 0 8px rgba(44,201,133,.35)}',
      '.dpu-dot[data-tone="warn"]{background:var(--dsw-alias-state-warn-primary,#eab308);box-shadow:0 0 8px rgba(234,179,8,.35)}',
      '.dpu-dot[data-tone="error"]{background:var(--dsw-alias-state-error-primary,#ef4444);box-shadow:0 0 8px rgba(239,68,68,.35)}',

      '/* Composer Dock Pill (Enriched Inline Bar + Tabular Readout) */',
      '.dpu-pill-wrap{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1,#2a3546);background:var(--dsw-alias-bg-layer-1,#1a222d);border-radius:10px;padding:3px 6px 3px 10px;gap:6px;box-sizing:border-box;transition:border-color .18s cubic-bezier(.16,1,.3,1),background-color .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-pill-wrap:hover{border-color:var(--dsw-alias-border-l2,#3b4a61);background:var(--dsw-alias-bg-layer-2,#202a37)}',
      '.dpu-pill-compact{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-primary,#f1f5f9);padding:2px 4px 2px 0;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:8px;cursor:pointer;line-height:18px;white-space:nowrap}',
      '.dpu-pill-compact:active{transform:scale(.99)}',
      '.dpu-pill-model{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#f1f5f9);font-weight:500}',
      '.dpu-pill-bar-track{width:84px;height:6px;border-radius:999px;background:var(--dsw-alias-border-l1,#2e3846);overflow:hidden;flex:0 0 auto;position:relative}',
      '.dpu-pill-bar-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:var(--dsw-alias-state-success-primary,#2cc985);transition:width .22s cubic-bezier(.16,1,.3,1),background-color .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-pill-bar-fill[data-tone="warn"]{background:var(--dsw-alias-state-warn-primary,#eab308)}',
      '.dpu-pill-bar-fill[data-tone="error"]{background:var(--dsw-alias-state-error-primary,#ef4444)}',
      '.dpu-pill-val{font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-label-primary,#f1f5f9);min-width:34px;text-align:right}',
      '.dpu-pill-divider{width:1px;height:16px;background:var(--dsw-alias-border-l1,#2a3546);flex:0 0 auto}',
      '.dpu-pill-refresh{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#94a3b8);width:24px;height:24px;border-radius:6px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .15s ease,background-color .15s ease,transform .15s ease}',
      '.dpu-pill-refresh:hover:not(:disabled){color:var(--dsw-alias-label-primary,#f1f5f9);background:var(--dsw-alias-bg-layer-2,#263244)}',
      '.dpu-pill-refresh:active:not(:disabled){transform:scale(.94)}',
      '.dpu-pill-refresh:disabled{opacity:.4;cursor:default}',

      '/* Full Dashboard (Settings & Sidebar Tab) */',
      '.dpu-dash{display:flex;flex-direction:column;gap:16px;width:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary,#f1f5f9);font-size:13px;line-height:18px;animation:dpu-fade-up .2s cubic-bezier(.16,1,.3,1)}',
      '.dpu-dash-settings{max-width:860px;padding:4px 0}',
      '.dpu-dash-sidebar{padding:12px;overflow-y:auto;height:100%}',
      '.dpu-dash-header{display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,#263040);padding-bottom:10px}',
      '.dpu-dash-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#f1f5f9);letter-spacing:-.01em}',
      '.dpu-dash-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#94a3b8)}',

      '/* Top Switcher & Refresh Toolbar */',
      '.dpu-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dpu-switcher{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dpu-tab{appearance:none;border:1px solid var(--dsw-alias-border-l1,#2a3546);background:var(--dsw-alias-bg-layer-1,#18202c);color:var(--dsw-alias-label-secondary,#94a3b8);font-size:13px;font-weight:500;padding:7px 14px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:all .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-tab:hover{color:var(--dsw-alias-label-primary,#f1f5f9);border-color:var(--dsw-alias-border-l2,#3b4a61);background:var(--dsw-alias-bg-layer-2,#1f2937)}',
      '.dpu-tab[data-active="true"]{background:rgba(59,130,246,.16);color:var(--dsw-alias-label-primary,#ffffff);border-color:var(--dsw-alias-brand-primary,#4b6bfb);font-weight:600;box-shadow:inset 0 0 0 1px rgba(75,107,251,.25)}',
      '.dpu-tab-mark{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;font-size:11px;font-weight:700;background:rgba(99,102,241,.22);color:#818cf8;flex:0 0 auto}',
      '.dpu-tab[data-active="true"] .dpu-tab-mark{background:rgba(75,107,251,.32);color:#93c5fd}',
      '.dpu-tab-meta{opacity:.85;font-weight:400}',
      '.dpu-actions{display:flex;gap:8px;align-items:center}',
      '.dpu-refresh-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,#2e3a4c);background:var(--dsw-alias-bg-layer-1,#1c2430);color:var(--dsw-alias-label-primary,#e2e8f0);font-size:13px;font-weight:500;padding:7px 14px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:all .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-refresh-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,#253040);border-color:var(--dsw-alias-border-l2,#415168)}',
      '.dpu-refresh-btn:active:not(:disabled){transform:scale(.98)}',
      '.dpu-refresh-btn:disabled{opacity:.5;cursor:default}',

      '/* Active Model Hero Spotlight Card */',
      '.dpu-hero-card{display:flex;flex-direction:column;justify-content:space-between;gap:14px;padding:20px 22px;border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1d262b);border:1px solid var(--dsw-alias-border-l1,#2d3a43);box-sizing:border-box}',
      '.dpu-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}',
      '.dpu-hero-head{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dpu-hero-title{font-family:"Sofia Sans Semi Condensed",var(--dsw-alias-font-sans,system-ui,-apple-system,sans-serif);font-size:22px;font-weight:700;line-height:1.15;color:var(--dsw-alias-label-primary,#ffffff);letter-spacing:-.01em}',
      '.dpu-hero-sub{font-size:13px;line-height:1.3;color:var(--dsw-alias-label-secondary,#94a3b8)}',
      '.dpu-hero-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#2b353e);border:1px solid var(--dsw-alias-border-l1,#394652);color:var(--dsw-alias-label-primary,#e2e8f0);font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dpu-hero-metric{display:flex;align-items:baseline;gap:8px;margin-top:2px}',
      '.dpu-hero-pct{font-family:var(--dsw-alias-font-sans,system-ui,-apple-system,sans-serif);font-size:36px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#ffffff);letter-spacing:-.025em}',
      '.dpu-hero-unit{font-size:20px;font-weight:400;line-height:1.1;color:var(--dsw-alias-label-secondary,#94a3b8)}',
      '.dpu-segmented-bar{position:relative;width:100%;height:13px;border-radius:999px;background:var(--dsw-alias-border-l1,#3d454e);overflow:hidden;box-sizing:border-box}',
      '.dpu-segmented-fill-group{display:grid;grid-template-columns:2fr 2fr 2fr 2fr .92fr .92fr;gap:2.5px;height:100%;border-radius:999px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#20292f);transition:width .22s cubic-bezier(.16,1,.3,1)}',
      '.dpu-segment-cell{height:100%;background:var(--dsw-alias-state-success-primary,#31cf8d);transition:background-color .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-segment-cell:first-child{border-top-left-radius:999px;border-bottom-left-radius:999px}',
      '.dpu-segment-cell:last-child{border-top-right-radius:999px;border-bottom-right-radius:999px}',
      '.dpu-segment-cell[data-tone="warn"]{background:var(--dsw-alias-state-warn-primary,#eab308)}',
      '.dpu-segment-cell[data-tone="error"]{background:var(--dsw-alias-state-error-primary,#ef4444)}',

      '/* Flat Sub-Provider Sections */',
      '.dpu-sections-list{display:flex;flex-direction:column;gap:16px}',
      '.dpu-prov-section{display:flex;flex-direction:column;gap:8px}',
      '.dpu-prov-header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dpu-prov-heading{display:inline-flex;align-items:baseline;gap:6px;flex-wrap:wrap;min-width:0}',
      '.dpu-prov-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#ffffff)}',
      '.dpu-prov-sub{font-size:14px;font-weight:400;color:var(--dsw-alias-label-secondary,#8b95a5)}',
      '.dpu-prov-warn-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(234,179,8,.16);border:1px solid rgba(234,179,8,.35);color:var(--dsw-alias-state-warn-primary,#eab308);font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dpu-prov-warn-badge[data-tone="error"]{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.35);color:var(--dsw-alias-state-error-primary,#ef4444)}',
      '.dpu-raw-box{font-size:12px;font-style:italic;color:var(--dsw-alias-label-secondary,#94a3b8);padding:8px 12px;background:var(--dsw-alias-bg-layer-1,#18202c);border:1px solid var(--dsw-alias-border-l1,#2a3546);border-radius:8px}',

      '/* Quota Row Cards */',
      '.dpu-quota-list{display:flex;flex-direction:column;gap:8px}',
      '.dpu-quota-row{display:flex;flex-direction:column;justify-content:center;gap:10px;padding:13px 16px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#18202a);border:1px solid var(--dsw-alias-border-l1,#293443);box-sizing:border-box}',
      '.dpu-bucket-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}',
      '.dpu-bucket-name{font-weight:500;font-size:14px;color:var(--dsw-alias-label-primary,#f1f5f9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpu-bucket-status{font-weight:500;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-state-success-primary,#2cc985)}',
      '.dpu-bucket-status[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary,#eab308)}',
      '.dpu-bucket-status[data-tone="error"]{color:var(--dsw-alias-state-error-primary,#ef4444)}',
      '.dpu-bar-track{position:relative;width:100%;height:7px;border-radius:999px;background:var(--dsw-alias-border-l1,#2a3541);overflow:hidden}',
      '.dpu-bar-track[data-tone="warn"]{background:rgba(234,179,8,.22)}',
      '.dpu-bar-track[data-tone="error"]{background:rgba(239,68,68,.22)}',
      '.dpu-bar-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:var(--dsw-alias-state-success-primary,#2cc985);transition:width .22s cubic-bezier(.16,1,.3,1),background-color .18s cubic-bezier(.16,1,.3,1)}',
      '.dpu-bar-fill[data-tone="warn"]{background:var(--dsw-alias-state-warn-primary,#eab308)}',
      '.dpu-bar-fill[data-tone="error"]{background:var(--dsw-alias-state-error-primary,#ef4444)}',

      '/* Single-provider (Dattio) Stats Grid */',
      '.dpu-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px}',
      '.dpu-stat-box{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#18202a);border:1px solid var(--dsw-alias-border-l1,#293443)}',
      '.dpu-stat-label{font-size:11px;color:var(--dsw-alias-label-secondary,#94a3b8);text-transform:uppercase;letter-spacing:.04em}',
      '.dpu-stat-val{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#f1f5f9)}',

      '/* Footer & Meta */',
      '.dpu-dash-footer{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary,#8b95a5);padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1,#263040);flex-wrap:wrap;gap:6px}',
      '.dpu-error-box{padding:12px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#221a20);border:1px solid rgba(239,68,68,.35);color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;animation:dpu-shake .28s cubic-bezier(.16,1,.3,1)}',
      '.dpu-prov-section,.dpu-stat-box{animation:dpu-fade-up .22s cubic-bezier(.16,1,.3,1) both}',
      '.dpu-prov-section:nth-child(2),.dpu-stat-box:nth-child(2){animation-delay:35ms}',
      '.dpu-prov-section:nth-child(3),.dpu-stat-box:nth-child(3){animation-delay:70ms}',
      '.dpu-prov-section:nth-child(4),.dpu-stat-box:nth-child(4){animation-delay:105ms}',

      '/* Sidebar & Responsive Adaptations */',
      '.dpu-dash-sidebar .dpu-hero-card{padding:14px 16px;gap:10px}',
      '.dpu-dash-sidebar .dpu-hero-title{font-size:17px}',
      '.dpu-dash-sidebar .dpu-hero-pct{font-size:28px}',
      '.dpu-dash-sidebar .dpu-hero-unit{font-size:15px}',
      '@media (max-width:640px){',
      '  .dpu-tab,.dpu-refresh-btn{min-height:44px;padding:8px 12px}',
      '  .dpu-pill-refresh{min-width:36px;min-height:36px}',
      '  .dpu-hero-card{padding:16px}',
      '  .dpu-hero-pct{font-size:30px}',
      '  .dpu-pill-bar-track{width:56px}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .dpu-dash,.dpu-prov-section,.dpu-stat-box,.dpu-error-box,.dpu-spin,.dpu-bar-fill,.dpu-segmented-fill-group,.dpu-segment-cell,.dpu-pill-bar-fill,.dpu-tab,.dpu-refresh-btn{animation:none!important;transition:none!important}',
      '}',
    ].join('\n')

    /** Crisp inline SVG icons (zero external dependencies). */
    function renderRefreshSvg(spinning) {
      return h('svg', {
        width: 18,
        height: 18,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.1,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: spinning ? 'dpu-spin' : undefined,
        'aria-hidden': 'true',
      },
        h('path', { d: 'M3 11a9 9 0 0 1 15.3-5.3L21 8' }),
        h('polyline', { points: '21 3 21 8 16 8' }),
        h('path', { d: 'M21 13a9 9 0 0 1-15.3 5.3L3 16' }),
        h('polyline', { points: '3 21 3 16 8 16' })
      )
    }

    function renderProviderMarkSvg(idOrLabel) {
      const s = String(idOrLabel || '').toLowerCase()
      if (s.includes('9router') || s.startsWith('9')) {
        return h('svg', {
          width: 24,
          height: 26,
          viewBox: '0 0 24 26',
          fill: 'none',
          className: 'dpu-tab-svg-mark',
          'aria-hidden': 'true',
        },
          h('circle', { cx: 12, cy: 10, r: 6, stroke: '#5c82f6', strokeWidth: 3.6 }),
          h('path', { d: 'M18 10v12', stroke: '#5c82f6', strokeWidth: 3.6, strokeLinecap: 'round' }),
          h('path', { d: 'M7 21h6', stroke: '#4c6ee0', strokeWidth: 3.4, strokeLinecap: 'round' })
        )
      }
      if (s.includes('dattio') || s.startsWith('d')) {
        return h('svg', {
          width: 22,
          height: 25,
          viewBox: '0 0 22 25',
          fill: 'none',
          className: 'dpu-tab-svg-mark',
          'aria-hidden': 'true',
        },
          h('path', { d: 'M2 2.5h3.5a4.5 4.5 0 0 1 0 9H2v-9z', fill: '#7c5cff' }),
          h('path', { d: 'M2 13.5h3.5a4.5 4.5 0 0 1 0 9H2v-9z', fill: '#8b5cf6' }),
          h('path', { d: 'M9.5 2.5c6.5 0 10.5 4.2 10.5 10s-4 10-10.5 10c2.8-2.6 4-6 4-10s-1.2-7.4-4-10z', fill: '#6366f1' })
        )
      }
      const ch = String(idOrLabel || '?').charAt(0).toUpperCase()
      return h('span', { className: 'dpu-tab-mark', 'aria-hidden': 'true' }, ch)
    }

    function renderClockSvg() {
      return h('svg', {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('polyline', { points: '12 7 12 12 15.5 14' })
      )
    }

    function renderWarnSvg() {
      return h('svg', {
        width: 17,
        height: 21,
        viewBox: '0 0 20 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M8.6 3.2 1.8 18.5a1.6 1.6 0 0 0 1.5 2.3h13.4a1.6 1.6 0 0 0 1.5-2.3L11.4 3.2a1.6 1.6 0 0 0-2.8 0z' }),
        h('line', { x1: 10, y1: 8.5, x2: 10, y2: 14 }),
        h('circle', { cx: 10, cy: 17.5, r: 0.9, fill: 'currentColor', stroke: 'none' })
      )
    }

    /** Round a scaled value and drop trailing zeros. */
    function trimScaled(value) {
      const text = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)
      return text.includes('.') ? text.replace(/\.?0+$/, '') : text
    }

    /** Compact token count: 4923265 becomes "4.92M". */
    function compact(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const magnitude = Math.abs(value)
      if (magnitude >= 1e9) return `${trimScaled(value / 1e9)}B`
      if (magnitude >= 1e6) return `${trimScaled(value / 1e6)}M`
      if (magnitude >= 1e3) return `${trimScaled(value / 1e3)}K`
      return String(Math.round(value))
    }

    /** Full number with grouping for the expanded readout. */
    function exact(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      try {
        return value.toLocaleString()
      } catch {
        return String(Math.round(value))
      }
    }

    /** Percentage text with 1 decimal for sub-100 telemetry clarity. */
    function percentText(value, keepOneDecimal) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const clamped = Math.max(0, value)
      if (keepOneDecimal && clamped < 100) {
        return `${clamped.toFixed(1)}%`
      }
      const text = clamped >= 10 ? clamped.toFixed(1) : clamped.toFixed(2)
      return `${text.includes('.') ? text.replace(/\.?0+$/, '') : text}%`
    }

    /** Tone for percentage remaining (9Router: high is good). */
    function toneForRemaining(remainingPct) {
      if (typeof remainingPct !== 'number' || !Number.isFinite(remainingPct)) return 'ok'
      if (remainingPct < 25) return 'error'
      if (remainingPct < 60) return 'warn'
      return 'ok'
    }

    /** Tone for percentage used (Dattio: low is good). */
    function toneForUsed(usedPct) {
      if (typeof usedPct !== 'number' || !Number.isFinite(usedPct)) return 'ok'
      if (usedPct >= 90) return 'error'
      if (usedPct >= 70) return 'warn'
      return 'ok'
    }

    /** Short local date for an ISO timestamp. */
    function shortDate(value) {
      if (typeof value !== 'string' || value.length === 0) return undefined
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return value
      try {
        return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      } catch {
        return value
      }
    }

    /** Extract relative duration string (e.g. "4h 8m") from resetAt or fallbackResetIn. */
    function extractResetDuration(resetAt, fallbackResetIn) {
      if (typeof resetAt === 'string' && resetAt.length > 0) {
        const target = new Date(resetAt).getTime()
        if (Number.isFinite(target)) {
          const diff = target - Date.now()
          if (diff <= 0) return null
          const hours = Math.floor(diff / (1000 * 60 * 60))
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          if (hours >= 24) {
            const days = Math.floor(hours / 24)
            return `${days}d ${hours % 24}h`
          }
          if (hours > 0) return `${hours}h ${mins}m`
          return `${mins}m`
        }
      }
      if (typeof fallbackResetIn === 'string' && fallbackResetIn.length > 0) {
        return fallbackResetIn.replace(/^resets\s+in\s+/i, '').trim()
      }
      return null
    }

    /** Localized relative reset duration from an ISO timestamp. */
    function formatLocalizedReset(resetAt, fallbackResetIn, t, inlineLower) {
      const prefix = t(inlineLower ? 'resetsInline' : 'resetsIn')
      const dur = extractResetDuration(resetAt, fallbackResetIn)
      if (dur) return `${prefix} ${dur}`
      if (typeof resetAt === 'string' && resetAt.length > 0) {
        const target = new Date(resetAt).getTime()
        if (Number.isFinite(target) && target - Date.now() <= 0) {
          return t('resetsSoon')
        }
      }
      return null
    }

    /** Render the segmented horizontal progress meter inside Hero Spotlight Card. */
    function renderSegmentedBar(pctValue, tone) {
      const clamped = typeof pctValue === 'number' && Number.isFinite(pctValue)
        ? Math.min(100, Math.max(0, pctValue))
        : 0
      const cells = []
      for (let i = 0; i < 6; i++) {
        cells.push(h('div', { key: i, className: 'dpu-segment-cell', 'data-tone': tone }))
      }
      return h('div', {
        className: 'dpu-segmented-bar',
        role: 'progressbar',
        'aria-valuenow': Math.round(clamped),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      },
        clamped > 0
          ? h('div', {
              className: 'dpu-segmented-fill-group',
              style: { width: `${clamped.toFixed(1)}%` },
            }, ...cells)
          : null
      )
    }

    /** Absolute quota route URL resolved against document.baseURI. */
    function routeUrl(providerId, force) {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string'
        ? document.baseURI
        : window.location.href
      const url = new URL(ROUTE, base)
      if (providerId) url.searchParams.set('provider', providerId)
      if (force) url.searchParams.set('refresh', '1')
      return url.href
    }

    /** Read snapshot from Host half. */
    async function readUsage(providerId, force, signal) {
      const response = await fetch(routeUrl(providerId, force), {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal,
      })
      if (!response.ok) throw new Error(`usage request failed (${response.status})`)
      return await response.json()
    }

    /**
     * Shared module-level quota state store so ComposerPill, Right Sidebar,
     * and Settings share one polling loop and stay synchronized on manual refresh
     * or provider switching.
     */
    const quotaStore = {
      snapshot: null,
      failure: null,
      busy: true,
      selectedProvider: null,
      pollMs: POLL_MS,
      listeners: new Set(),
      controller: null,
      reqSeq: 0,
      timer: null,
    }

    function notifyStore() {
      for (const listener of quotaStore.listeners) {
        try {
          listener()
        } catch {
          /* ignore */
        }
      }
    }

    function restartStoreTimer() {
      if (quotaStore.timer !== null) {
        clearInterval(quotaStore.timer)
        quotaStore.timer = null
      }
      if (quotaStore.listeners.size === 0) return
      quotaStore.timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        loadStore(quotaStore.selectedProvider, false)
      }, quotaStore.pollMs)
    }

    async function loadStore(targetProv, force) {
      const seq = ++quotaStore.reqSeq
      if (quotaStore.controller) {
        try {
          quotaStore.controller.abort()
        } catch {
          /* ignore */
        }
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      quotaStore.controller = controller
      quotaStore.busy = true
      notifyStore()

      try {
        const data = await readUsage(targetProv, force, controller ? controller.signal : undefined)
        if (seq !== quotaStore.reqSeq || controller?.signal?.aborted) return
        if (data !== null && typeof data === 'object' && data.ok === true) {
          quotaStore.snapshot = data
          quotaStore.failure = null
          const nextPollMs = typeof data.refreshSeconds === 'number' && data.refreshSeconds >= 5
            ? data.refreshSeconds * 1000
            : POLL_MS
          if (nextPollMs !== quotaStore.pollMs) {
            quotaStore.pollMs = nextPollMs
            restartStoreTimer()
          }
        } else {
          quotaStore.failure = {
            message: typeof data?.error === 'string' ? data.error : null,
            code: typeof data?.code === 'string' ? data.code : 'UNKNOWN',
          }
        }
      } catch (error) {
        if (seq !== quotaStore.reqSeq || controller?.signal?.aborted) return
        quotaStore.failure = {
          message: error instanceof Error ? error.message : String(error),
          code: 'TRANSPORT',
        }
      } finally {
        if (seq === quotaStore.reqSeq) {
          quotaStore.busy = false
          quotaStore.controller = null
          notifyStore()
        }
      }
    }

    function selectProviderInStore(nextProvider) {
      if (quotaStore.selectedProvider === nextProvider && quotaStore.snapshot?.provider === nextProvider) return
      quotaStore.selectedProvider = nextProvider
      loadStore(nextProvider, false)
    }

    /**
     * Shared hook subscribing UI surfaces to the singleton quotaStore.
     */
    function useQuotaState() {
      const [, setTick] = React.useState(0)

      React.useEffect(() => {
        const listener = () => setTick((n) => n + 1)
        const wasEmpty = quotaStore.listeners.size === 0
        quotaStore.listeners.add(listener)
        if (wasEmpty) {
          loadStore(quotaStore.selectedProvider, false)
          restartStoreTimer()
        }
        return () => {
          quotaStore.listeners.delete(listener)
          if (quotaStore.listeners.size === 0) {
            if (quotaStore.timer !== null) {
              clearInterval(quotaStore.timer)
              quotaStore.timer = null
            }
            if (quotaStore.controller !== null) {
              try {
                quotaStore.controller.abort()
              } catch {
                /* ignore */
              }
              quotaStore.controller = null
            }
          }
        }
      }, [])

      return {
        snapshot: quotaStore.snapshot,
        failure: quotaStore.failure,
        busy: quotaStore.busy,
        selectedProvider: quotaStore.selectedProvider,
        setSelectedProvider: selectProviderInStore,
        refresh: (force) => loadStore(quotaStore.selectedProvider, Boolean(force)),
      }
    }

    /**
     * Full Quota & Rate Limit Dashboard (rendered in Settings and in the Right Sidebar).
     */
    function QuotaDashboard({ mode, t }) {
      const { snapshot, failure, busy, selectedProvider, setSelectedProvider, refresh } = useQuotaState()
      const isSettings = mode === 'settings'
      const live = snapshot !== null && snapshot.ok === true
      const isAggregated = live && snapshot.type === 'aggregated'

      const configured = Array.isArray(snapshot?.configuredProviders) ? snapshot.configuredProviders : []

      // Top Toolbar: Provider tabs + Refresh
      const switcherTabs = configured.length > 1 ? h('div', { key: 'sw', className: 'dpu-switcher' },
        configured.map((p) => {
          const active = (selectedProvider === p.id) || (!selectedProvider && snapshot?.provider === p.id)
          const label = p.displayName || p.id
          const provCount = active && isAggregated && typeof snapshot?.totalProviders === 'number' && snapshot.totalProviders > 0
            ? `${snapshot.totalProviders} ${t('providers')}`
            : (typeof p.providerCount === 'number' ? `${p.providerCount} ${t('providers')}` : null)

          return h('button', {
            key: p.id,
            type: 'button',
            className: 'dpu-tab',
            'data-active': active ? 'true' : 'false',
            onClick: () => {
              if (p.id !== snapshot?.provider || selectedProvider !== p.id) setSelectedProvider(p.id)
            },
          },
            renderProviderMarkSvg(p.id || label),
            h('span', null, label),
            provCount ? h('span', { className: 'dpu-tab-meta' }, `· ${provCount}`) : null
          )
        })
      ) : null

      const refreshAction = h('div', { key: 'act', className: 'dpu-actions' },
        h('button', {
          type: 'button',
          className: 'dpu-refresh-btn',
          disabled: busy,
          onClick: () => refresh(true),
        },
          renderRefreshSvg(busy),
          h('span', null, busy ? t('refreshing') : t('refresh'))
        )
      )

      const toolbar = h('div', { key: 'bar', className: 'dpu-toolbar' }, switcherTabs, refreshAction)

      // Content Body
      let content = null
      if (failure) {
        content = h('div', { key: 'err', className: 'dpu-error-box' }, failure.message || t('unavailable'))
      } else if (!live) {
        content = h('div', { key: 'load', style: { padding: '24px 0', opacity: 0.7 } }, t('loading'))
      } else if (isAggregated) {
        // 1. Active Model Hero Spotlight Card
        const hl = snapshot.highlight || {}
        const heroPctVal = typeof hl.remainingPercentage === 'number' ? hl.remainingPercentage : 100
        const heroTone = toneForRemaining(heroPctVal)
        const heroTitle = hl.heroTitle || hl.displayName || snapshot.currentModel || snapshot.displayName || 'Active Model'
        const viaProvider = [snapshot.displayName || snapshot.provider, hl.provider].filter(Boolean).join(' / ')
        const heroResetText = formatLocalizedReset(hl.resetAt, hl.resetIn, t, false)

        const heroCard = h('div', { key: 'hero', className: 'dpu-hero-card' },
          h('div', { className: 'dpu-hero-top' },
            h('div', { className: 'dpu-hero-head' },
              h('div', { className: 'dpu-hero-title' }, heroTitle),
              viaProvider ? h('div', { className: 'dpu-hero-sub' }, `${t('via')} ${viaProvider}`) : null
            ),
            heroResetText ? h('div', { className: 'dpu-hero-badge' },
              renderClockSvg(),
              h('span', null, heroResetText)
            ) : null
          ),
          h('div', { className: 'dpu-hero-metric' },
            h('span', { className: 'dpu-hero-pct' }, percentText(heroPctVal, true)),
            h('span', { className: 'dpu-hero-unit' }, t('remaining'))
          ),
          renderSegmentedBar(heroPctVal, heroTone)
        )

        // 2. Flat Sub-Provider Sections
        const sections = (snapshot.providers || []).map((prov) => {
          const sectionItems = []
          const subLabel = prov.plan || prov.email || null

          // Check if any bucket in this sub-provider has a warning/error reset to surface in header
          const warnBucket = Array.isArray(prov.quotas)
            ? prov.quotas.find((q) => {
                const tone = toneForRemaining(q.remainingPercentage)
                return tone === 'warn' && (q.resetAt || q.resetIn)
              })
            : null
          const headerWarnReset = warnBucket
            ? formatLocalizedReset(warnBucket.resetAt, warnBucket.resetIn, t, false)
            : null

          sectionItems.push(
            h('div', { key: 'hdr', className: 'dpu-prov-header' },
              h('div', { className: 'dpu-prov-heading' },
                h('span', { className: 'dpu-prov-title' }, prov.name),
                subLabel ? h('span', { className: 'dpu-prov-sub' }, `· ${subLabel}`) : null
              ),
              headerWarnReset
                ? h('div', { className: 'dpu-prov-warn-badge', 'data-tone': 'warn' },
                    renderWarnSvg(),
                    h('span', null, headerWarnReset)
                  )
                : null
            )
          )

          if (prov.rawMessage) {
            sectionItems.push(h('div', { key: 'raw', className: 'dpu-raw-box' }, prov.rawMessage))
          }

          if (Array.isArray(prov.quotas) && prov.quotas.length > 0) {
            const rows = prov.quotas.map((q) => {
              const qTone = toneForRemaining(q.remainingPercentage)
              const qFill = typeof q.remainingPercentage === 'number'
                ? `${Math.min(100, Math.max(0, q.remainingPercentage))}%`
                : '100%'

              const inlineReset = formatLocalizedReset(q.resetAt, q.resetIn, t, true)
              let statusText = ''
              if (typeof q.statusText === 'string' && q.statusText.length > 0) {
                statusText = q.statusText
              } else if (q.remainingPercentage !== undefined) {
                const pctStr = percentText(q.remainingPercentage, true)
                if (qTone === 'warn' && inlineReset) {
                  statusText = `${pctStr} ${inlineReset}`
                } else if (qTone === 'error' && inlineReset) {
                  statusText = `${pctStr} ${t('left')} ${inlineReset}`
                } else {
                  statusText = `${pctStr} ${t('left')}`
                }
              } else if (q.remaining !== undefined && q.total !== undefined) {
                statusText = `${exact(q.remaining)} / ${exact(q.total)}`
              }

              return h('div', { key: q.key || q.displayName, className: 'dpu-quota-row' },
                h('div', { className: 'dpu-bucket-head' },
                  h('span', { className: 'dpu-bucket-name', title: q.displayName }, q.displayName),
                  h('span', { className: 'dpu-bucket-status', 'data-tone': qTone }, statusText)
                ),
                h('div', { className: 'dpu-bar-track', 'data-tone': qTone },
                  h('div', { className: 'dpu-bar-fill', 'data-tone': qTone, style: { width: qFill } })
                )
              )
            })
            sectionItems.push(h('div', { key: 'rows', className: 'dpu-quota-list' }, ...rows))
          }

          return h('div', { key: prov.id || prov.name, className: 'dpu-prov-section' }, ...sectionItems)
        })

        content = h('div', { key: 'agg-wrap', className: 'dpu-sections-list' }, heroCard, ...sections)
      } else {
        // Dattio AI / Single-provider View with Hero Spotlight + Telemetry Grid
        const usage = snapshot.usage || {}
        const usedPct = typeof snapshot.usagePercent === 'number' ? snapshot.usagePercent : 0
        const remainingPct = Math.max(0, 100 - usedPct)
        const heroTone = snapshot.status === 'exceeded' ? 'error' : toneForUsed(usedPct)
        const expText = snapshot.expiresAt ? `${t('expires')}: ${shortDate(snapshot.expiresAt)}` : null

        const heroCard = h('div', { key: 'hero-single', className: 'dpu-hero-card' },
          h('div', { className: 'dpu-hero-top' },
            h('div', { className: 'dpu-hero-head' },
              h('div', { className: 'dpu-hero-title' }, snapshot.currentModel || snapshot.displayName || 'Dattio AI'),
              h('div', { className: 'dpu-hero-sub' }, `${t('via')} ${snapshot.displayName || snapshot.provider || 'Dattio AI'}`)
            ),
            expText ? h('div', { className: 'dpu-hero-badge' },
              renderClockSvg(),
              h('span', null, expText)
            ) : null
          ),
          h('div', { className: 'dpu-hero-metric' },
            h('span', { className: 'dpu-hero-pct' }, percentText(remainingPct, true)),
            h('span', { className: 'dpu-hero-unit' }, t('remaining'))
          ),
          renderSegmentedBar(remainingPct, heroTone)
        )

        const statBoxes = [
          { label: t('maxTokens'), val: exact(snapshot.maxTokens) },
          { label: t('remaining'), val: exact(snapshot.remainingTokens) },
          { label: t('usagePercent'), val: `${percentText(snapshot.usagePercent)} ${t('used')}` },
          { label: t('total'), val: exact(usage.totalTokens) },
          { label: t('prompt'), val: exact(usage.promptTokens) },
          { label: t('completion'), val: exact(usage.completionTokens) },
          { label: t('cachedTokens'), val: exact(usage.cachedTokens) },
          { label: t('requests'), val: exact(usage.requests) },
        ]
        if (snapshot.expiresAt) statBoxes.push({ label: t('expires'), val: shortDate(snapshot.expiresAt) })
        if (snapshot.status) statBoxes.push({ label: t('status'), val: snapshot.status })

        const statsGrid = h('div', { key: 'sgrid', className: 'dpu-stats-grid' },
          statBoxes.map((b, i) => h('div', { key: i, className: 'dpu-stat-box' },
            h('span', { className: 'dpu-stat-label' }, b.label),
            h('span', { className: 'dpu-stat-val' }, b.val)
          ))
        )

        content = h('div', { key: 'single-wrap', className: 'dpu-sections-list' }, heroCard, statsGrid)
      }

      // Footer
      const footerParts = []
      if (snapshot?.authenticatedKey) footerParts.push(`${t('authenticatedKey')}: ${snapshot.authenticatedKey}`)
      if (snapshot?.cached && typeof snapshot.cacheAgeSeconds === 'number') {
        footerParts.push(`${t('cached')} (${snapshot.cacheAgeSeconds}s)`)
      }
      if (snapshot?.currentModel) footerParts.push(`${t('activeModel')}: ${snapshot.currentModel}`)

      const footer = footerParts.length > 0 ? h('div', { key: 'ftr', className: 'dpu-dash-footer' },
        h('span', null, footerParts.slice(0, 2).join(' · ')),
        footerParts[2] ? h('span', null, footerParts[2]) : null
      ) : null

      // Header for Settings mode
      const header = isSettings ? h('div', { key: 'hdr', className: 'dpu-dash-header' },
        h('div', { className: 'dpu-dash-title' }, t('settingsTitle')),
        h('div', { className: 'dpu-dash-desc' }, t('settingsDesc'))
      ) : null

      return h('div', {
        className: `dpu-dash ${isSettings ? 'dpu-dash-settings' : 'dpu-dash-sidebar'}`,
      }, header, toolbar, content, footer)
    }

    /**
     * Enriched Ambient Composer Dock Pill (Status Dot + Active Model + Inline Progress Bar + Tabular % + SVG Refresh).
     */
    function ComposerPill({ t, openInSidebar }) {
      const { snapshot, failure, busy, refresh } = useQuotaState()
      const live = snapshot !== null && snapshot.ok === true
      const isAggregated = live && snapshot.type === 'aggregated'

      let dotTone = 'ok'
      let modelLabel = t('title')
      let barPct = 0
      let valText = '···'

      if (live) {
        if (isAggregated) {
          const hl = snapshot.highlight
          const remainingPct = typeof hl?.remainingPercentage === 'number' ? hl.remainingPercentage : 100
          dotTone = toneForRemaining(remainingPct)
          modelLabel = hl?.displayName || snapshot.currentModel || snapshot.displayName || '9Router'
          barPct = Math.min(100, Math.max(0, remainingPct))
          valText = percentText(remainingPct, true)
        } else {
          const usedPct = snapshot.usagePercent
          dotTone = toneForUsed(usedPct)
          if (snapshot.status === 'exceeded') dotTone = 'error'
          const remainingPct = typeof usedPct === 'number' ? Math.max(0, 100 - usedPct) : 100
          modelLabel = snapshot.currentModel || snapshot.displayName || 'Dattio AI'
          barPct = Math.min(100, Math.max(0, remainingPct))
          valText = typeof usedPct === 'number' ? percentText(remainingPct, true) : '—'
        }
      } else if (failure) {
        dotTone = 'error'
        modelLabel = t('unavailable')
        barPct = 0
        valText = '!'
      }

      // Build rich multi-line tooltip
      let tooltip = t('loading')
      if (failure) {
        tooltip = `${t('title')}: ${failure.message || t('unavailable')}\n\n${t('openSidebarHint')}`
      } else if (live) {
        if (isAggregated) {
          const hl = snapshot.highlight
          const provName = snapshot.displayName || snapshot.provider || '9Router'
          const bucketName = hl?.displayName || t('title')
          const pct = typeof hl?.remainingPercentage === 'number' ? `${percentText(hl.remainingPercentage, true)} ${t('left')}` : ''
          const localizedReset = formatLocalizedReset(hl?.resetAt, hl?.resetIn, t, false)
          const reset = localizedReset
            ? `\n${localizedReset}`
            : (hl?.resetAt ? `\n${t('resetsAt')}: ${shortDate(hl.resetAt)}` : '')
          const totalProvs = snapshot.totalProviders ? ` (${snapshot.totalProviders} ${t('providers')})` : ''
          tooltip = `${provName}${totalProvs}\n${bucketName}: ${pct}${reset}\n\n${t('openSidebarHint')}`
        } else {
          const provName = snapshot.displayName || snapshot.provider || 'Dattio AI'
          const used = typeof snapshot.usagePercent === 'number' ? `${percentText(snapshot.usagePercent)} ${t('used')}` : ''
          const rem = typeof snapshot.remainingTokens === 'number' ? `\n${compact(snapshot.remainingTokens)} / ${compact(snapshot.maxTokens)} ${t('left')}` : ''
          const exp = snapshot.expiresAt ? `\n${t('expires')}: ${shortDate(snapshot.expiresAt)}` : ''
          tooltip = `${provName}\n${used}${rem}${exp}\n\n${t('openSidebarHint')}`
        }
      }

      return h('div', { className: 'dpu-pill-wrap' },
        h('button', {
          key: 'btn',
          type: 'button',
          className: 'dpu-pill-compact',
          title: tooltip,
          'aria-label': t('composerPillBtn'),
          onClick: (e) => {
            e.preventDefault()
            openInSidebar()
          },
        },
          h('span', { className: 'dpu-dot', 'data-tone': dotTone }),
          h('span', { className: 'dpu-pill-model' }, modelLabel),
          h('span', { className: 'dpu-pill-bar-track', 'aria-hidden': 'true' },
            h('span', {
              className: 'dpu-pill-bar-fill',
              'data-tone': dotTone,
              style: { width: `${barPct}%` },
            })
          ),
          h('span', { className: 'dpu-pill-val' }, valText)
        ),
        h('span', { className: 'dpu-pill-divider', 'aria-hidden': 'true' }),
        h('button', {
          key: 'ref',
          type: 'button',
          className: 'dpu-pill-refresh',
          title: t('refresh'),
          'aria-label': t('refresh'),
          disabled: busy,
          onClick: (e) => {
            e.preventDefault()
            refresh(true)
          },
        }, renderRefreshSvg(busy))
      )
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        // Inject shared stylesheet once into document.head
        ctx.effect(() => {
          if (typeof document === 'undefined' || !document.head) return
          let styleEl = document.getElementById('dpu-shared-styles')
          let created = false
          if (!styleEl) {
            styleEl = document.createElement('style')
            styleEl.id = 'dpu-shared-styles'
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
        }, 'provider-usage: styles')

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
                for (const dispose of disposers) {
                  try {
                    if (typeof dispose === 'function') dispose()
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }, 'provider-usage: dictionaries')
          const bound = locale.bind(NAMESPACE)
          t = (key) => {
            const val = bound(key)
            return val && val !== key ? val : (DICTIONARIES.en[key] ?? key)
          }
        }

        // Action to open details in the Right Sidebar (Ctrl+Alt+B)
        const openInSidebar = () => {
          const sidebar = ctx.sidebarRight ?? ctx.get('sidebarRight')
          if (sidebar !== undefined && typeof sidebar.openTab === 'function') {
            try {
              sidebar.openTab(SIDEBAR_TAB_KIND)
              return
            } catch (err) {
              console.error('[provider-usage] sidebar.openTab failed:', err)
              try {
                sidebar.openTab('guide')
              } catch {
                /* ignore */
              }
            }
          }
        }

        // 1. Register in Right Sidebar Tab Registry (Ctrl+Alt+B & Start Guide)
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
                  id: 'quota',
                  order: 50,
                  title: () => t('sidebarTitle'),
                  description: () => t('settingsDesc'),
                },
              ],
            })
          }
        }, 'provider-usage: sidebar tab registry')

        // 2. Register Tab Body in keyed slot `sidebar.right.pane.tab`
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: SIDEBAR_TAB_ID,
        }, () => h(QuotaDashboard, { mode: 'sidebar', t }))), 'provider-usage: sidebar body')

        // 3. Register Tab Title in keyed slot `sidebar.right.pane.tab.title`
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: SIDEBAR_TAB_ID,
        }, () => h('span', null, t('sidebarTitle')))), 'provider-usage: sidebar title')

        // 4. Register new Menu in Settings (`settings.section`)
        ctx.effect(() => ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register({
          name: SETTINGS_SLOT,
          id: SETTINGS_ID,
          order: 12,
          label: () => t('settingsSection'),
        }, () => h(QuotaDashboard, { mode: 'settings', t }))), 'provider-usage: settings section')

        // 5. Register Compact, Non-broken Pill in Composer Dock (`conversation.composer.dock`)
        ctx.effect(() => ctx.slots.inject(DOCK_SLOT, () => ctx.slots.register({
          name: DOCK_SLOT,
          id: DOCK_ID,
          order: 2,
          label: () => t('title'),
        }, () => h(ComposerPill, { t, openInSidebar }))), 'provider-usage: composer dock')
      },
    }
  },
})
