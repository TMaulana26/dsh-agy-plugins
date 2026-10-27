# DeepSeek Harness Plugins (`@local/agy-provider`, `@local/provider-usage`, `@local/skills-manager`)

Paket ekstensi resmi komunitas untuk **DeepSeek Harness (DSH)** yang menambahkan:
1. **`@local/agy-provider`**: Dukungan native **Antigravity CLI (`agy`) Multi-Account Provider** (26 model standar + mode agen otonom `[agy]`).
2. **`@local/provider-usage`**: **Live Quota & Rate Limit Telemetry** di Composer Dock, Right Sidebar (`Ctrl+Alt+B`), dan menu Settings.
3. **`@local/skills-manager`**: **Skills Manager, Local Importer (Antigravity & Claude Code) & Online Skills Marketplace (`skills.sh` + GitHub)** di menu **Settings ➡️ Skills** dan Right Sidebar (`Ctrl+Alt+S`).

---

## ✨ Fitur Utama

### 1. `@local/agy-provider` — Antigravity CLI (`agy`) Multi-Account Provider
- **Multi-Account Google OAuth2 PKCE Manager** langsung di menu **Settings ➡️ Models**:
  - **`+ Add Account`**: Login akun Google baru langsung dari aplikasi dengan alur OAuth2 PKCE (`S256`) + input kode autentikasi dan sinkronisasi otomatis ke Windows Credential Manager (`gemini:antigravity`).
  - **`Sync CLI`**: Impor sesi akun `agy` yang sudah login di terminal hanya dengan 1 klik.
  - **Multi-Account Switcher & Master Toggle**: Simpan banyak akun Google sekaligus, pindah akun aktif kapan saja tanpa perlu login ulang, dan sembunyikan/munculkan daftar model secara dinamis.
- **26 Model Siap Pakai (Mode Standar & Mode Otonom `[agy]`)**:
  - **13 Model Standar (`dsh-bridge`)**: `Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5`, `Claude Sonnet 5.5`, dan `GPT-OSS 120B` yang terintegrasi penuh dengan tool bawaan UI DeepSeek Harness.
  - **13 Model Otonom (`[agy] ...` / `agy-agent`)**: Mode agen otonom penuh (`--dangerously-skip-permissions` + `--conversation` persistence per akun) dengan live streaming `thinking` dari `transcript.jsonl`.

### 2. `@local/provider-usage` — Live Quota & Rate Limit Telemetry
- **3 Tampilan Terintegrasi**:
  1. **Composer Dock Pill**: Status kuota real-time tepat di bawah kolom chat. Klik untuk membuka panel detail di Right Sidebar.
  2. **Right Sidebar (`Ctrl+Alt+B`)**: Panel **Quota & Limits** di sebelah kanan percakapan.
  3. **Settings ➡️ Quota & Usage**: Dashboard lengkap kuota per model dan jadwal reset.
- Mendukung pemantauan kuota otomatis untuk **Antigravity CLI (`agy`)**, **9Router**, dan **Dattio AI**.

### 3. `@local/skills-manager` — Skills Manager, Local Importer & Online Registry
- Muncul langsung di **Settings ➡️ Skills** serta di **Right Sidebar (`Ctrl+Alt+S`)** dengan 3 tab utama:
  1. **Installed Skills**:
     - Kelola semua skill yang terdaftar di DSH.
     - Terapkan skill ke **Global (`~/.dsh/skills`)** dan/atau ke **beberapa Workspace tertentu (`<workspace>/.dsh/skills`)** hanya dengan 1 klik (langsung aktif hot-reload tanpa perlu restart DSH).
     - Toggle **Auto-Invoke** (`disable-model-invocation`), edit isi `SKILL.md` secara langsung, atau buat skill baru (`+ New Skill`).
  2. **Import (Antigravity & Claude Code)**:
     - Mendeteksi otomatis seluruh skill lokal dari **Antigravity** (`~/.gemini/config/skills`, `~/.gemini/antigravity/builtin/skills`, `~/.gemini/config/plugins/*/skills`) dan **Claude Code** (`~/.claude/skills`).
     - Impor satuan maupun sekaligus (*batch import*) beserta folder pendukungnya (`scripts/`, `references/`, `assets/`, `examples/`) ke Global atau Workspace pilihan.
  3. **Explore & Search Online (`skills.sh` + GitHub)**:
     - Telusuri daftar skill **Popular (All-Time)**, **Trending (24h)**, dan **Hot (Surging)** dari direktori resmi `https://skills.sh`.
     - Telusuri skill **Newly Created** yang baru dibuat di komunitas lewat GitHub Search API.
     - Cari lebih dari **50.000+ Agent Skills** menggunakan kolom pencarian dan pasang dengan **1 klik (`Install`)** ke Global atau Workspace tertentu.

---

## 🚀 Cara Instalasi / Update (Windows)

### Prasyarat
1. **DeepSeek Harness** sudah terinstal dan pernah dijalankan minimal 1 kali.
2. **Antigravity CLI (`agy`)** sudah terinstal di komputer Anda (untuk menggunakan `@local/agy-provider`).

### Langkah Instalasi Cepat (1 Perintah)
Buka **PowerShell**, lalu jalankan perintah berikut:

```powershell
git clone https://github.com/TMaulana26/dsh-agy-plugins.git
cd dsh-agy-plugins
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

*(Jika sebelumnya sudah pernah clone, cukup jalankan `git pull` lalu `powershell -ExecutionPolicy Bypass -File .\install.ps1`)*

Skrip `install.ps1` akan otomatis:
1. Menghubungkan `@local/agy-provider`, `@local/provider-usage`, dan `@local/skills-manager` ke profil `~/.dsh/profiles/desktop`.
2. Memperbarui `package.json` profil DeepSeek Harness Anda (UTF-8 tanpa BOM).
3. Memuat ulang aplikasi **DeepSeek Harness** secara otomatis.
