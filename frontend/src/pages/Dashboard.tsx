import { Link } from "react-router-dom";
import { ClipboardList, DollarSign, Package, Printer, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { dateTime, money, num } from "../lib/format";
import type { DashboardData } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { Badge, Button, Card, ColorChip, EmptyState, ErrorBox, Kpi, PageHeader, SizeTag, Spinner, Thumb } from "../components/ui";

export default function Dashboard() {
  const { data, loading, error } = useLoad(() => api<DashboardData>("/api/dashboard"), []);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Visão geral do estoque e da separação de pedidos"
        actions={
          <Link to="/pedidos/novo">
            <Button variant="primary">Novo pedido</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Peças em estoque"
          value={num(data.total_pieces)}
          sub={`${num(data.product_count)} modelos · ${num(data.variant_count)} variações`}
          icon={<Package className="size-5" />}
        />
        <Kpi
          label="Valor em estoque (custo)"
          value={money(data.stock_cost_value)}
          sub={`Valor de venda: ${money(data.stock_sale_value)}`}
          icon={<DollarSign className="size-5" />}
        />
        <Kpi
          label="Pedidos p/ separar"
          value={num(data.pending_orders)}
          sub={`${num(data.separated_orders)} separados aguardando entrega`}
          icon={<ClipboardList className="size-5" />}
          highlight={data.pending_orders > 0}
        />
        <Kpi
          label="Alertas de estoque mínimo"
          value={num(data.low_stock_count)}
          sub={`${num(data.out_of_stock_count)} variações zeradas`}
          icon={<TriangleAlert className="size-5" />}
          highlight={data.low_stock_count > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title="Estoque abaixo do mínimo"
          actions={
            <Link to="/estoque?baixo=1" className="text-xs text-accent hover:underline">
              Repor estoque →
            </Link>
          }
        >
          {data.low_stock.length === 0 ? (
            <EmptyState title="Nenhum alerta" text="Todas as variações estão acima do estoque mínimo definido." />
          ) : (
            <ul className="-my-2 divide-y divide-line/50">
              {data.low_stock.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2.5">
                  <Thumb src={v.thumb_url} hex={v.color_hex} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{v.product_name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <ColorChip name={v.color_name} hex={v.color_hex} />
                      <SizeTag size={v.size} />
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={v.quantity === 0 ? "danger" : "accent"}>{v.quantity} un.</Badge>
                    <div className="mt-1 text-[11px] text-muted">mín. {v.min_stock}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Aguardando separação"
          actions={
            <Link to="/pedidos?status=pendente" className="text-xs text-accent hover:underline">
              Ver todos →
            </Link>
          }
        >
          {data.pending_list.length === 0 ? (
            <EmptyState title="Nenhum pedido pendente" text="Pedidos confirmados aparecem aqui até serem separados." />
          ) : (
            <ul className="-my-2 divide-y divide-line/50">
              {data.pending_list.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <Link to={`/pedidos/${o.id}`} className="min-w-0 flex-1 hover:text-accent">
                    <div className="text-sm font-medium">
                      #{o.number} · {o.customer_name}
                    </div>
                    <div className="text-xs text-muted">
                      {dateTime(o.created_at)} · {o.total_pieces} peças · {money(o.total)}
                    </div>
                  </Link>
                  <Link to={`/pedidos/${o.id}/imprimir?auto=1`}>
                    <Button size="sm" icon={<Printer className="size-3.5" />}>
                      Imprimir
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted">
        Vendas do mês: <b className="text-text">{money(data.month_sales)}</b> em {num(data.month_orders)} pedido(s).
      </p>
    </>
  );
}
