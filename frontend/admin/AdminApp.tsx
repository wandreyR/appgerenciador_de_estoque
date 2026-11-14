import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  FileCheck2,
  KeyRound,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { api, errMsg, qs, uploadFile } from "../src/lib/api";
import { dateTime, isoDate } from "../src/lib/format";
import { useDebounced, useLoad } from "../src/lib/useLoad";
import { useToast } from "../src/components/Toast";
import { Badge, Button, Card, EmptyState, Field, Input, Kpi, Modal, Spinner, Textarea, cx } from "../src/components/ui";

type Status = {
  app_name: string;
  version: string;
  data_dir: string;
  has_private_key: boolean;
  public_key: string | null;
  has_token: boolean;
  gist_id: string;
  list_url: string;
  seq: number;
  dirty: boolean;
  last_published_at: string | null;
  project_dir: string;
  counts: { total: number; ativa: number; expirada: number; excluida: number };
};

type License = {
  id: string;
  customer: string;
  hwid: string;
  issued: string;
  expires: string | null;
  key: string;
  notes: string | null;
  status: string;
  situation: "ativa" | "expirada" | "excluida";
  days_left: number | null;
  created_at: string;
  revoked_at: string | null;
};

type ChangeResult = { license: License; published: boolean; publish_error: string | null };

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export default function AdminApp() {
  const [tab, setTab] = useState<"licencas" | "publicacao" | "chaves">("licencas");
  const [status, setStatus] = useState<Status | null>(null);
  const [closed, setClosed] = useState(false);
  const { push } = useToast();

  const reloadStatus = useCallback(async () => {
    try {
      setStatus(await api<Status>("/api/status"));
    } catch (e) {
      push("error", errMsg(e));
    }
  }, [push]);

  useEffect(() => {
    reloadStatus();
  }, [reloadStatus]);

  if (closed)
    return (
      <div className="py-24 text-center">
        <Power className="mx-auto mb-4 size-10 text-accent" />
        <p className="text-lg font-semibold">LicencasAdmin encerrado.</p>
        <p className="text-sm text-muted">Você já pode fechar esta aba.</p>
      </div>
    );
  if (!status) return <Spinner />;

  const TABS = [
    { id: "licencas", label: "Licenças" },
    { id: "publicacao", label: "Publicação online" },
    { id: "chaves", label: "Chaves e cliente" },
  ] as const;

  return (
    <div className="min-h-full">
      <header className="border-b border-line/50 bg-ink">
        <div className="mx-auto flex max-w-[1300px] items-center gap-6 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/15 p-2 text-accent">
              <ShieldCheck className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="font-bold">Administrador de Licenças</div>
              <div className="text-[11px] uppercase tracking-wider text-muted">Gestor de Estoque · uso interno</div>
            </div>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "rounded-lg px-4 py-2 text-sm cursor-pointer",
                  tab === t.id ? "bg-surface font-medium text-text shadow-[inset_0_-2px_0_var(--color-accent)]" : "text-muted hover:text-text",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <Button
            className="ml-auto"
            variant="ghost"
            size="sm"
            icon={<Power className="size-4" />}
            onClick={async () => {
              if (!window.confirm("Encerrar o LicencasAdmin?")) return;
              await api("/api/shutdown", { method: "POST" }).catch(() => {});
              setClosed(true);
            }}
          >
            Encerrar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1300px] px-8 py-7">
        {!status.has_private_key && tab !== "chaves" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm text-accent">
            <TriangleAlert className="size-5 shrink-0" />
            <span className="flex-1">Nenhuma chave privada configurada. Gere ou importe a chave antes de emitir licenças.</span>
            <Button size="sm" variant="primary" onClick={() => setTab("chaves")}>
              Configurar chave
            </Button>
          </div>
        )}
        {status.dirty && (
          <PendingBanner status={status} onPublished={setStatus} goSettings={() => setTab("publicacao")} />
        )}
        {tab === "licencas" && <LicensesTab status={status} onChanged={reloadStatus} />}
        {tab === "publicacao" && <PublishTab status={status} setStatus={setStatus} />}
        {tab === "chaves" && <KeysTab status={status} setStatus={setStatus} />}
      </main>
    </div>
  );
}

