import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, errMsg, qs } from "../lib/api";
import { money, num } from "../lib/format";
import type { Category, Product } from "../lib/types";
import { useDebounced, useLoad } from "../lib/useLoad";
import { useToast } from "../components/Toast";
import { Badge, Button, Card, ColorDot, EmptyState, ErrorBox, Input, PageHeader, Select, Spinner, Thumb } from "../components/ui";

export default function Products() {
  const nav = useNavigate();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const dq = useDebounced(q);

  const cats = useLoad(() => api<Category[]>("/api/categories"), []);
  const list = useLoad(() => api<Product[]>(`/api/products${qs({ q: dq, category_id: cat })}`), [dq, cat]);

  async function remove(p: Product) {
    if (!window.confirm(`Excluir o produto "${p.name}" e toda a sua grade?`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      push("success", "Produto excluído.");
      list.reload();
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Modelos e grades de cores e tamanhos"
        actions={
          <Link to="/produtos/novo">
            <Button variant="primary" icon={<Plus className="size-4" />}>
              Novo produto
            </Button>
          </Link>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute top-3 left-3 size-4 text-muted" />
            <Input className="pl-9" placeholder="Buscar por nome, SKU ou cor..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data ? (
          <Spinner />
        ) : list.data?.length === 0 ? (
          <EmptyState
            icon={<Package className="size-10" />}
            title="Nenhum produto encontrado"
            text="Cadastre seu primeiro modelo com a grade de cores e tamanhos."
            action={
              <Link to="/produtos/novo">
                <Button variant="primary">Cadastrar produto</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="px-3 font-medium">Categoria</th>
                  <th className="px-3 font-medium">Cores</th>
                  <th className="px-3 font-medium">Tamanhos</th>
                  <th className="px-3 text-right font-medium">Preço</th>
                  <th className="px-3 text-right font-medium">Estoque</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {list.data?.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-2/50" onClick={() => nav(`/produtos/${p.id}`)}>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={p.thumb_url ?? p.colors.find((c) => c.thumb_url)?.thumb_url} size={52} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-xs text-muted">{p.sku_base}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 text-muted">{p.category_name}</td>
                    <td className="px-3">
                      <div className="flex max-w-48 flex-wrap gap-1">
                        {p.colors.map((c) => (
                          <span key={c.id} title={c.name}>
                            <ColorDot hex={c.hex} size={16} />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 text-xs text-muted">{p.sizes.join(" · ")}</td>
                    <td className="px-3 text-right tabular-nums">{money(p.sale_price)}</td>
                    <td className="px-3 text-right">
                      <div className="font-semibold tabular-nums">{num(p.total_quantity)}</div>
                      {p.low_stock_count > 0 && <Badge tone="accent">{p.low_stock_count} abaixo do mín.</Badge>}
                    </td>
                    <td className="pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Link to={`/produtos/${p.id}`}>
                          <Button variant="ghost" size="sm" title="Editar">
                            <Pencil className="size-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" title="Excluir" onClick={() => remove(p)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
