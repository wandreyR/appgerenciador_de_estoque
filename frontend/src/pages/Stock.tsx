import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownToLine, History, Search, SlidersHorizontal } from "lucide-react";
import { api, errMsg, qs } from "../lib/api";
import { MOVEMENT_LABEL, dateTime, num } from "../lib/format";
import type { Category, FlatVariant, Movement } from "../lib/types";
import { useDebounced, useLoad } from "../lib/useLoad";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  ColorChip,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  SizeTag,
  Spinner,
  Thumb,
  cx,
} from "../components/ui";

type Kind = "entrada" | "saida" | "ajuste";
const KIND_INFO: Record<Kind, { label: string; help: string }> = {
  entrada: { label: "Entrada", help: "Soma ao saldo atual (reposição de fábrica / fornecedor)." },
  saida: { label: "Saída", help: "Subtrai do saldo (avaria, perda, brinde, uso interno)." },
  ajuste: { label: "Ajuste de inventário", help: "Define o saldo exato contado fisicamente." },
};

export default function Stock() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"saldos" | "historico">("saldos");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyLow, setOnlyLow] = useState(params.get("baixo") === "1");
  const dq = useDebounced(q);

  const cats = useLoad(() => api<Category[]>("/api/categories"), []);
  const list = useLoad(() => api<FlatVariant[]>(`/api/variants${qs({ q: dq, category_id: cat, low: onlyLow })}`), [dq, cat, onlyLow]);
  const movs = useLoad(() => (tab === "historico" ? api<Movement[]>("/api/stock/movements?limit=500") : Promise.resolve([])), [tab]);

  const [target, setTarget] = useState<FlatVariant | null>(null);
  const [kind, setKind] = useState<Kind>("entrada");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function open(v: FlatVariant, k: Kind) {
    setTarget(v);
    setKind(k);
    setQty(k === "ajuste" ? String(v.quantity) : "");
    setReason("");
  }

  async function submit() {
    if (!target) return;
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n < 0 || (kind !== "ajuste" && n === 0)) return push("error", "Informe uma quantidade válida.");
    setSaving(true);
    try {
      const r = await api<{ variant: FlatVariant }>("/api/stock/movements", {
        method: "POST",
        json: { variant_id: target.id, kind, quantity: n, reason },
      });
      list.setData((l) => l?.map((v) => (v.id === target.id ? r.variant : v)) ?? null);
      push("success", `Saldo atualizado: ${r.variant.quantity} un.`);
      setTarget(null);
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const preview = target
    ? kind === "entrada"
      ? target.quantity + (Number(qty) || 0)
      : kind === "saida"
        ? target.quantity - (Number(qty) || 0)
        : Number(qty) || 0
    : 0;

  return (
    <>
      <PageHeader title="Estoque" subtitle="Saldos por variação, reposição e ajustes de inventário" />

      <div className="mb-4 flex rounded-lg border border-line bg-surface p-1 w-fit">
        {(["saldos", "historico"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm cursor-pointer",
              tab === t ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text",
            )}
          >
            {t === "saldos" ? <SlidersHorizontal className="size-4" /> : <History className="size-4" />}
            {t === "saldos" ? "Saldos e movimentação" : "Histórico"}
          </button>
        ))}
      </div>

      {tab === "saldos" ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute top-3 left-3 size-4 text-muted" />
              <Input className="pl-9" placeholder="Buscar produto, SKU ou cor..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-52" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              Somente abaixo do mínimo
            </label>
          </div>

          {list.error && <ErrorBox message={list.error} />}
          {list.loading && !list.data ? (
            <Spinner />
          ) : !list.data?.length ? (
            <EmptyState title="Nenhuma variação encontrada" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="px-3 font-medium">Cor</th>
                  <th className="px-3 text-center font-medium">Tam.</th>
                  <th className="px-3 text-right font-medium">Saldo</th>
                  <th className="px-3 text-right font-medium">Mínimo</th>
                  <th className="pl-3 text-right font-medium">Movimentar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {list.data.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={v.thumb_url} hex={v.color_hex} size={40} />
                        <div>
                          <div className="font-medium">{v.product_name}</div>
                          <div className="font-mono text-xs text-muted">{v.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <ColorChip name={v.color_name} hex={v.color_hex} />
                    </td>
                    <td className="px-3 text-center">
                      <SizeTag size={v.size} />
                    </td>
                    <td className="px-3 text-right">
                      {v.low || v.quantity === 0 ? (
                        <Badge tone={v.quantity === 0 ? "danger" : "accent"}>{num(v.quantity)}</Badge>
                      ) : (
                        <span className="font-semibold tabular-nums">{num(v.quantity)}</span>
                      )}
                    </td>
                    <td className="px-3 text-right text-muted tabular-nums">{v.min_stock || "—"}</td>
                    <td className="pl-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="primary" icon={<ArrowDownToLine className="size-3.5" />} onClick={() => open(v, "entrada")}>
                          Entrada
                        </Button>
                        <Button size="sm" onClick={() => open(v, "saida")}>
                          Saída
                        </Button>
                        <Button size="sm" onClick={() => open(v, "ajuste")}>
                          Ajustar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          {movs.loading ? (
            <Spinner />
          ) : !movs.data?.length ? (
            <EmptyState title="Nenhuma movimentação registrada" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="px-3 font-medium">Tipo</th>
                  <th className="px-3 font-medium">Variação</th>
                  <th className="px-3 font-medium">Motivo</th>
                  <th className="px-3 text-right font-medium">Qtd</th>
                  <th className="pl-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {movs.data.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-muted">{dateTime(m.created_at)}</td>
                    <td className="px-3">
                      <Badge tone={m.delta > 0 ? "ok" : "neutral"}>{MOVEMENT_LABEL[m.kind] ?? m.kind}</Badge>
                    </td>
                    <td className="px-3">{m.description}</td>
                    <td className="px-3 text-muted">{m.reason ?? "—"}</td>
                    <td className={cx("px-3 text-right font-semibold tabular-nums", m.delta > 0 ? "text-ok" : "text-danger")}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </td>
                    <td className="pl-3 text-right tabular-nums">{m.balance_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={KIND_INFO[kind].label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={saving} onClick={submit}>
              Registrar
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-line/60 bg-ink/40 p-3">
              <Thumb src={target.thumb_url} hex={target.color_hex} size={56} />
              <div>
                <div className="font-medium">{target.product_name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <ColorChip name={target.color_name} hex={target.color_hex} />
                  <SizeTag size={target.size} />
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-muted">Saldo atual</div>
                <div className="text-xl font-bold">{target.quantity}</div>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-line bg-ink/40 p-1">
              {(Object.keys(KIND_INFO) as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setQty(k === "ajuste" ? String(target.quantity) : "");
                  }}
                  className={cx("flex-1 rounded-md py-1.5 text-sm cursor-pointer", kind === k ? "bg-surface-2 font-medium" : "text-muted")}
                >
                  {KIND_INFO[k].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{KIND_INFO[kind].help}</p>
            <Field label={kind === "ajuste" ? "Saldo contado" : "Quantidade"}>
              <Input
                autoFocus
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="text-lg font-semibold"
              />
            </Field>
            <Field label="Motivo / observação">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: NF 1234 fornecedor X" />
            </Field>
            <div className={cx("text-sm", preview < 0 ? "text-danger" : "text-muted")}>
              Saldo após a operação: <b className={preview < 0 ? "text-danger" : "text-accent"}>{preview}</b>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
