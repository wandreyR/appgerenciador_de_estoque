# Compila o LicencasAdmin.exe (USO INTERNO - nao distribuir para clientes)
# Uso (PowerShell, na raiz do projeto):  powershell -ExecutionPolicy Bypass -File scripts\build_admin.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Frontend do admin" -ForegroundColor Cyan
Push-Location frontend
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
npm run build:admin
if ($LASTEXITCODE -ne 0) { throw "npm run build:admin falhou" }
Pop-Location

Write-Host "==> Dependencias Python (venv do backend)" -ForegroundColor Cyan
if (-not (Test-Path "backend\.venv\Scripts\python.exe")) { python -m venv backend\.venv }
.\backend\.venv\Scripts\pip.exe install -r keygen_admin\requirements.txt pyinstaller -q
if ($LASTEXITCODE -ne 0) { throw "pip install falhou" }

Write-Host "==> Icone" -ForegroundColor Cyan
.\backend\.venv\Scripts\python.exe scripts\make_icon.py

Write-Host "==> PyInstaller" -ForegroundColor Cyan
Push-Location keygen_admin
..\backend\.venv\Scripts\pyinstaller.exe admin.spec --noconfirm --clean --distpath ..\dist --workpath ..\build\admin
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou" }
Pop-Location

Write-Host ""
Write-Host "OK! dist\LicencasAdmin.exe gerado. Mantenha-o SOMENTE no seu computador." -ForegroundColor Green
