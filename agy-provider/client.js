/**
 * @local/agy-provider — Client Module for DeepSeek Harness
 *
 * Renders the Antigravity CLI (`agy`) Multi-Account Login & Active Account Switcher Card
 * directly inside `Settings -> Models` (`settings.models.footer` slot).
 *
 * Features:
 * - Add / Sign in with multiple Google accounts via Antigravity CLI OAuth (`+ Add Account`)
 *   with automatic browser launch + inline authorization code verification
 * - Sync existing terminal CLI session (`Sync CLI`)
 * - Toggle which account is active (swaps system keyring credential & refreshes DSH models)
 * - Master toggle switch to enable/disable all `Antigravity CLI (agy)` models in DSH
 * - Bilingual UI (`en` & `id`), `--dsw-alias-*` theme tokens, and `/impeccable animate` motion
 */

window.__ModuleLoader__.load({
  id: '@local/agy-provider',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState, useCallback, useRef } = React

    const ROUTE = 'api/agy-provider.accounts'
    const LOCALE_NS = 'agyProvider'
    const STYLE_ID = 'dsh-agy-provider-styles-v2'

    const DICTIONARIES = {
      en: {
        title: 'Antigravity CLI (agy)',
        oauthTag: 'CLI OAuth',
        signedIn: 'Signed in',
        disabledStatus: 'Disabled',
        notSignedIn: 'Not signed in',
        addAccount: '+ Add Account',
        syncCli: 'Sync CLI',
        syncing: 'Syncing...',
        cancelLogin: 'Cancel',
        openBrowserBtn: 'Open Google Sign-In',
        codePlaceholder: 'Paste authorization code from browser here...',
        submitCodeBtn: 'Verify & Sign In',
        submittingCode: 'Verifying...',
        loginPendingTitle: 'Complete Google Sign-In in your browser',
        loginPendingHint: 'Sign in with your Google account in the opened browser tab, then paste the authorization code below (or click Cancel to keep your current account).',
        accountsHeader: 'Saved Accounts',
        activeBadge: 'Active',
        pausedBadge: 'Inactive',
        useAccount: 'Set Active',
        removeAccount: 'Delete',
        emptyAccounts: 'No Antigravity CLI account connected yet. Click "+ Add Account" to sign in with Google, or "Sync CLI" if you already signed in via terminal.',
        modelsVisibleNote: 'Models active in selector: Standard (DSH Bridge) & [agy] (Autonomous CLI Agent).',
        modelsHiddenNote: 'Models hidden from selector until an account is signed in and toggled ON.',
        masterToggleLabel: 'Toggle Antigravity CLI provider models',
        accountToggleLabel: 'Toggle active state for account',
      },
      id: {
        title: 'Antigravity CLI (agy)',
        oauthTag: 'OAuth CLI',
        signedIn: 'Sudah masuk',
        disabledStatus: 'Nonaktif',
        notSignedIn: 'Belum masuk',
        addAccount: '+ Tambah Akun',
        syncCli: 'Sinkron CLI',
        syncing: 'Menyinkronkan...',
        cancelLogin: 'Batal',
        openBrowserBtn: 'Buka Login Google',
        codePlaceholder: 'Tempel kode otorisasi dari browser di sini...',
        submitCodeBtn: 'Verifikasi & Masuk',
        submittingCode: 'Memverifikasi...',
        loginPendingTitle: 'Selesaikan Login Google di browser Anda',
        loginPendingHint: 'Login dengan akun Google di tab browser yang terbuka, lalu tempel kode otorisasi di bawah ini (atau klik Batal untuk tetap memakai akun saat ini).',
        accountsHeader: 'Daftar Akun Tersimpan',
        activeBadge: 'Aktif',
        pausedBadge: 'Nonaktif',
        useAccount: 'Aktifkan',
        removeAccount: 'Hapus',
        emptyAccounts: 'Belum ada akun Antigravity CLI yang terhubung. Klik "+ Tambah Akun" untuk login Google baru, atau "Sinkron CLI" jika sudah login di terminal.',
        modelsVisibleNote: 'Model tampil di pemilih model: Standar (DSH Bridge) & [agy] (Agen Otonom CLI).',
        modelsHiddenNote: 'Model disembunyikan dari pemilih model sampai ada akun yang login dan diaktifkan (ON).',
        masterToggleLabel: 'Aktifkan atau nonaktifkan model Antigravity CLI',
        accountToggleLabel: 'Ubah status aktif untuk akun',
      },
    }

    /** Resolve relative API route against document.baseURI (matching @local/provider-usage). */
    function routeUrl(sync) {
      const base =
        typeof document !== 'undefined' && typeof document.baseURI === 'string'
          ? document.baseURI
          : window.location.href
      const url = new URL(ROUTE, base)
      if (sync) url.searchParams.set('sync', '1')
      return url.href
    }

    function ensureStylesInjected() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
        @keyframes agyCardEntrance {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agyPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.88); }
        }
        .agy-settings-card {
          border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
          background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2));
          border-radius: var(--dsw-radius-xl, 12px);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          color: var(--dsw-alias-label-primary);
          animation: agyCardEntrance 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .agy-head {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .agy-identity {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          flex-wrap: wrap;
        }
        .agy-name {
          color: var(--dsw-alias-label-primary);
          font-size: 14px;
          font-weight: 500;
          line-height: 22px;
        }
        .agy-tag {
          border: 0.5px solid var(--dsw-alias-border-l3);
          border-radius: var(--dsw-radius-xs, 4px);
          color: var(--dsw-alias-label-secondary);
          padding: 1px 6px;
          font-size: 11px;
          line-height: 16px;
          flex: none;
        }
        .agy-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          line-height: 20px;
          flex: none;
        }
        .agy-status-ok {
          color: var(--dsw-alias-state-success-primary, #22c55e);
        }
        .agy-status-warn {
          color: var(--dsw-alias-label-tertiary);
        }
        .agy-status-err {
          color: var(--dsw-alias-state-error-primary, #ef4444);
        }
        .agy-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          flex: none;
        }
        .agy-dot-ok {
          background: var(--dsw-alias-state-success-primary, #22c55e);
        }
        .agy-dot-warn {
          background: var(--dsw-alias-label-tertiary);
        }
        .agy-dot-err {
          background: var(--dsw-alias-state-error-primary, #ef4444);
        }
        .agy-dot-pulse {
          background: var(--dsw-alias-state-business-primary, #3b82f6);
          animation: agyPulseDot 1.2s ease-in-out infinite;
        }
        .agy-actions {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .agy-btn {
          box-sizing: border-box;
          border-radius: var(--dsw-radius-sm, 6px);
          height: 28px;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          line-height: 18px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 0.5px solid var(--dsw-alias-border-l3);
          color: var(--dsw-alias-label-primary);
          background: transparent;
          transition: background 140ms cubic-bezier(0.16, 1, 0.3, 1), transform 100ms ease;
          white-space: nowrap;
        }
        .agy-btn:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-interactive-bg-hover));
        }
        .agy-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .agy-btn:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .agy-btn-primary {
          background: var(--dsw-alias-button-primary-fill, #3b82f6);
          border-color: transparent;
          color: var(--dsw-alias-label-primary-foreground, #ffffff);
          font-weight: 500;
        }
        .agy-btn-primary:hover:not(:disabled) {
          background: var(--dsw-alias-button-primary-hover, #2563eb);
        }
        .agy-btn-danger {
          border-color: transparent;
          color: var(--dsw-alias-state-error-primary, #ef4444);
        }
        .agy-btn-danger:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover-danger, rgba(239, 68, 68, 0.1));
        }
        .agy-switch {
          position: relative;
          width: 34px;
          height: 20px;
          border-radius: 999px;
          border: 0.5px solid var(--dsw-alias-border-l3);
          background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.22));
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
          align-items: center;
          transition: background 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms ease;
          flex: none;
        }
        .agy-switch[aria-checked="true"] {
          background: var(--dsw-alias-state-success-primary, #22c55e);
          border-color: var(--dsw-alias-state-success-primary, #22c55e);
        }
        .agy-switch:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .agy-switch-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
          transform: translateX(0);
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .agy-switch[aria-checked="true"] .agy-switch-thumb {
          transform: translateX(14px);
        }
        .agy-accounts-box {
          border-radius: var(--dsw-radius-lg, 8px);
          background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.06));
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .agy-account-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: var(--dsw-radius-md, 6px);
          border: 0.5px solid transparent;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .agy-account-row-active {
          background: var(--dsw-alias-settings-card-fill, rgba(255, 255, 255, 0.03));
          border-color: var(--dsw-alias-border-l3);
        }
        .agy-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128, 128, 128, 0.18));
          color: var(--dsw-alias-label-primary);
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: none;
          text-transform: uppercase;
        }
        .agy-account-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .agy-account-email-line {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .agy-account-email {
          color: var(--dsw-alias-label-primary);
          font-size: 13px;
          font-weight: 500;
          line-height: 18px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .agy-account-sub {
          color: var(--dsw-alias-label-tertiary);
          font-size: 11px;
          line-height: 15px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .agy-pill-active {
          border-radius: var(--dsw-radius-xs, 4px);
          background: rgba(34, 197, 94, 0.14);
          color: var(--dsw-alias-state-success-primary, #22c55e);
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 600;
          line-height: 14px;
          flex: none;
        }
        .agy-pill-inactive {
          border-radius: var(--dsw-radius-xs, 4px);
          border: 0.5px solid var(--dsw-alias-border-l3);
          color: var(--dsw-alias-label-tertiary);
          padding: 0 5px;
          font-size: 10px;
          line-height: 14px;
          flex: none;
        }
        .agy-login-banner {
          border-radius: var(--dsw-radius-md, 8px);
          border: 0.5px solid var(--dsw-alias-border-l3);
          background: var(--dsw-alias-bg-module-platform, rgba(59, 130, 246, 0.08));
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .agy-code-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .agy-code-input {
          flex: 1;
          min-width: 180px;
          height: 28px;
          box-sizing: border-box;
          border-radius: var(--dsw-radius-sm, 6px);
          border: 0.5px solid var(--dsw-alias-border-l3);
          background: var(--dsw-alias-settings-card-fill, rgba(0, 0, 0, 0.2));
          color: var(--dsw-alias-label-primary);
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          outline: none;
        }
        .agy-code-input:focus {
          border-color: var(--dsw-alias-state-business-primary, #3b82f6);
        }
        .agy-note {
          color: var(--dsw-alias-label-tertiary);
          font-size: 11.5px;
          line-height: 16px;
          margin: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .agy-settings-card, .agy-dot-pulse, .agy-btn, .agy-switch, .agy-switch-thumb {
            animation: none !important;
            transition: none !important;
          }
        }
      `
      document.head.appendChild(style)
    }

    function AgyModelsAccountCard({ t }) {
      const [state, setState] = useState({
        loading: true,
        busy: false,
        error: null,
        providerEnabled: false,
        activeAccountId: null,
        hasActiveAccount: false,
        activeEmail: null,
        loginState: { status: 'idle', message: '', authUrl: '' },
        accounts: [],
      })
      const [authCode, setAuthCode] = useState('')

      const mountedRef = useRef(true)
      useEffect(() => {
        ensureStylesInjected()
        mountedRef.current = true
        return () => {
          mountedRef.current = false
        }
      }, [])

      const applyServerData = useCallback((data) => {
        if (!mountedRef.current || !data) return
        if (data.ok) {
          setState((prev) => ({
            ...prev,
            loading: false,
            busy: false,
            error: null,
            providerEnabled: Boolean(data.providerEnabled),
            activeAccountId: data.activeAccountId || null,
            hasActiveAccount: Boolean(data.hasActiveAccount),
            activeEmail: data.activeEmail || null,
            loginState: data.loginState || { status: 'idle', message: '', authUrl: '' },
            accounts: Array.isArray(data.accounts) ? data.accounts : [],
          }))
          if (data.loginState?.status !== 'pending') {
            setAuthCode('')
          }
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            busy: false,
            error: data.error || 'Request failed',
          }))
        }
      }, [])

      const fetchSnapshot = useCallback(
        async (sync = false) => {
          try {
            const res = await fetch(routeUrl(sync), {
              method: 'GET',
              credentials: 'same-origin',
              cache: 'no-store',
              headers: { accept: 'application/json' },
            })
            const data = await res.json()
            applyServerData(data)
          } catch (err) {
            if (!mountedRef.current) return
            setState((prev) => ({
              ...prev,
              loading: false,
              busy: false,
              error: err instanceof Error ? err.message : String(err),
            }))
          }
        },
        [applyServerData],
      )

      const runAction = useCallback(
        async (payload) => {
          setState((prev) => ({ ...prev, busy: true, error: null }))
          try {
            const res = await fetch(routeUrl(false), {
              method: 'POST',
              credentials: 'same-origin',
              cache: 'no-store',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
              },
              body: JSON.stringify(payload),
            })
            const data = await res.json()
            applyServerData(data)
          } catch (err) {
            if (!mountedRef.current) return
            setState((prev) => ({
              ...prev,
              busy: false,
              error: err instanceof Error ? err.message : String(err),
            }))
          }
        },
        [applyServerData],
      )

      useEffect(() => {
        fetchSnapshot(true)
      }, [fetchSnapshot])

      // Poll while interactive browser OAuth sign-in is pending
      useEffect(() => {
        if (state.loginState?.status !== 'pending') return undefined
        const timer = setInterval(() => {
          fetchSnapshot(false)
        }, 1500)
        return () => clearInterval(timer)
      }, [state.loginState?.status, fetchSnapshot])

      const { accounts, hasActiveAccount, activeEmail, loginState, busy } = state
      const isPendingLogin = loginState?.status === 'pending'

      const statusNode = hasActiveAccount
        ? h(
            'span',
            { className: 'agy-status agy-status-ok' },
            h('span', { className: 'agy-dot agy-dot-ok', 'aria-hidden': 'true' }),
            `${t('signedIn')}${activeEmail ? ` · ${activeEmail}` : ''}`,
          )
        : accounts.length > 0
          ? h(
              'span',
              { className: 'agy-status agy-status-warn' },
              h('span', { className: 'agy-dot agy-dot-warn', 'aria-hidden': 'true' }),
              `${t('disabledStatus')} (${accounts.length})`,
            )
          : h(
              'span',
              { className: 'agy-status agy-status-err' },
              h('span', { className: 'agy-dot agy-dot-err', 'aria-hidden': 'true' }),
              t('notSignedIn'),
            )

      const submitCodeNow = () => {
        if (!authCode.trim() || busy) return
        runAction({ action: 'submit-login-code', code: authCode.trim() })
      }

      return h(
        'div',
        { className: 'agy-settings-card' },
        // Top Header Row
        h(
          'div',
          { className: 'agy-head' },
          h(
            'span',
            { className: 'agy-identity' },
            h('span', { className: 'agy-name' }, t('title')),
            h('span', { className: 'agy-tag' }, t('oauthTag')),
            statusNode,
          ),
          h(
            'span',
            { className: 'agy-actions' },
            accounts.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    role: 'switch',
                    className: 'agy-switch',
                    'aria-checked': hasActiveAccount ? 'true' : 'false',
                    'aria-label': t('masterToggleLabel'),
                    title: t('masterToggleLabel'),
                    disabled: busy || isPendingLogin,
                    onClick: () => runAction({ action: 'toggle-provider', enabled: !hasActiveAccount }),
                  },
                  h('span', { className: 'agy-switch-thumb' }),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'agy-btn',
                disabled: busy || isPendingLogin,
                onClick: () => runAction({ action: 'sync-current' }),
              },
              busy && !isPendingLogin ? t('syncing') : t('syncCli'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'agy-btn',
                disabled: busy || isPendingLogin,
                onClick: () => runAction({ action: 'start-login' }),
              },
              t('addAccount'),
            ),
          ),
        ),

        // Interactive OAuth Pending Banner + Code Input
        isPendingLogin
          ? h(
              'div',
              { className: 'agy-login-banner', role: 'status', 'aria-live': 'polite' },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
                h(
                  'span',
                  { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 500 } },
                  h('span', { className: 'agy-dot agy-dot-pulse', 'aria-hidden': 'true' }),
                  t('loginPendingTitle'),
                ),
                h(
                  'div',
                  { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                  loginState?.authUrl
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'agy-btn',
                          onClick: () => runAction({ action: 'open-auth-url', url: loginState.authUrl }),
                        },
                        t('openBrowserBtn'),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'agy-btn agy-btn-danger',
                      onClick: () => runAction({ action: 'cancel-login' }),
                    },
                    t('cancelLogin'),
                  ),
                ),
              ),
              h('span', { className: 'agy-note' }, t('loginPendingHint')),
              h(
                'div',
                { className: 'agy-code-row' },
                h('input', {
                  type: 'text',
                  className: 'agy-code-input',
                  placeholder: t('codePlaceholder'),
                  value: authCode,
                  disabled: busy,
                  onChange: (e) => setAuthCode(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitCodeNow()
                    }
                  },
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'agy-btn agy-btn-primary',
                    disabled: busy || !authCode.trim(),
                    onClick: submitCodeNow,
                  },
                  busy ? t('submittingCode') : t('submitCodeBtn'),
                ),
              ),
            )
          : null,

        // Error message if any
        state.error
          ? h(
              'p',
              {
                role: 'alert',
                style: {
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--dsw-alias-state-error-primary, #ef4444)',
                },
              },
              state.error,
            )
          : null,

        // Saved Accounts List
        accounts.length > 0
          ? h(
              'div',
              { className: 'agy-accounts-box' },
              accounts.map((acc) => {
                const initial = (acc.name || acc.email || 'A').trim().charAt(0)
                const isActive = Boolean(acc.isActive)
                return h(
                  'div',
                  {
                    key: acc.id,
                    className: `agy-account-row ${isActive ? 'agy-account-row-active' : ''}`,
                  },
                  h('span', { className: 'agy-avatar', 'aria-hidden': 'true' }, initial),
                  h(
                    'div',
                    { className: 'agy-account-meta' },
                    h(
                      'div',
                      { className: 'agy-account-email-line' },
                      h('span', { className: 'agy-account-email' }, acc.email),
                      isActive
                        ? h('span', { className: 'agy-pill-active' }, t('activeBadge'))
                        : h('span', { className: 'agy-pill-inactive' }, t('pausedBadge')),
                    ),
                    acc.name && acc.name !== acc.email
                      ? h('span', { className: 'agy-account-sub' }, `${acc.name} · ${acc.authMethod || 'consumer'}`)
                      : null,
                  ),
                  h(
                    'div',
                    { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                    !isActive
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'agy-btn',
                            disabled: busy || isPendingLogin,
                            onClick: () => runAction({ action: 'activate', accountId: acc.id }),
                          },
                          t('useAccount'),
                        )
                      : null,
                    h(
                      'button',
                      {
                        type: 'button',
                        role: 'switch',
                        className: 'agy-switch',
                        'aria-checked': isActive ? 'true' : 'false',
                        'aria-label': `${t('accountToggleLabel')} ${acc.email}`,
                        disabled: busy || isPendingLogin,
                        onClick: () =>
                          runAction({
                            action: 'toggle-account',
                            accountId: acc.id,
                            enabled: !isActive,
                          }),
                      },
                      h('span', { className: 'agy-switch-thumb' }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'agy-btn agy-btn-danger',
                        disabled: busy || isPendingLogin,
                        onClick: () => runAction({ action: 'remove', accountId: acc.id }),
                      },
                      t('removeAccount'),
                    ),
                  ),
                )
              }),
            )
          : h('p', { className: 'agy-note' }, t('emptyAccounts')),

        // Footer Note on Model Visibility
        h('p', { className: 'agy-note' }, hasActiveAccount ? t('modelsVisibleNote') : t('modelsHiddenNote')),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        let t = (key) => DICTIONARIES.en[key] ?? key
        if (locale !== undefined && typeof locale.register === 'function') {
          ctx.effect(() => {
            const disposers = [
              locale.register(LOCALE_NS, 'en', DICTIONARIES.en),
              locale.register(LOCALE_NS, 'id', DICTIONARIES.id),
            ]
            return () => {
              for (const dispose of disposers) {
                if (typeof dispose === 'function') {
                  try {
                    dispose()
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          }, 'agy-provider: dictionaries')
          t = locale.bind(LOCALE_NS)
        }

        ctx.slots.inject('settings.models.footer', () =>
          ctx.slots.register(
            {
              name: 'settings.models.footer',
              id: 'agy-provider-accounts',
              order: 1,
            },
            () => h(AgyModelsAccountCard, { t }),
          ),
        )
      },
    }
  },
})