function PendingBanner({ status, onPublished, goSettings }: { status: Status; onPublished: (s: Status) => void; goSettings: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm text-accent">
      <CloudUpload className="size-5 shrink-0" />
      <span className="flex-1">
        Há alterações nas licenças excluídas que ainda <b>não foram publicadas</b>. Os clientes só serão bloqueados/liberados após a publicação.
      </span>
      {status.has_token ? (
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              onPublished(await api<Status>("/api/publish", { method: "POST" }));
              push("success", "Lista publicada.");
            } catch (e) {
              push("error", errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Publicar agora
        </Button>
      ) : (
        <Button size="sm" variant="primary" onClick={goSettings}>
          Configurar publicação
        </Button>
      )}
    </div>
  );
}

// ======================= LICENÇAS =======================
function LicensesTab({ status, onChanged }: { status: Status; onChanged: () => void }) {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const dq = useDebounced(q);
  const list = useLoad(() => api<License[]>(`/api/licenses${qs({ q: dq, situation: filter })}`), [dq, filter]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<License | null>(null);
  const [toDelete, setToDelete] = useState<License | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyKey(l: License) {
    await copyText(l.key);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1500);
  }

  function reportChange(r: ChangeResult, verb: string) {
    if (r.published) push("success", `Licença ${verb} e lista publicada. O cliente será afetado na próxima verificação diária.`);
    else if (r.publish_error) push("error", `Licença ${verb}, mas a publicação falhou: ${r.publish_error}`);
    else push("info", `Licença ${verb}. Publique a lista para que tenha efeito no cliente.`);
    list.reload();
    onChanged();
  }

  async function remove(l: License) {
    try {
      reportChange(await api<ChangeResult>(`/api/licenses/${l.id}`, { method: "DELETE" }), "excluída");
      setToDelete(null);
    } catch (e) {
      push("error", errMsg(e));
    }
  }
  async function restore(l: License) {
    try {
      reportChange(await api<ChangeResult>(`/api/licenses/${l.id}/restore`, { method: "POST" }), "restaurada");
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  const c = status.counts;
  const FILTERS: [string, string][] = [
    ["", "Todas"],
    ["ativa", "Ativas"],
    ["expirada", "Expiradas"],
    ["excluida", "Excluídas"],
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Licenças emitidas" value={c.total} icon={<KeyRound className="size-5" />} />
        <Kpi label="Ativas" value={c.ativa} icon={<ShieldCheck className="size-5" />} highlight />
        <Kpi label="Expiradas" value={c.expirada} icon={<TriangleAlert className="size-5" />} />
        <Kpi label="Excluídas" value={c.excluida} icon={<Trash2 className="size-5" />} />
      </div>

      <Card
        title="Licenças"
        actions={
          <>
            <Button size="sm" icon={<FileCheck2 className="size-4" />} onClick={() => setInspectOpen(true)}>
              Verificar chave
            </Button>
            <Button size="sm" variant="primary" icon={<Plus className="size-4" />} disabled={!status.has_private_key} onClick={() => setCreating(true)}>
              Nova licença
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-line bg-ink/40 p-1">
            {FILTERS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={cx("rounded-md px-3 py-1.5 text-sm cursor-pointer", filter === v ? "bg-surface-2 font-medium" : "text-muted hover:text-text")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-64 flex-1">
            <Search className="absolute top-3 left-3 size-4 text-muted" />
            <Input className="pl-9" placeholder="Cliente, HWID, ID ou observação..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<KeyRound className="size-10" />} title="Nenhuma licença" text="Clique em 'Nova licença' e informe o HWID enviado pelo cliente." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="px-3 font-medium">HWID</th>
                <th className="px-3 font-medium">Emitida</th>
                <th className="px-3 font-medium">Validade</th>
                <th className="px-3 font-medium">Situação</th>
                <th className="pl-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {list.data.map((l) => (
                <tr key={l.id} className={cx(l.situation === "excluida" && "opacity-60")}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{l.customer}</div>
                    <div className="font-mono text-[11px] text-muted">ID {l.id}</div>
                    {l.notes && <div className="mt-0.5 max-w-72 truncate text-xs text-muted" title={l.notes}>{l.notes}</div>}
                  </td>
                  <td className="px-3 font-mono text-xs">{l.hwid}</td>
                  <td className="px-3 text-muted">{isoDate(l.issued)}</td>
                  <td className="px-3">
                    {l.expires ? (
                      <>
                        {isoDate(l.expires)}
                        {l.situation === "ativa" && l.days_left !== null && (
                          <div className={cx("text-xs", l.days_left <= 15 ? "text-accent" : "text-muted")}>{l.days_left} dia(s) restantes</div>
                        )}
                      </>
                    ) : (
                      <span className="text-ok">Vitalícia</span>
                    )}
                  </td>
                  <td className="px-3">
                    {l.situation === "ativa" && <Badge tone="ok">Ativa</Badge>}
                    {l.situation === "expirada" && <Badge tone="accent">Expirada</Badge>}
                    {l.situation === "excluida" && (
                      <div>
                        <Badge tone="danger">Excluída</Badge>
                        <div className="mt-0.5 text-[11px] text-muted">{dateTime(l.revoked_at)}</div>
                      </div>
                    )}
                  </td>
                  <td className="pl-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Copiar chave" onClick={() => copyKey(l)}>
                        {copied === l.id ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
                      </Button>
                      {l.situation === "excluida" ? (
                        <Button size="sm" variant="ghost" title="Restaurar" icon={<RotateCcw className="size-4" />} onClick={() => restore(l)}>
                          Restaurar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" title="Excluir licença" onClick={() => setToDelete(l)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <NewLicenseModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(l) => {
          setCreating(false);
          setCreated(l);
          list.reload();
          onChanged();
        }}
      />

      <Modal open={!!created} onClose={() => setCreated(null)} title="Licença gerada" width="max-w-2xl"
        footer={<Button variant="primary" onClick={() => setCreated(null)}>Fechar</Button>}>
        {created && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted">Cliente:</span> {created.customer}</div>
              <div><span className="text-muted">Validade:</span> {created.expires ? isoDate(created.expires) : "Vitalícia"}</div>
              <div><span className="text-muted">HWID:</span> <code>{created.hwid}</code></div>
              <div><span className="text-muted">ID:</span> <code>{created.id}</code></div>
            </div>
            <Textarea readOnly value={created.key} className="min-h-28 font-mono text-xs break-all" onFocus={(e) => e.target.select()} />
            <Button
              variant="primary"
              icon={copied === created.id ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => copyKey(created)}
            >
              {copied === created.id ? "Copiada!" : "Copiar chave para enviar ao cliente"}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir licença"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => toDelete && remove(toDelete)}>
              Excluir e bloquear cliente
            </Button>
          </>
        }
      >
        {toDelete && (
          <div className="space-y-3 text-sm text-muted">
            <p>
              Excluir a licença de <b className="text-text">{toDelete.customer}</b> (HWID <code className="text-text">{toDelete.hwid}</code>)?
            </p>
            <p>
              O sistema do cliente será <b className="text-text">bloqueado na próxima verificação diária</b> (em até 24h com internet; sem internet,
              o bloqueio ocorre quando acabarem os 7 dias de tolerância).
            </p>
            <p>Você pode restaurar a licença depois, se necessário.</p>
          </div>
        )}
      </Modal>

      <InspectModal open={inspectOpen} onClose={() => setInspectOpen(false)} />
    </>
  );
}

function NewLicenseModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (l: License) => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ hwid: "", customer: "", mode: "dias", days: "365", date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ hwid: "", customer: "", mode: "dias", days: "365", date: "", notes: "" });
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const l = await api<License>("/api/licenses", {
        method: "POST",
        json: {
          hwid: form.hwid,
          customer: form.customer,
          mode: form.mode,
          days: form.mode === "dias" ? Number(form.days) : null,
          date: form.mode === "data" ? form.date : null,
          notes: form.notes,
        },
      });
      onCreated(l);
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const MODES: [string, string][] = [
    ["dias", "Por dias"],
    ["data", "Até uma data"],
    ["vitalicia", "Vitalícia"],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova licença"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} icon={<KeyRound className="size-4" />} onClick={save}>
            Gerar licença
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="HWID do cliente *" hint="Código exibido na tela de ativação do sistema do cliente.">
          <Input
            autoFocus
            className="font-mono tracking-wider uppercase"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            value={form.hwid}
            onChange={(e) => setForm({ ...form, hwid: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Nome do cliente *">
          <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Ex.: Boutique Bella Moda" />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Validade</span>
          <div className="mb-3 flex gap-1 rounded-lg border border-line bg-ink/40 p-1">
            {MODES.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setForm({ ...form, mode: v })}
                className={cx("flex-1 rounded-md py-1.5 text-sm cursor-pointer", form.mode === v ? "bg-surface-2 font-medium" : "text-muted")}
              >
                {label}
              </button>
            ))}
          </div>
          {form.mode === "dias" && (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" min={1} className="w-28" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
              <span className="text-sm text-muted">dias</span>
              {[30, 90, 180, 365].map((d) => (
                <Button key={d} size="sm" variant="ghost" className="border border-line" onClick={() => setForm({ ...form, days: String(d) })}>
                  {d}
                </Button>
              ))}
            </div>
          )}
          {form.mode === "data" && <Input type="date" className="w-48" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
          {form.mode === "vitalicia" && <p className="text-sm text-muted">A licença não expira (continua sujeita à exclusão e à verificação diária).</p>}
        </div>
        <Field label="Observações (interno)">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Valor pago, contato, nº do pedido..." />
        </Field>
      </div>
    </Modal>
  );
}

function InspectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState("");
  const [info, setInfo] = useState<{ id: string; signature_ok: boolean; payload: Record<string, string | null>; record: License | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKey("");
      setInfo(null);
      setError(null);
    }
  }, [open]);

  async function check() {
    setError(null);
    setInfo(null);
    try {
      setInfo(await api("/api/licenses/inspect", { method: "POST", json: { key } }));
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Verificar chave" width="max-w-2xl" footer={<Button variant="primary" onClick={check}>Verificar</Button>}>
      <Textarea placeholder="Cole a chave EST1-..." value={key} onChange={(e) => setKey(e.target.value)} className="mb-4 min-h-24 font-mono text-xs" />
      {error && <p className="text-sm text-danger">{error}</p>}
      {info && (
        <div className="space-y-1.5 text-sm">
          <div>{info.signature_ok ? <Badge tone="ok">Assinatura válida</Badge> : <Badge tone="danger">Assinatura inválida (outra chave privada ou adulterada)</Badge>}</div>
          <div><span className="text-muted">ID:</span> <code>{info.id}</code></div>
          <div><span className="text-muted">Cliente:</span> {info.payload.c}</div>
          <div><span className="text-muted">HWID:</span> <code>{info.payload.h}</code></div>
          <div><span className="text-muted">Emitida:</span> {isoDate(info.payload.i)} · <span className="text-muted">Validade:</span> {info.payload.e ? isoDate(info.payload.e) : "Vitalícia"}</div>
          <div><span className="text-muted">No registro:</span> {info.record ? info.record.situation : "não encontrada neste computador"}</div>
        </div>
      )}
    </Modal>
  );
}

// ======================= PUBLICAÇÃO =======================
function PublishTab({ status, setStatus }: { status: Status; setStatus: (s: Status) => void }) {
  const { push } = useToast();
  const [token, setToken] = useState("");
  const [gistId, setGistId] = useState(status.gist_id);
  const [url, setUrl] = useState(status.list_url);
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(name: string, fn: () => Promise<T>, ok: string | ((r: T) => string)) {
    setBusy(name);
    try {
      const r = await fn();
      push("success", typeof ok === "string" ? ok : ok(r));
      return r;
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    const s = await run(
      "save",
      () =>
        api<Status>("/api/settings", {
          method: "PUT",
          json: { github_token: token ? token : undefined, gist_id: gistId, list_url: url },
        }),
      "Configuração salva.",
    );
    if (s) {
      setStatus(s);
      setToken("");
    }
  }

  async function publish() {
    const s = await run("publish", () => api<Status>("/api/publish", { method: "POST" }), "Lista assinada publicada.");
    if (s) {
      setStatus(s);
      setGistId(s.gist_id);
      setUrl(s.list_url);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <Card title="Publicação no GitHub Gist">
        <div className="mb-5 space-y-2 text-sm text-muted">
          <p>
            Ao excluir ou restaurar uma licença, este app assina a <b className="text-text">lista de licenças excluídas</b> com a sua chave privada e
            publica em um Gist secreto. O sistema de cada cliente baixa essa lista <b className="text-text">uma vez por dia</b>.
          </p>
          <p>A lista contém só IDs (sem nomes de clientes) e não pode ser alterada por terceiros por causa da assinatura.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Crie um token em <code className="text-text">github.com → Settings → Developer settings → Personal access tokens</code> com permissão{" "}
              <b className="text-text">gist</b> (classic) ou <b className="text-text">Gists: Read and write</b> (fine-grained).
            </li>
            <li>Cole o token abaixo, salve e clique em <b className="text-text">Publicar agora</b> (o Gist é criado automaticamente).</li>
            <li>
              Vá em <b className="text-text">Chaves e cliente</b> → <b className="text-text">Gravar no projeto</b> e recompile o GestorEstoque.exe (só
              na primeira vez ou se a URL mudar).
            </li>
          </ol>
        </div>
        <div className="space-y-4">
          <Field label={`Token do GitHub ${status.has_token ? "(salvo — deixe em branco para manter)" : ""}`} hint="Guardado criptografado com a proteção de dados do Windows (DPAPI).">
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={status.has_token ? "••••••••••••" : "ghp_... ou github_pat_..."} />
          </Field>
          <Field label="ID do Gist" hint="Preenchido automaticamente na primeira publicação.">
            <Input className="font-mono" value={gistId} onChange={(e) => setGistId(e.target.value)} />
          </Field>
          <Field label="URL da lista (usada pelos clientes)" hint="Pode ser qualquer endereço público se você preferir hospedar o arquivo em outro lugar.">
            <Input className="font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button loading={busy === "save"} onClick={saveSettings}>
              Salvar configuração
            </Button>
            <Button variant="primary" loading={busy === "publish"} icon={<CloudUpload className="size-4" />} disabled={!status.has_token || !status.has_private_key} onClick={publish}>
              Publicar agora
            </Button>
            <Button
              loading={busy === "test"}
              disabled={!status.list_url}
              onClick={() =>
                run(
                  "test",
                  () => api<{ seq: number; expected_seq: number; revoked: number }>("/api/publish/test", { method: "POST" }),
                  (r) =>
                    r.seq === r.expected_seq
                      ? `URL OK: lista assinada nº ${r.seq} com ${r.revoked} licença(s) excluída(s).`
                      : `URL acessível, mas com a lista nº ${r.seq} (última publicada: ${r.expected_seq}). Aguarde alguns minutos pelo cache do GitHub.`,
                )
              }
            >
              Testar URL
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Situação">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Token</dt><dd>{status.has_token ? <Badge tone="ok">Configurado</Badge> : <Badge>Não configurado</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Última publicação</dt><dd>{dateTime(status.last_published_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Número da lista</dt><dd>{status.seq}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pendente</dt><dd>{status.dirty ? <Badge tone="accent">Sim</Badge> : <Badge tone="ok">Não</Badge>}</dd></div>
          </dl>
        </Card>
        <Card title="Hospedagem manual">
          <p className="mb-3 text-sm text-muted">
            Prefere hospedar em outro lugar (seu site, Google Drive com link direto etc.)? Baixe o arquivo assinado e suba no endereço configurado na URL.
          </p>
          <a href="/api/publish/file" download>
            <Button icon={<Download className="size-4" />}>Baixar licencas.json</Button>
          </a>
        </Card>
      </div>
    </div>
  );
}

// ======================= CHAVES E CLIENTE =======================
function KeysTab({ status, setStatus }: { status: Status; setStatus: (s: Status) => void }) {
  const { push } = useToast();
  const [projectDir, setProjectDir] = useState(status.project_dir);
  const [genOpen, setGenOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status.has_private_key) api<{ content: string }>("/api/client-config").then((r) => setPreview(r.content)).catch(() => {});
  }, [status]);

  async function generate() {
    try {
      setStatus(await api<Status>("/api/keys/generate", { method: "POST", json: { confirm } }));
      setGenOpen(false);
      setConfirm("");
      push("success", "Novo par de chaves gerado. Grave no projeto e recompile o sistema do cliente.");
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  async function writeProject() {
    try {
      setStatus(await api<Status>("/api/settings", { method: "PUT", json: { project_dir: projectDir } }));
      const r = await api<{ path: string }>("/api/client-config/write", { method: "POST" });
      push("success", `Configuração gravada em:\n${r.path}\nRecompile o GestorEstoque.exe (scripts\\build.ps1).`);
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card title="Chave privada (assinatura)">
        {status.has_private_key ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone="ok">Configurada</Badge>
              <span className="break-all text-xs text-muted">em {status.data_dir}</span>
            </div>
            <Field label="Chave pública (vai no executável do cliente)">
              <code className="block break-all rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs text-accent">{status.public_key}</code>
            </Field>
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
              Faça backup da chave privada em local seguro (pendrive/cofre de senhas). Se ela for perdida, não será possível emitir nem excluir licenças
              dos sistemas já instalados.
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/api/keys/private" download>
                <Button variant="primary" icon={<Download className="size-4" />}>
                  Baixar backup da chave privada
                </Button>
              </a>
              <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                Importar chave
              </Button>
              <Button variant="danger" onClick={() => setGenOpen(true)}>
                Gerar novo par...
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-muted">
            <p>Nenhuma chave configurada neste computador. Importe o arquivo .pem que você já usa ou gere um par novo.</p>
            <div className="flex gap-2">
              <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                Importar chave (.pem)
              </Button>
              <Button variant="primary" onClick={generate}>
                Gerar par de chaves
              </Button>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pem"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              setStatus(await uploadFile<Status>("/api/keys/import", f));
              push("success", "Chave importada.");
            } catch (err) {
              push("error", errMsg(err));
            }
          }}
        />
      </Card>

      <Card title="Configuração do sistema do cliente">
        <p className="mb-4 text-sm text-muted">
          O GestorEstoque.exe precisa conter a chave pública e a URL da lista. Grave no código-fonte e recompile com{" "}
          <code className="text-text">scripts\build.ps1</code>. Só é preciso repetir se a chave ou a URL mudarem.
        </p>
        <Field label="Pasta do projeto do sistema" className="mb-3">
          <Input className="font-mono text-xs" value={projectDir} onChange={(e) => setProjectDir(e.target.value)} placeholder="C:\...\appgerenciadordeestoque" />
        </Field>
        <Button variant="primary" disabled={!status.has_private_key} onClick={writeProject}>
          Gravar no projeto
        </Button>
        {!status.list_url && (
          <p className="mt-3 text-xs text-accent">Atenção: a URL da lista ainda não está configurada — sem ela o cliente não fará a verificação diária.</p>
        )}
        {preview && <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-ink p-3 text-[11px] text-muted">{preview}</pre>}
      </Card>

      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Gerar novo par de chaves"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGenOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={confirm !== "GERAR NOVA CHAVE"} onClick={generate}>
              Gerar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-muted">
          <p>
            <b className="text-danger">Cuidado:</b> todas as licenças já emitidas deixarão de ser reconhecidas por executáveis compilados com a nova chave,
            e os executáveis já instalados não aceitarão licenças nem listas assinadas pela nova chave.
          </p>
          <p>A chave atual será guardada como cópia (private_key_antiga_*.pem). Digite <b className="text-text">GERAR NOVA CHAVE</b> para confirmar:</p>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
