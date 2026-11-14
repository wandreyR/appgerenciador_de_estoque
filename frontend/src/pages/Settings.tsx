import { useEffect, useRef, useState } from "react";
import { Download, KeyRound, Power, Save, Upload } from "lucide-react";
import { api, errMsg, uploadFile } from "../lib/api";
import { isoDate } from "../lib/format";
import type { Settings } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { useLicense } from "../components/License";
import { useToast } from "../components/Toast";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner, Textarea } from "../components/ui";

type Info = { app_name: string; version: string; data_dir: string; backup_dir: string };

export default function SettingsPage() {
  const { push } = useToast();
  const { license } = useLicense();
  const settings = useLoad(() => api<Settings>("/api/settings"), []);
  const info = useLoad(() => api<Info>("/api/system/info"), []);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [closed, setClosed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await api<Settings>("/api/settings", { method: "PUT", json: form }));
      push("success", "Dados da empresa salvos.");
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const r = await uploadFile<{ safety_backup: string }>("/api/backup/restore", restoreFile);
      push("success", `Backup restaurado. Cópia do estado anterior salva em:\n${r.safety_backup}`);
      setRestoreFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setRestoring(false);
    }
  }

  async function shutdown() {
    if (!window.confirm("Encerrar o sistema? Para abrir novamente, execute o programa.")) return;
    try {
      await api("/api/system/shutdown", { method: "POST" });
      setClosed(true);
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  if (closed)
    return (
      <div className="py-24 text-center">
        <Power className="mx-auto mb-4 size-10 text-accent" />
        <p className="text-lg font-semibold">Sistema encerrado.</p>
        <p className="text-sm text-muted">Você já pode fechar esta aba.</p>
      </div>
    );

  if (!form) return <Spinner />;
  const set = (k: keyof Settings) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title="Dados da empresa (cabeçalho do romaneio)"
          actions={
            <Button size="sm" variant="primary" loading={saving} icon={<Save className="size-3.5" />} onClick={save}>
              Salvar
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome da empresa" className="col-span-2">
              <Input value={form.company_name} onChange={set("company_name")} />
            </Field>
            <Field label="CNPJ / CPF">
              <Input value={form.company_document} onChange={set("company_document")} />
            </Field>
            <Field label="Telefone">
              <Input value={form.company_phone} onChange={set("company_phone")} />
            </Field>
            <Field label="Endereço">
              <Input value={form.company_address} onChange={set("company_address")} />
            </Field>
            <Field label="Cidade / UF">
              <Input value={form.company_city} onChange={set("company_city")} />
            </Field>
            <Field label="Rodapé da impressão" className="col-span-2">
              <Textarea value={form.print_footer} onChange={set("print_footer")} placeholder="Confira cor, tamanho e quantidade antes de embalar." />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Backup e restauração">
            <p className="mb-4 text-sm text-muted">
              O backup gera um arquivo <b className="text-text">.zip</b> com o banco de dados e todas as fotos. Guarde-o em um pendrive ou na nuvem. O
              sistema também faz um backup automático por dia.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/backup" download>
                <Button variant="primary" icon={<Download className="size-4" />}>
                  Fazer backup agora
                </Button>
              </a>
              <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                Restaurar backup...
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  setRestoreFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
            {info.data && (
              <dl className="mt-4 space-y-1 text-xs text-muted">
                <div>
                  Dados: <code className="text-text">{info.data.data_dir}</code>
                </div>
                <div>
                  Backups automáticos: <code className="text-text">{info.data.backup_dir}</code>
                </div>
              </dl>
            )}
          </Card>

          <Card title="Licença">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" />
                <Badge tone="ok">Ativa</Badge>
                <span>{license?.lifetime ? "Vitalícia" : `Válida até ${isoDate(license?.expires)}`}</span>
              </div>
              <div className="text-muted">
                Licenciado para: <span className="text-text">{license?.customer}</span>
              </div>
              <div className="text-muted">
                HWID: <code className="text-text">{license?.hwid}</code>
              </div>
              <div className="text-muted">Versão do sistema: {info.data?.version}</div>
            </div>
          </Card>

          <Card title="Sistema">
            <p className="mb-4 text-sm text-muted">Encerra o servidor local. Os dados ficam salvos automaticamente.</p>
            <Button variant="danger" icon={<Power className="size-4" />} onClick={shutdown}>
              Encerrar sistema
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={!!restoreFile}
        onClose={() => setRestoreFile(null)}
        title="Restaurar backup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRestoreFile(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={restoring} onClick={restore}>
              Substituir dados atuais
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Os dados atuais (produtos, pedidos, clientes e fotos) serão <b className="text-text">substituídos</b> pelo conteúdo de{" "}
          <b className="text-text">{restoreFile?.name}</b>. Antes disso, uma cópia de segurança do estado atual será salva automaticamente na pasta de backups.
        </p>
      </Modal>
    </>
  );
}
