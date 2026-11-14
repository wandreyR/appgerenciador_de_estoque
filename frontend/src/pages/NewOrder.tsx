import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Search, ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { api, errMsg, qs } from "../lib/api";
import { money } from "../lib/format";
import type { Category, Customer, FlatVariant, Order } from "../lib/types";
import { useDebounced, useLoad } from "../lib/useLoad";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { useToast } from "../components/Toast";
import { Button, Card, ColorChip, ColorDot, EmptyState, Field, Input, PageHeader, Select, SizeTag, Spinner, Textarea, Thumb, cx } from "../components/ui";

type CartLine = { v: FlatVariant; quantity: number };
type Group = { key: string; first: FlatVariant; variants: FlatVariant[] };

export default function NewOrder() {
  const nav = useNavigate();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const dq = useDebounced(q);

  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCustomer, setShowCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cats = useLoad(() => api<Category[]>("/api/categories"), []);
  const filters = useLoad(() => api<{ colors: { name: string; hex: string }[]; sizes: string[] }>("/api/variants/filters"), []);
  const customers = useLoad(() => api<Customer[]>("/api/customers"), []);
  const results = useLoad(
    () => api<FlatVariant[]>(`/api/variants${qs({ q: dq, category_id: cat, color, size, available: onlyAvailable })}`),
    [dq, cat, color, size, onlyAvailable],
  );

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const v of results.data ?? []) {
      const key = `${v.product_id}-${v.color_id}`;
      const g = map.get(key);
      if (g) g.variants.push(v);
      else map.set(key, { key, first: v, variants: [v] });
    }
    return [...map.values()];
  }, [results.data]);

  const inCart = (id: number) => cart.find((l) => l.v.id === id)?.quantity ?? 0;

  function add(v: FlatVariant) {
    setCart((c) => {
      const line = c.find((l) => l.v.id === v.id);
      if (line) {
        if (line.quantity >= v.quantity) {
          push("info", `Só há ${v.quantity} unidade(s) de ${v.product_name} ${v.color_name} ${v.size}.`);
          return c;
        }
        return c.map((l) => (l.v.id === v.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...c, { v, quantity: 1 }];
    });
  }
  const setQty = (id: number, qty: number) =>
    setCart((c) => c.map((l) => (l.v.id === id ? { ...l, quantity: Math.max(1, Math.min(l.v.quantity, qty)) } : l)));
  const removeLine = (id: number) => setCart((c) => c.filter((l) => l.v.id !== id));

  const totalPieces = cart.reduce((a, l) => a + l.quantity, 0);
  const total = cart.reduce((a, l) => a + l.quantity * l.v.sale_price, 0);

  async function submit() {
    if (!customerId) return push("error", "Selecione o cliente.");
    if (!cart.length) return push("error", "Adicione pelo menos um item.");
    setSubmitting(true);
    try {
      const o = await api<Order>("/api/orders", {
        method: "POST",
        json: { customer_id: Number(customerId), notes, items: cart.map((l) => ({ variant_id: l.v.id, quantity: l.quantity })) },
      });
      push("success", `Pedido #${o.number} confirmado. Estoque baixado.`);
      nav(`/pedidos/${o.id}`);
    } catch (e) {
      push("error", errMsg(e));
      results.reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Novo pedido" subtitle="Busque as peças, escolha cor e tamanho e confirme para baixar o estoque" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        {/* catálogo */}
        <Card>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-[1fr_170px_170px_120px]">
            <div className="relative col-span-2 lg:col-span-1">
              <Search className="absolute top-3 left-3 size-4 text-muted" />
              <Input autoFocus className="pl-9" placeholder="Nome, SKU ou cor..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Categoria</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">Cor</option>
              {filters.data?.colors.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Tamanho</option>
              {filters.data?.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-[var(--color-accent)]" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Mostrar apenas com saldo disponível
          </label>

          {results.loading && !results.data ? (
            <Spinner />
          ) : groups.length === 0 ? (
            <EmptyState title="Nenhuma peça encontrada" text="Ajuste a busca ou os filtros." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {groups.map((g) => (
                <div key={g.key} className="flex gap-3 rounded-lg border border-line/60 bg-ink/30 p-3">
                  <Thumb src={g.first.thumb_url} hex={g.first.color_hex} size={92} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={g.first.product_name}>
                      {g.first.product_name}
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{g.first.sku_base}</span>·<span>{money(g.first.sale_price)}</span>
                    </div>
                    <ColorChip name={g.first.color_name} hex={g.first.color_hex} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.variants.map((v) => {
                        const left = v.quantity - inCart(v.id);
                        return (
                          <button
                            key={v.id}
                            disabled={left <= 0}
                            onClick={() => add(v)}
                            title={`Adicionar ${v.size} (${left} disponível)`}
                            className={cx(
                              "flex flex-col items-center rounded-md border px-2 py-1 text-xs transition-colors cursor-pointer disabled:cursor-not-allowed",
                              left > 0 ? "border-line hover:border-accent hover:bg-accent/10" : "border-line/40 opacity-40",
                              inCart(v.id) > 0 && "border-accent bg-accent/10",
                            )}
                          >
                            <span className="text-sm font-bold">{v.size}</span>
                            <span className={cx("tabular-nums", v.low ? "text-accent" : "text-muted")}>{left}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* carrinho */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card title="Pedido">
            <Field label="Cliente *" className="mb-4">
              <div className="flex gap-2">
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Selecione o cliente...</option>
                  {customers.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` — ${c.city}` : ""}
                    </option>
                  ))}
                </Select>
                <Button title="Novo cliente" onClick={() => setShowCustomer(true)}>
                  <UserPlus className="size-4" />
                </Button>
              </div>
            </Field>

            {cart.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="size-8" />} title="Nenhum item" text="Clique no tamanho de uma peça para adicionar." />
            ) : (
              <ul className="-mx-1 mb-4 max-h-[46vh] divide-y divide-line/40 overflow-y-auto px-1">
                {cart.map((l) => (
                  <li key={l.v.id} className="flex items-center gap-3 py-2.5">
                    <Thumb src={l.v.thumb_url} hex={l.v.color_hex} size={46} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.v.product_name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <ColorDot hex={l.v.color_hex} size={10} /> {l.v.color_name} <SizeTag size={l.v.size} />
                      </div>
                    </div>
                    <div className="flex items-center rounded-lg border border-line">
                      <button className="px-1.5 py-1 text-muted hover:text-text cursor-pointer" onClick={() => setQty(l.v.id, l.quantity - 1)}>
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        value={l.quantity}
                        onChange={(e) => setQty(l.v.id, Number(e.target.value) || 1)}
                        className="w-10 bg-transparent text-center text-sm font-semibold focus:outline-none"
                      />
                      <button className="px-1.5 py-1 text-muted hover:text-text cursor-pointer" onClick={() => setQty(l.v.id, l.quantity + 1)}>
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="w-20 text-right text-sm tabular-nums">{money(l.quantity * l.v.sale_price)}</div>
                    <button onClick={() => removeLine(l.v.id)} className="text-muted hover:text-danger cursor-pointer">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Field label="Observações do pedido" className="mb-4">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: entregar até sexta, embalar para presente..." />
            </Field>

            <div className="mb-4 flex items-end justify-between border-t border-line/60 pt-4">
              <span className="text-sm text-muted">{totalPieces} peça(s)</span>
              <span className="text-2xl font-bold text-accent tabular-nums">{money(total)}</span>
            </div>
            <Button variant="primary" size="lg" className="w-full" loading={submitting} disabled={!cart.length} onClick={submit}>
              Confirmar pedido e baixar estoque
            </Button>
          </Card>
        </div>
      </div>

      <CustomerFormModal
        open={showCustomer}
        onClose={() => setShowCustomer(false)}
        onSaved={async (c) => {
          setShowCustomer(false);
          await customers.reload();
          setCustomerId(String(c.id));
        }}
      />
    </>
  );
}
