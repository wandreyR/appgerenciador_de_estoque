import { useState } from "react";
import { Check, Copy, KeyRound, Power, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, errMsg } from "../lib/api";
import type { LicenseStatus } from "../lib/types";
import { Button, ErrorBox, Textarea } from "../components/ui";

export default function Activation({ status, onActivated }: { status: LicenseStatus; onActivated: (s: LicenseStatus) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(status.hwid);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = status.hwid;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function activate() {
    setError(null);
    setLoading(true);
    try {
      onActivated(await api<LicenseStatus>("/api/license/activate", { method: "POST", json: { key } }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  const [checking, setChecking] = useState(false);
  async function checkNow() {
    setError(null);
    setChecking(true);
    try {
      const s = await api<LicenseStatus>("/api/license/check", { method: "POST" });
      if (s.valid) onActivated(s);
      else setError(s.message);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setChecking(false);
    }
  }

  const showStatus = status.status !== "missing";
  const canCheck = status.status === "check_required" || status.status === "revoked";

  return (
    <div className="flex min-h-full items-center justify-center bg-ink p-6">
      <div className="w-full max-w-xl rounded-2xl border border-line/70 bg-surface p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-accent/15 p-3 text-accent">
            <ShieldCheck className="size-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ativação de Licença</h1>
            <p className="text-sm text-muted">{status.app_name} · versão {status.version}</p>
          </div>
        </div>

        {showStatus && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              {status.message}
              {canCheck && (
                <div className="mt-3">
                  <Button size="sm" variant="primary" loading={checking} icon={<RefreshCw className="size-3.5" />} onClick={checkNow}>
                    Verificar agora
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <ol className="mb-5 space-y-1 text-sm text-muted">
          <li>
            <b className="text-text">1.</b> Copie o código deste computador (HWID) abaixo.
          </li>
          <li>
            <b className="text-text">2.</b> Envie o código ao suporte para receber sua chave de licença.
          </li>
          <li>
            <b className="text-text">3.</b> Cole a chave recebida e clique em <b className="text-text">Ativar</b>.
          </li>
        </ol>

        <div className="mb-5">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Código do computador (HWID)</span>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded-lg border border-line bg-ink px-4 py-3 text-center font-mono text-lg tracking-[0.15em] text-accent">
              {status.hwid}
            </code>
            <Button onClick={copy} icon={copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} className="h-[52px]">
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        <label className="mb-5 block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Chave de licença</span>
          <Textarea
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="EST1-..."
            className="min-h-28 font-mono text-xs break-all"
            spellCheck={false}
          />
        </label>

        {error && (
          <div className="mb-4">
            <ErrorBox message={error} />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<Power className="size-4" />}
            onClick={() => api("/api/system/shutdown", { method: "POST" }).catch(() => {}).then(() => window.close())}
          >
            Fechar sistema
          </Button>
          <Button variant="primary" size="lg" loading={loading} disabled={key.trim().length < 20} onClick={activate} icon={<KeyRound className="size-5" />}>
            Ativar
          </Button>
        </div>
      </div>
    </div>
  );
}
