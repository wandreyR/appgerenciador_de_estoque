# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec do LicencasAdmin.exe (NÃO distribuir para clientes).
# Uso (na pasta keygen_admin/):  ..\backend\.venv\Scripts\pyinstaller admin.spec --noconfirm
import os

from PyInstaller.utils.hooks import collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
DIST = os.path.join(ROOT, "frontend", "dist-admin")
ICON = os.path.join(ROOT, "assets", "icon_admin.ico")

if not os.path.exists(os.path.join(DIST, "index.html")):
    raise SystemExit("frontend/dist-admin não encontrado. Rode 'npm run build:admin' em frontend/ antes.")

a = Analysis(
    ["run_admin.py"],
    pathex=[SPECPATH],
    datas=[(DIST, "admin_dist")],
    hiddenimports=collect_submodules("uvicorn") + collect_submodules("admin_app") + ["multipart", "python_multipart"],
    excludes=["tkinter", "PIL", "sqlalchemy", "numpy", "pandas", "matplotlib"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="LicencasAdmin",
    debug=False,
    strip=False,
    upx=False,
    console=False,
    icon=ICON if os.path.exists(ICON) else None,
)
