# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec - gera um único GestorEstoque.exe (onefile, sem console).
# Uso (na pasta backend/):  .venv\Scripts\pyinstaller estoque.spec --noconfirm --clean
import os

from PyInstaller.utils.hooks import collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
DIST = os.path.join(ROOT, "frontend", "dist")
ICON = os.path.join(ROOT, "assets", "icon.ico")

if not os.path.exists(os.path.join(DIST, "index.html")):
    raise SystemExit("frontend/dist não encontrado. Rode 'npm run build' em frontend/ antes.")

hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("app")
    + ["multipart", "python_multipart", "PIL._imaging"]
)

a = Analysis(
    ["run.py"],
    pathex=[SPECPATH],
    binaries=[],
    datas=[(DIST, "frontend_dist")],
    hiddenimports=hiddenimports,
    excludes=["tkinter", "matplotlib", "numpy", "pandas", "pytest", "IPython"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="GestorEstoque",
    debug=False,
    strip=False,
    upx=False,          # UPX aumenta falsos positivos de antivírus
    console=False,      # sem janela preta; logs em %APPDATA%\EstoqueConfeccao\logs
    icon=ICON if os.path.exists(ICON) else None,
    version=None,
)
