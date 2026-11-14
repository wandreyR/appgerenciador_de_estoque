"""Assinatura de licenças e da lista de canceladas (Ed25519) + proteção do token (DPAPI).

ATENÇÃO: o formato precisa ser idêntico ao validado em
backend/app/license/manager.py (prefixo, base64url, ID = sha256(payload)[:16]).
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import sys
from datetime import date, datetime, timezone
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from .config import LEGACY_PRIVATE_KEYS, PRIVATE_KEY

PREFIX = "EST1-"


class CryptoError(Exception):
    pass


def normalize_hwid(v: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (v or "").upper())


def format_hwid(v: str) -> str:
    n = normalize_hwid(v)
    return "-".join(n[i:i + 5] for i in range(0, len(n), 5))


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def license_id(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()[:16].upper()


# ---------------- chaves ----------------
def migrate_legacy_key() -> bool:
    """Copia a chave criada pelo antigo keygen.py, se existir."""
    if PRIVATE_KEY.exists():
        return False
    for legacy in LEGACY_PRIVATE_KEYS:
        if legacy.exists():
            _parse_private(legacy.read_bytes())
            PRIVATE_KEY.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy, PRIVATE_KEY)
            return True
    return False


def _parse_private(pem: bytes) -> Ed25519PrivateKey:
    try:
        key = serialization.load_pem_private_key(pem, password=None)
    except Exception:
        raise CryptoError("Arquivo não é uma chave privada PEM válida.")
    if not isinstance(key, Ed25519PrivateKey):
        raise CryptoError("A chave precisa ser do tipo Ed25519.")
    return key


def has_private() -> bool:
    return PRIVATE_KEY.exists()


def load_private() -> Ed25519PrivateKey:
    if not PRIVATE_KEY.exists():
        raise CryptoError("Nenhuma chave privada configurada. Gere ou importe na aba 'Chaves e cliente'.")
    return _parse_private(PRIVATE_KEY.read_bytes())


def private_pem() -> bytes:
    load_private()
    return PRIVATE_KEY.read_bytes()


def generate_keypair() -> str:
    PRIVATE_KEY.parent.mkdir(parents=True, exist_ok=True)
    if PRIVATE_KEY.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(PRIVATE_KEY, PRIVATE_KEY.with_name(f"private_key_antiga_{stamp}.pem"))
    key = Ed25519PrivateKey.generate()
    PRIVATE_KEY.write_bytes(
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    )
    return public_b64()


def import_private(pem: bytes) -> str:
    _parse_private(pem)
    PRIVATE_KEY.parent.mkdir(parents=True, exist_ok=True)
    if PRIVATE_KEY.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(PRIVATE_KEY, PRIVATE_KEY.with_name(f"private_key_antiga_{stamp}.pem"))
    PRIVATE_KEY.write_bytes(pem)
    return public_b64()


def public_b64() -> str:
    raw = load_private().public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(raw).decode()


# ---------------- licenças ----------------
def make_license(hwid: str, customer: str, expires: date | None) -> tuple[str, dict, str]:
    h = normalize_hwid(hwid)
    if len(h) != 20:
        raise CryptoError("HWID inválido. Formato esperado: XXXXX-XXXXX-XXXXX-XXXXX.")
    payload = {"v": 1, "h": h, "c": customer.strip(), "i": date.today().isoformat(), "e": expires.isoformat() if expires else None}
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    sig = load_private().sign(raw)
    return f"{PREFIX}{b64url(raw)}.{b64url(sig)}", payload, license_id(raw)


def inspect_license(key: str) -> dict[str, Any]:
    key = "".join((key or "").split())
    if not key.startswith(PREFIX):
        raise CryptoError("A chave deve começar com EST1-")
    try:
        p, s = key[len(PREFIX):].split(".")
        raw, sig = b64url_decode(p), b64url_decode(s)
        payload = json.loads(raw)
    except Exception:
        raise CryptoError("Chave incompleta ou mal copiada.")
    try:
        load_private().public_key().verify(sig, raw)
        valid = True
    except InvalidSignature:
        valid = False
    return {"id": license_id(raw), "signature_ok": valid, "payload": payload}


# ---------------- lista de canceladas ----------------
def sign_revocation_list(seq: int, revoked: list[str]) -> str:
    payload = {
        "type": "revocation_list",
        "v": 1,
        "seq": seq,
        "issued_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "revoked": sorted(set(revoked)),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    sig = load_private().sign(raw)
    return json.dumps({"payload": b64url(raw), "sig": b64url(sig)}, indent=1)


def verify_revocation_list(text: str) -> dict[str, Any]:
    doc = json.loads(text)
    raw, sig = b64url_decode(doc["payload"]), b64url_decode(doc["sig"])
    load_private().public_key().verify(sig, raw)
    return json.loads(raw)


# ---------------- token (DPAPI no Windows) ----------------
def protect(text: str) -> str:
    if not text:
        return ""
    data = text.encode()
    if sys.platform == "win32":
        data = _dpapi(data, encrypt=True)
        return "dpapi:" + base64.b64encode(data).decode()
    return "plain:" + base64.b64encode(data).decode()


def unprotect(token: str) -> str:
    if not token:
        return ""
    kind, _, b = token.partition(":")
    data = base64.b64decode(b)
    if kind == "dpapi":
        data = _dpapi(data, encrypt=False)
    return data.decode()


def _dpapi(data: bytes, encrypt: bool) -> bytes:
    import ctypes
    from ctypes import wintypes

    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    buf = ctypes.create_string_buffer(data, len(data))
    blob_in = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    blob_out = BLOB()
    crypt32 = ctypes.windll.crypt32
    fn = crypt32.CryptProtectData if encrypt else crypt32.CryptUnprotectData
    if not fn(ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
        raise CryptoError("Falha ao proteger/ler o token (DPAPI).")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
