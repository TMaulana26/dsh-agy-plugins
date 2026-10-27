# DeepSeek Harness Plugins (`@local/agy-provider` & `@local/provider-usage`)

Paket ekstensi resmi komunitas untuk **DeepSeek Harness (DSH)** yang menambahkan dukungan native **Antigravity CLI (`agy`) Multi-Account Provider** serta **Live Quota & Rate Limit Telemetry** di Composer Dock, Right Sidebar (`Ctrl+Alt+B`), dan menu Settings.

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

---

## 🚀 Cara Instalasi (Windows)

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

Skrip `install.ps1` akan otomatis:
1. Menghubungkan `@local/agy-provider` dan `@local/provider-usage` ke profil `~/.dsh/profiles/desktop`.
2. Memperbarui `package.json` profil DeepSeek Harness Anda.
3. Memuat ulang aplikasi **DeepSeek Harness** secara otomatis.

---

## 📖 Cara Penggunaan Setelah Instalasi

1. Buka **DeepSeek Harness** ➡️ **Settings (`Ctrl+,`)** ➡️ **Models**.
2. Gulir ke bagian **Antigravity CLI (agy) — Accounts**:
   - Klik **`Sync CLI`** jika Anda sudah pernah login `agy` di terminal, atau
   - Klik **`+ Add Account`** untuk login akun Google baru lewat browser, lalu tempelkan kode autentikasi yang muncul.
3. Setelah akun berstatus **ACTIVE**, pilih model `Gemini 4 Argon`, `Claude Opus 5.5`, atau varian **`[agy]`** langsung dari pemilih model di bawah kolom chat.
4. Klik indikator kuota di bawah kolom chat (atau tekan **`Ctrl+Alt+B`**) untuk memantau sisa kuota per model secara langsung!
