"""Licença com assinatura Ed25519 (assimétrica) + verificação online diária.

Formato da chave:  EST1-<payload base64url>.<assinatura base64url>
Payload (JSON):    {"v":1, "h":"<HWID>", "c":"<cliente>", "i":"AAAA-MM-DD", "e":"AAAA-MM-DD" | null}
ID da licença:     16 primeiros hex (maiúsculos) do SHA-256 do payload.

O executável contém apenas a chave PÚBLICA: é impossível gerar chaves novas a
partir dele (ao contrário de HMAC, cujo segredo ficaria embutido no .exe).

Verificação diária: a cada 24h o sistema baixa a lista de licenças canceladas
(publicada pelo app LicencasAdmin e assinada com a mesma chave privada). Se a
licença estiver na lista, o sistema é bloqueado. Sem internet, continua
funcionando por OFFLINE_GRACE_DAYS dias desde a última verificação bem-sucedida.

Proteção contra retrocesso do relógio: o último instante em que o sistema foi
visto rodando ("last seen") é gravado criptografado em 3 lugares — arquivo de
licença, Registro do Windows (HKCU) e banco SQLite.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import threading
import time
import urllib.request
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from ..config import APP_DISPLAY_NAME, APP_VERSION, LICENSE_FILE
from . import public_key as _pk
from .hwid import get_hwid, normalize_hwid

log = logging.getLogger(__name__)

KEY_PREFIX = "EST1-"
CLOCK_TOLERANCE_S = 3 * 3600
RECHECK_INTERVAL_S = 300
ONLINE_CHECK_INTERVAL_S = 24 * 3600
OFFLINE_GRACE_DAYS = 7
_STORE_SALT = b"EstoqueConfeccao/license-store/v1|"
_REG_PATH = r"Software\EstoqueConfeccao"
_REG_VALUE = "ls"
_DB_KEY = "_ls"


class LicenseError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def list_url() -> str:
    return (getattr(_pk, "LICENSE_LIST_URL", "") or "").strip()


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _public_key() -> Ed25519PublicKey:
    pub = _pk.PUBLIC_KEY_B64
    if not pub or pub.startswith("COLE"):
        raise LicenseError("not_configured", "Chave pública não configurada. Configure pelo LicencasAdmin antes do build.")
    return Ed25519PublicKey.from_public_bytes(base64.b64decode(pub))


def clean_key(key: str) -> str:
    return "".join((key or "").split())


def license_id(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()[:16].upper()


def decode_key(key: str) -> dict[str, Any]:
    key = clean_key(key)
    if not key.startswith(KEY_PREFIX):
        raise LicenseError("invalid", "Formato de chave inválido. A chave deve começar com EST1-")
    try:
        p, s = key[len(KEY_PREFIX):].split(".")
        payload, sig = _b64url_decode(p), _b64url_decode(s)
    except Exception:
        raise LicenseError("invalid", "Chave de licença incompleta ou mal copiada.")
    try:
        _public_key().verify(sig, payload)
    except InvalidSignature:
        raise LicenseError("invalid", "Chave de licença inválida ou adulterada.")
    try:
        data = json.loads(payload)
        assert isinstance(data, dict) and "h" in data and "type" not in data
    except Exception:
        raise LicenseError("invalid", "Conteúdo da licença ilegível.")
    data["_id"] = license_id(payload)
    return data


def verify_revocation_list(raw: bytes) -> dict[str, Any]:
    """Valida a lista publicada pelo LicencasAdmin. Lança exceção se adulterada."""
    doc = json.loads(raw)
    payload, sig = _b64url_decode(doc["payload"]), _b64url_decode(doc["sig"])
    _public_key().verify(sig, payload)
    data = json.loads(payload)
    if data.get("type") != "revocation_list":
        raise ValueError("documento não é uma lista de licenças")
    return data


def fetch_revocation_list() -> dict[str, Any]:
    url = list_url()
    url += ("&" if "?" in url else "?") + f"t={int(time.time())}"  # evita cache de CDN
    req = urllib.request.Request(url, headers={"User-Agent": f"GestorEstoque/{APP_VERSION}", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return verify_revocation_list(r.read(2_000_000))


def _parse_date(s: str | None) -> date | None:
    return date.fromisoformat(s) if s else None


@dataclass
class LicenseState:
    status: str  # valid | missing | invalid | hwid_mismatch | expired | clock_tampered | revoked | check_required | not_configured
    message: str
    hwid: str
    customer: str | None = None
    issued: str | None = None
    expires: str | None = None
    days_left: int | None = None
    license_id: str | None = None
    days_since_check: int | None = None

    @property
    def valid(self) -> bool:
        return self.status == "valid"

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.update(
            valid=self.valid,
            lifetime=self.valid and self.expires is None,
            check_enabled=bool(list_url()),
            grace_days=OFFLINE_GRACE_DAYS,
            app_name=APP_DISPLAY_NAME,
            version=APP_VERSION,
        )
        return d


class LicenseManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._state: LicenseState | None = None
        self._checked_at = 0.0
        self._hwid = ""

    @property
    def hwid(self) -> str:
        if not self._hwid:
            self._hwid = get_hwid()
        return self._hwid

    # ---------- criptografia local (atrelada ao HWID) ----------
    def _fernet(self) -> Fernet:
        key = hashlib.sha256(_STORE_SALT + normalize_hwid(self.hwid).encode()).digest()
        return Fernet(base64.urlsafe_b64encode(key))

    def _enc(self, obj: Any) -> str:
        return self._fernet().encrypt(json.dumps(obj).encode()).decode()

    def _dec(self, token: str | None) -> Any:
        if not token:
            return None
        try:
            return json.loads(self._fernet().decrypt(token.encode()))
        except Exception:
            return None

    # ---------- armazenamento ----------
    def _read_store(self) -> tuple[dict | None, bool]:
        if not LICENSE_FILE.exists():
            return None, False
        try:
            data = self._dec(LICENSE_FILE.read_text(encoding="utf-8").strip())
        except OSError:
            data = None
        return (data if isinstance(data, dict) else None), True

    def _write_store(self, data: dict) -> None:
        LICENSE_FILE.parent.mkdir(parents=True, exist_ok=True)
        LICENSE_FILE.write_text(self._enc(data), encoding="utf-8")

    def _reg_read(self) -> float:
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _REG_PATH) as k:
                return float(self._dec(winreg.QueryValueEx(k, _REG_VALUE)[0]) or 0)
        except Exception:
            return 0.0

    def _reg_write(self, ts: float) -> None:
        try:
            import winreg

            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, _REG_PATH) as k:
                winreg.SetValueEx(k, _REG_VALUE, 0, winreg.REG_SZ, self._enc(ts))
        except Exception:
            pass

    def _db_read(self) -> float:
        try:
            from ..database import SessionLocal
            from ..models import Setting

            with SessionLocal() as db:
                s = db.get(Setting, _DB_KEY)
                return float(self._dec(s.value) or 0) if s else 0.0
        except Exception:
            return 0.0

    def _db_write(self, ts: float) -> None:
        try:
            from ..database import SessionLocal
            from ..models import Setting

            with SessionLocal() as db:
                s = db.get(Setting, _DB_KEY) or Setting(key=_DB_KEY)
                s.value = self._enc(ts)
                db.add(s)
                db.commit()
        except Exception:
            log.debug("Falha ao gravar âncora de tempo no banco", exc_info=True)

    def _last_seen(self, store: dict | None) -> float:
        file_ts = float(store.get("ls", 0)) if store else 0.0
        return max(file_ts, self._reg_read(), self._db_read())

    def _persist_last_seen(self, store: dict | None, ts: float) -> None:
        if store is not None:
            store["ls"] = ts
            self._write_store(store)
        self._reg_write(ts)
        self._db_write(ts)

    # ---------- regras ----------
    def _evaluate(self, data: dict, last_seen: float, now: float, store: dict) -> LicenseState:
        base = dict(
            hwid=self.hwid, customer=data.get("c"), issued=data.get("i"), expires=data.get("e"), license_id=data.get("_id")
        )
        if normalize_hwid(data.get("h", "")) != normalize_hwid(self.hwid):
            return LicenseState("hwid_mismatch", "Esta licença pertence a outro computador.", **base)
        try:
            issued, expires = _parse_date(data.get("i")), _parse_date(data.get("e"))
        except ValueError:
            return LicenseState("invalid", "Datas da licença inválidas.", **base)

        today = date.fromtimestamp(now)
        if now + CLOCK_TOLERANCE_S < last_seen or (issued and today < issued - timedelta(days=1)):
            return LicenseState(
                "clock_tampered",
                "A data/hora do Windows está anterior ao último uso do sistema. "
                "Corrija o relógio do computador para continuar.",
                **base,
            )
        if store.get("rv"):
            return LicenseState("revoked", "Esta licença foi cancelada pelo fornecedor. Entre em contato com o suporte.", **base)

        effective_ts = max(now, last_seen)
        effective = date.fromtimestamp(effective_ts)
        if expires and effective > expires:
            return LicenseState("expired", f"Licença expirada em {expires.strftime('%d/%m/%Y')}.", **base)

        since = None
        if list_url():
            last_check = float(store.get("lc", 0))
            since = max(0, int((effective_ts - last_check) // 86400))
            if effective_ts - last_check > OFFLINE_GRACE_DAYS * 86400:
                return LicenseState(
                    "check_required",
                    f"A licença não é verificada há {since} dias. Conecte o computador à internet "
                    "e clique em 'Verificar agora'.",
                    days_since_check=since,
                    **base,
                )

        days_left = (expires - effective).days if expires else None
        msg = "Licença vitalícia ativa." if not expires else f"Licença válida até {expires.strftime('%d/%m/%Y')}."
        return LicenseState("valid", msg, days_left=days_left, days_since_check=since, **base)

    def refresh(self) -> LicenseState:
        with self._lock:
            now = time.time()
            store, exists = self._read_store()
            last = self._last_seen(store)
            if now + CLOCK_TOLERANCE_S >= last:
                self._persist_last_seen(store, max(now, last))

            if store is None or "key" not in store:
                if exists:
                    st = LicenseState("invalid", "O arquivo de licença está corrompido ou não pertence a este computador.", self.hwid)
                else:
                    st = LicenseState("missing", "Sistema não ativado. Informe a chave de licença.", self.hwid)
            else:
                try:
                    st = self._evaluate(decode_key(store["key"]), last, now, store)
                except LicenseError as e:
                    st = LicenseState(e.code, e.message, self.hwid)
            if not st.valid:
                log.warning("Licença: %s - %s", st.status, st.message)
            self._state, self._checked_at = st, now
            return st

    def activate(self, key: str) -> LicenseState:
        with self._lock:
            data = decode_key(key)
            now = time.time()
            old, _ = self._read_store()
            last = self._last_seen(old)
            new = {"key": clean_key(key), "act": now, "lc": now, "seq": int((old or {}).get("seq", 0))}
            st = self._evaluate(data, last, now, new)
            if not st.valid:
                raise LicenseError(st.status, st.message)

        if list_url():
            try:
                lst = fetch_revocation_list()
                if int(lst.get("seq", 0)) >= new["seq"]:
                    new["seq"] = int(lst.get("seq", 0))
                    if data["_id"] in set(lst.get("revoked", [])):
                        raise LicenseError("revoked", "Esta licença foi cancelada pelo fornecedor.")
            except LicenseError:
                raise
            except Exception as e:  # sem internet: ativa e conta os dias de tolerância a partir de agora
                log.info("Ativação sem verificação online (%s)", e)

        with self._lock:
            self._persist_last_seen(new, max(now, last))
            log.info("Licença %s ativada para %s", data["_id"], data.get("c"))
            return self.refresh()

    def online_check(self, force: bool = False) -> bool | None:
        """True = verificado; False = falhou (sem internet/lista inválida); None = não necessário."""
        if not list_url():
            return None
        with self._lock:
            store, _ = self._read_store()
            if not store or "key" not in store:
                return None
            if not force and time.time() - float(store.get("lc", 0)) < ONLINE_CHECK_INTERVAL_S:
                return None
        try:
            lst = fetch_revocation_list()
        except Exception as e:
            log.warning("Verificação online da licença falhou: %s", e)
            return False
        with self._lock:
            store, _ = self._read_store()
            if not store or "key" not in store:
                return None
            seq = int(lst.get("seq", 0))
            if seq < int(store.get("seq", 0)):
                log.warning("Lista de licenças recebida é mais antiga que a última vista (seq %s).", seq)
                return False
            try:
                lid = decode_key(store["key"])["_id"]
            except LicenseError:
                return None
            store["rv"] = lid in set(lst.get("revoked", []))
            store["seq"] = seq
            store["lc"] = time.time()
            self._write_store(store)
            log.info("Licença verificada online (seq %s, cancelada=%s)", seq, store["rv"])
        self.refresh()
        return True

    def current(self) -> LicenseState:
        st = self._state
        if st is None or time.time() - self._checked_at > RECHECK_INTERVAL_S:
            st = self.refresh()
        return st
