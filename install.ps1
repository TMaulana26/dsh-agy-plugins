#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DeepSeek Harness Plugins Installer" -ForegroundColor Cyan
Write-Host "  (@local/agy-provider & @local/provider-usage)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$repoRoot = $PSScriptRoot
$dshProfile = Join-Path $HOME ".dsh\profiles\desktop"

if (-not (Test-Path $dshProfile)) {
    Write-Host "[!] Direktori profil DeepSeek Harness belum ditemukan di: $dshProfile" -ForegroundColor Yellow
    Write-Host "    Pastikan Anda sudah menginstal dan menjalankan aplikasi DeepSeek Harness minimal 1 kali." -ForegroundColor Yellow
    exit 1
}

# 1. Buat junction di node_modules/@local
$localModulesDir = Join-Path $dshProfile "node_modules\@local"
if (-not (Test-Path $localModulesDir)) {
    New-Item -ItemType Directory -Path $localModulesDir -Force | Out-Null
}

$plugins = @("provider-usage", "agy-provider")
foreach ($plugin in $plugins) {
    $srcPath = Join-Path $repoRoot $plugin
    $destPath = Join-Path $localModulesDir $plugin
    if (Test-Path $destPath) {
        cmd.exe /c rmdir "$destPath" 2>$null
        if (Test-Path $destPath) {
            Remove-Item -Path $destPath -Recurse -Force
        }
    }
    New-Item -ItemType Junction -Path $destPath -Target $srcPath | Out-Null
    Write-Host "[+] Terhubung: @local/$plugin -> $srcPath" -ForegroundColor Green
}

# 2. Update ~/.dsh/profiles/desktop/package.json
$pkgJsonPath = Join-Path $dshProfile "package.json"
if (Test-Path $pkgJsonPath) {
    $pkg = Get-Content -Path $pkgJsonPath -Raw | ConvertFrom-Json
} else {
    $pkg = [PSCustomObject]@{
        name = "dsh-profile-desktop"
        private = $true
        dsh = [PSCustomObject]@{
            profile = [PSCustomObject]@{
                bundles = @(
                    "@deepseek-ai/dsh-base",
                    "@deepseek-ai/dsh-web-app"
                )
            }
        }
        dependencies = [PSCustomObject]@{}
    }
}

if (-not $pkg.dsh) { $pkg | Add-Member -NotePropertyName "dsh" -NotePropertyValue ([PSCustomObject]@{}) }
if (-not $pkg.dsh.profile) { $pkg.dsh | Add-Member -NotePropertyName "profile" -NotePropertyValue ([PSCustomObject]@{}) }
if (-not $pkg.dsh.profile.bundles) { $pkg.dsh.profile | Add-Member -NotePropertyName "bundles" -NotePropertyValue @("@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app") }
if (-not $pkg.dependencies) { $pkg | Add-Member -NotePropertyName "dependencies" -NotePropertyValue ([PSCustomObject]@{}) }

$bundles = [System.Collections.ArrayList]@($pkg.dsh.profile.bundles)
foreach ($plugin in $plugins) {
    $pkgName = "@local/$plugin"
    if ($bundles -notcontains $pkgName) {
        [void]$bundles.Add($pkgName)
    }
    $linkTarget = "link:" + ((Join-Path $repoRoot $plugin) -replace '\\', '/')
    $pkg.dependencies | Add-Member -NotePropertyName $pkgName -NotePropertyValue $linkTarget -Force
}
$pkg.dsh.profile.bundles = $bundles.ToArray()

$pkg | ConvertTo-Json -Depth 10 | Set-Content -Path $pkgJsonPath -Encoding UTF8
Write-Host "[+] Berhasil memperbarui $pkgJsonPath" -ForegroundColor Green

# 3. Restart DeepSeek Harness jika sedang berjalan
$dshExe = Join-Path $env:LOCALAPPDATA "Programs\DeepSeek Harness\DeepSeek Harness.exe"
if (Get-Process -Name "DeepSeek Harness" -ErrorAction SilentlyContinue) {
    Write-Host "[*] Memuat ulang DeepSeek Harness..." -ForegroundColor Cyan
    Stop-Process -Name "DeepSeek Harness" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
    if (Test-Path $dshExe) {
        Start-Process $dshExe
    }
} elseif (Test-Path $dshExe) {
    Write-Host "[*] Menjalankan DeepSeek Harness..." -ForegroundColor Cyan
    Start-Process $dshExe
}

Write-Host ""
Write-Host "Selesai! Buka DeepSeek Harness -> Settings -> Models untuk login akun Antigravity CLI (agy)." -ForegroundColor Green
