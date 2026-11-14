import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, PackageCheck, Printer, RotateCcw, Truck } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { dateTime, money } from "../lib/format";
import type { Order, OrderStatus } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/Toast";
import { Button, Card, ColorChip, ErrorBox, Field, Input, Modal, PageHeader, SizeTag, Spinner, StatusBadge, Thumb } from "../components/ui";

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const { data: o, setData, loading, error } = useLoad(() => api<Order>(`/api/orders/${id}`), [id]);
  const [sepOpen, setSepOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [separator, setSeparator] = useState("");
  const [busy, setBusy] = useState(false);

  async function change(status: OrderStatus, extra: Record<string, string> = {}) {
    setBusy(true);
    try {
      const r = await api<Order>(`/api/orders/${id}/status`, { method: "POST", json: { status, ...extra } });
      setData(r);
      push("success", status === "cancelado" ? "Pedido cancelado e estoque devolvido." : "Status atualizado.");
      setSepOpen(false);
      setCancelOpen(false);
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !o) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!o) return null;

  return (
    <>
      <PageHeader
        title={`Pedido #${o.number}`}
        subtitle={`${o.customer_name} · ${dateTime(o.created_at)}`}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => nav("/pedidos")}>
              Pedidos
            </Button>
            {o.status !== "cancelado" && (
              <Link to={`/pedidos/${o.id}/imprimir?auto=1`}>
                <Button variant="primary" icon={<Printer className="size-4" />}>
                  Imprimir pedido para separação
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Card title={`Itens (${o.total_pieces} peças)`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Peça</th>
                <th className="px-3 font-medium">Cor</th>
                <th className="px-3 text-center font-medium">Tam.</th>
                <th className="px-3 text-right font-medium">Qtd</th>
                <th className="px-3 text-right font-medium">Unit.</th>
                <th className="pl-3 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {o.items?.map((i) => (
                <tr key={i.id}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <Thumb src={i.thumb_url} hex={i.color_hex} size={56} />
                      <div>
                        <div className="font-medium">{i.product_name}</div>
                        <div className="font-mono text-xs text-muted">{i.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3">
                    <ColorChip name={i.color_name} hex={i.color_hex} />
                  </td>
                  <td className="px-3 text-center">
                    <SizeTag size={i.size} className="text-sm" />
                  </td>
                  <td className="px-3 text-right font-semibold tabular-nums">{i.quantity}</td>
                  <td className="px-3 text-right text-muted tabular-nums">{money(i.unit_price)}</td>
                  <td className="pl-3 text-right tabular-nums">{money(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line/60">
                <td colSpan={5} className="pt-3 text-right text-muted">
                  Total
                </td>
                <td className="pt-3 text-right text-lg font-bold text-accent tabular-nums">{money(o.total)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <div className="space-y-4">
          <Card title="Status">
            <div className="mb-4">
              <StatusBadge status={o.status} />
            </div>
            <dl className="mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Criado</dt>
                <dd>{dateTime(o.created_at)}</dd>
              </div>
              {o.separated_at && (
                <div className="flex justify-between">
                  <dt className="text-muted">Separado</dt>
                  <dd>
                    {dateTime(o.separated_at)}
                    {o.separated_by ? ` · ${o.separated_by}` : ""}
                  </dd>
                </div>
              )}
              {o.cancelled_at && (
                <div className="flex justify-between">
                  <dt className="text-muted">Cancelado</dt>
                  <dd>{dateTime(o.cancelled_at)}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              {o.status === "pendente" && (
                <Button variant="primary" icon={<PackageCheck className="size-4" />} onClick={() => setSepOpen(true)}>
                  Marcar como separado
                </Button>
              )}
              {o.status === "separado" && (
                <>
                  <Button variant="primary" icon={<Truck className="size-4" />} loading={busy} onClick={() => change("entregue")}>
                    Marcar como entregue
                  </Button>
                  <Button icon={<RotateCcw className="size-4" />} loading={busy} onClick={() => change("pendente")}>
                    Voltar para separação
                  </Button>
                </>
              )}
              {o.status !== "cancelado" && (
                <Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setCancelOpen(true)}>
                  Cancelar pedido
                </Button>
              )}
            </div>
          </Card>

          <Card title="Cliente">
            <div className="space-y-1 text-sm">
              <div className="font-medium">{o.customer_name}</div>
              {o.customer_phone && <div className="text-muted">{o.customer_phone}</div>}
              {o.customer_address && <div className="text-muted">{o.customer_address}</div>}
              {o.customer_city && <div className="text-muted">{o.customer_city}</div>}
            </div>
            {o.notes && (
              <div className="mt-4 rounded-lg border border-line/60 bg-ink/40 p-3 text-sm whitespace-pre-line">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted">Observações</div>
                {o.notes}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={sepOpen}
        onClose={() => setSepOpen(false)}
        title="Confirmar separação"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSepOpen(false)}>
              Voltar
            </Button>
            <Button variant="primary" loading={busy} onClick={() => change("separado", { separated_by: separator })}>
              Confirmar separação
            </Button>
          </>
        }
      >
        <Field label="Nome do separador / conferente (opcional)">
          <Input autoFocus value={separator} onChange={(e) => setSeparator(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar pedido"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="danger" loading={busy} onClick={() => change("cancelado")}>
              Cancelar e devolver ao estoque
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          As {o.total_pieces} peças deste pedido voltarão ao estoque e a movimentação será registrada no histórico. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}
