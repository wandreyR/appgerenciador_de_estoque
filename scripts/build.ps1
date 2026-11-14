# Compila o sistema completo em dist\GestorEstoque.exe
# Uso (PowerShell, na raiz do projeto):  powershell -ExecutionPolicy Bypass -File scripts\build.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Verificando chave publica de licenca" -ForegroundColor Cyan
if (Select-String -Path "backend\app\license\public_key.py" -Pattern "COLE_AQUI" -Quiet) {
    throw "Chave publica nao configurada. Use o LicencasAdmin > Chaves e cliente > Gravar no projeto."
}
if (Select-String -Path "backend\app\license\public_key.py" -Pattern 'LICENSE_LIST_URL = ""' -Quiet) {
    Write-Host "ATENCAO: LICENSE_LIST_URL vazia - o executavel NAO fara a verificacao diaria de licencas." -ForegroundColor Yellow
    Write-Host "         Configure a publicacao no LicencasAdmin e use 'Gravar no projeto' antes de distribuir." -ForegroundColor Yellow
}

Write-Host "==> Frontend (npm install + build)" -ForegroundColor Cyan
Push-Location frontend
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }
Pop-Location

Write-Host "==> Backend (venv + dependencias)" -ForegroundColor Cyan
Push-Location backend
if (-not (Test-Path ".venv\Scripts\python.exe")) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --upgrade pip -q
.\.venv\Scripts\pip.exe install -r requirements.txt pyinstaller -q
if ($LASTEXITCODE -ne 0) { throw "pip install falhou" }

Write-Host "==> Icone" -ForegroundColor Cyan
.\.venv\Scripts\python.exe ..\scripts\make_icon.py

Write-Host "==> PyInstaller" -ForegroundColor Cyan
.\.venv\Scripts\pyinstaller.exe estoque.spec --noconfirm --clean --distpath ..\dist --workpath ..\build
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou" }
Pop-Location

$exe = Join-Path $Root "dist\GestorEstoque.exe"
$size = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host ""
Write-Host "OK! Executavel gerado: $exe ($size MB)" -ForegroundColor Green
