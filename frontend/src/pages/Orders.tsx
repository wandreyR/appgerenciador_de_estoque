import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, Printer, Search } from "lucide-react";
import { api, qs } from "../lib/api";
import { STATUS_LABEL, dateTime, money } from "../lib/format";
import type { Order } from "../lib/types";
import { useDebounced, useLoad } from "../lib/useLoad";
import { Button, Card, EmptyState, ErrorBox, Input, PageHeader, Spinner, StatusBadge, cx } from "../components/ui";

const FILTERS = ["", "pendente", "separado", "entregue", "cancelado"];

export default function Orders() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useLoad(() => api<Order[]>(`/api/orders${qs({ status, q: dq })}`), [status, dq]);

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle="Acompanhe a separação e imprima o romaneio"
        actions={
          <Link to="/pedidos/novo">
            <Button variant="primary" icon={<Plus className="size-4" />}>
              Novo pedido
            </Button>
          </Link>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-line bg-ink/40 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setParams(f ? { status: f } : {})}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
                  status === f ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text",
                )}
              >
                {f ? STATUS_LABEL[f] : "Todos"}
              </button>
            ))}
          </div>
          <div className="relative min-w-64 flex-1">
            <Search className="absolute top-3 left-3 size-4 text-muted" />
            <Input className="pl-9" placeholder="Número do pedido ou cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<ClipboardList className="size-10" />} title="Nenhum pedido" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Nº</th>
                <th className="px-3 font-medium">Data</th>
                <th className="px-3 font-medium">Cliente</th>
                <th className="px-3 text-right font-medium">Peças</th>
                <th className="px-3 text-right font-medium">Total</th>
                <th className="px-3 font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {list.data.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-surface-2/50" onClick={() => nav(`/pedidos/${o.id}`)}>
                  <td className="py-3 pr-3 font-mono font-semibold">#{o.number}</td>
                  <td className="px-3 text-muted">{dateTime(o.created_at)}</td>
                  <td className="px-3">{o.customer_name}</td>
                  <td className="px-3 text-right tabular-nums">{o.total_pieces}</td>
                  <td className="px-3 text-right tabular-nums">{money(o.total)}</td>
                  <td className="px-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {o.status !== "cancelado" && (
                      <Link to={`/pedidos/${o.id}/imprimir?auto=1`}>
                        <Button size="sm" variant="ghost" icon={<Printer className="size-4" />}>
                          Romaneio
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
