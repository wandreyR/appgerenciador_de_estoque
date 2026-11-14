"""Identificador de hardware (HWID) da máquina.

Combina UUID SMBIOS da placa-mãe, número de série da placa-mãe e número de
série do disco do sistema. O MAC é usado apenas como último recurso, pois
muda facilmente (adaptadores USB, VPN, Wi-Fi). O resultado é um hash SHA-256
apresentado como XXXXX-XXXXX-XXXXX-XXXXX.
"""
from __future__ import annotations

import base64
import hashlib
import re
import subprocess
import sys
import uuid
from pathlib import Path

_JUNK = {
    "", "none", "null", "n/a", "na", "0", "default string", "to be filled by o.e.m.",
    "system serial number", "not applicable", "not specified", "base board serial number",
    "03000200-0400-0500-0006-000700080009",
}

_PS_SCRIPT = (
    "$ErrorActionPreference='SilentlyContinue';"
    "$u=(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID;"
    "$b=(Get-CimInstance -ClassName Win32_BaseBoard).SerialNumber;"
    "$d=(Get-CimInstance -ClassName Win32_DiskDrive | Where-Object { $_.Index -eq 0 } | Select-Object -First 1).SerialNumber;"
    'Write-Output ("HWID|$u|$b|$d")'
)

_cached: str | None = None


def normalize_hwid(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def format_hwid(value: str) -> str:
    v = normalize_hwid(value)
    return "-".join(v[i:i + 5] for i in range(0, len(v), 5))


def _clean(v: str) -> str:
    v = (v or "").strip()
    low = v.lower()
    if low in _JUNK or re.fullmatch(r"[0\-\s]*", low) or re.fullmatch(r"[f\-\s]*", low):
        return ""
    return re.sub(r"\s+", "", v.upper())


def _windows_components() -> list[str]:
    for _ in range(2):
        try:
            r = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", _PS_SCRIPT],
                capture_output=True,
                text=True,
                errors="ignore",
                timeout=30,
                stdin=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            line = next((ln for ln in r.stdout.splitlines() if ln.startswith("HWID|")), "")
            parts = line.split("|")[1:]
            if len(parts) == 3:
                u, b, d = (_clean(x) for x in parts)
                comps = [c for c in (f"uuid={u}" if u else "", f"board={b}" if b else "", f"disk={d}" if d else "") if c]
                if comps:
                    return comps
        except Exception:
            pass
    return []


def _machine_guid() -> str:
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
            0,
            winreg.KEY_READ | winreg.KEY_WOW64_64KEY,
        ) as k:
            return str(winreg.QueryValueEx(k, "MachineGuid")[0]).upper()
    except Exception:
        return ""


def _compute() -> str:
    comps: list[str] = []
    if sys.platform == "win32":
        comps = _windows_components()
        if not comps:
            mg = _machine_guid()
            if mg:
                comps = [f"mguid={mg}"]
    else:
        for p in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
            try:
                comps = [f"mid={Path(p).read_text().strip()}"]
                break
            except OSError:
                continue
    if not comps:
        comps = [f"mac={uuid.getnode():012x}"]

    digest = hashlib.sha256(("EstoqueConfeccao|" + "|".join(comps)).encode()).digest()
    code = base64.b32encode(digest[:15]).decode()[:20]
    return format_hwid(code)


def get_hwid() -> str:
    global _cached
    if _cached is None:
        _cached = _compute()
    return _cached
