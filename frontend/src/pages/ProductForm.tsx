import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { api, errMsg, uploadFile } from "../lib/api";
import { COLOR_PRESETS, money, sortSizes } from "../lib/format";
import type { Category, Product } from "../lib/types";
import { ImagePicker } from "../components/ImagePicker";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea, cx } from "../components/ui";

type Cell = { id?: number; quantity: number; min_stock: number };
type Row = {
  key: string;
  id?: number;
  name: string;
  hex: string;
  imageUrl: string | null;
  file?: File;
  preview?: string;
  removeImage?: boolean;
  cells: Record<string, Cell>;
};

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "Letras", sizes: ["PP", "P", "M", "G", "GG"] },
  { label: "Plus size", sizes: ["G1", "G2", "G3"] },
  { label: "Numeração", sizes: ["34", "36", "38", "40", "42", "44", "46"] },
  { label: "Infantil", sizes: ["2", "4", "6", "8", "10", "12", "14"] },
  { label: "Único", sizes: ["U"] },
];

let seq = 0;
const newKey = () => `row-${++seq}`;
const parseNum = (s: string) => {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const fmtNum = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const { push } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ category_id: "", name: "", sku_base: "", cost_price: "", sale_price: "", notes: "" });
  const [main, setMain] = useState<{ url: string | null; file?: File; preview?: string; remove?: boolean }>({ url: null });
  const [sizes, setSizes] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultMin, setDefaultMin] = useState(2);
  const [customSize, setCustomSize] = useState("");
  const [newCat, setNewCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cats = await api<Category[]>("/api/categories");
        setCategories(cats);
        if (id) {
          const p = await api<Product>(`/api/products/${id}`);
          setForm({
            category_id: String(p.category_id),
            name: p.name,
            sku_base: p.sku_base,
            cost_price: fmtNum(p.cost_price),
            sale_price: fmtNum(p.sale_price),
            notes: p.notes ?? "",
          });
          setMain({ url: p.image_url });
          setSizes(p.sizes);
          setRows(
            p.colors.map((c) => ({
              key: newKey(),
              id: c.id,
              name: c.name,
              hex: c.hex,
              imageUrl: c.thumb_url,
              cells: Object.fromEntries(c.variants.map((v) => [v.size, { id: v.id, quantity: v.quantity, min_stock: v.min_stock }])),
            })),
          );
        } else {
          const initial = ["P", "M", "G"];
          setSizes(initial);
          setRows([{ key: newKey(), name: "", hex: "#111111", imageUrl: null, cells: {} }]);
          if (cats[0]) setForm((f) => ({ ...f, category_id: String(cats[0].id) }));
        }
      } catch (e) {
        push("error", errMsg(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, push]);

  const cellOf = (r: Row, s: string): Cell => r.cells[s] ?? { quantity: 0, min_stock: defaultMin };

  const totals = useMemo(() => {
    const bySize: Record<string, number> = {};
    let all = 0;
    for (const r of rows)
      for (const s of sizes) {
        const q = cellOf(r, s).quantity;
        bySize[s] = (bySize[s] ?? 0) + q;
        all += q;
      }
    return { bySize, all };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sizes, defaultMin]);

  // ---------- grade ----------
  function addSizes(list: string[]) {
    const clean = list.map((s) => s.trim().toUpperCase()).filter(Boolean);
    setSizes((cur) => sortSizes(Array.from(new Set([...cur, ...clean]))));
  }
  function removeSize(s: string) {
    if (rows.some((r) => cellOf(r, s).quantity > 0) && !window.confirm(`O tamanho ${s} possui estoque. Remover mesmo assim?`)) return;
    setSizes((cur) => cur.filter((x) => x !== s));
    setRows((rs) =>
      rs.map((r) => {
        const cells = { ...r.cells };
        delete cells[s];
        return { ...r, cells };
      }),
    );
  }
  const patchRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  function setCell(r: Row, s: string, patch: Partial<Cell>) {
    patchRow(r.key, { cells: { ...r.cells, [s]: { ...cellOf(r, s), ...patch } } });
  }
  function setColorName(r: Row, name: string) {
    const preset = COLOR_PRESETS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    patchRow(r.key, preset ? { name, hex: preset.hex } : { name });
  }
  function removeRow(r: Row) {
    if (Object.values(r.cells).some((c) => c.quantity > 0) && !window.confirm(`A cor "${r.name}" possui estoque. Remover?`)) return;
    setRows((rs) => rs.filter((x) => x.key !== r.key));
  }
  function applyMinToAll() {
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        cells: Object.fromEntries(sizes.map((s) => [s, { ...cellOf(r, s), min_stock: defaultMin }])),
      })),
    );
  }

  async function createCategory() {
    if (!newCat?.trim()) return;
    try {
      const c = await api<Category>("/api/categories", { method: "POST", json: { name: newCat } });
      setCategories((l) => [...l, c].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, category_id: String(c.id) }));
      setNewCat(null);
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  // ---------- salvar ----------
  async function save() {
    if (!form.name.trim()) return push("error", "Informe o nome do modelo.");
    if (!form.sku_base.trim()) return push("error", "Informe o código/SKU base.");
    if (!form.category_id) return push("error", "Selecione o tipo de produto.");
    if (!rows.length) return push("error", "Adicione pelo menos uma cor.");
    if (!sizes.length) return push("error", "Adicione pelo menos um tamanho.");
    if (rows.some((r) => !r.name.trim())) return push("error", "Todas as cores precisam de um nome.");

    const payload = {
      category_id: Number(form.category_id),
      name: form.name,
      sku_base: form.sku_base,
      cost_price: parseNum(form.cost_price),
      sale_price: parseNum(form.sale_price),
      notes: form.notes,
      colors: rows.map((r) => ({
        id: r.id,
        name: r.name.trim(),
        hex: r.hex.toUpperCase(),
        variants: sizes.map((s) => {
          const c = cellOf(r, s);
          return { id: c.id, size: s, quantity: c.quantity, min_stock: c.min_stock };
        }),
      })),
    };

    setSaving(true);
    try {
      const saved = editing
        ? await api<Product>(`/api/products/${id}`, { method: "PUT", json: payload })
        : await api<Product>("/api/products", { method: "POST", json: payload });

      const uploads: Promise<unknown>[] = [];
      if (main.file) uploads.push(uploadFile(`/api/products/${saved.id}/image`, main.file));
      else if (main.remove && saved.image_url) uploads.push(api(`/api/products/${saved.id}/image`, { method: "DELETE" }));
      rows.forEach((r, i) => {
        const cid = saved.colors[i]?.id;
        if (!cid) return;
        if (r.file) uploads.push(uploadFile(`/api/colors/${cid}/image`, r.file));
        else if (r.removeImage && saved.colors[i].image_url) uploads.push(api(`/api/colors/${cid}/image`, { method: "DELETE" }));
      });
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
      if (failed.length) push("error", `Produto salvo, mas ${failed.length} foto(s) falharam: ${errMsg(failed[0].reason)}`);
      else push("success", editing ? "Produto atualizado." : "Produto cadastrado.");
      nav("/produtos");
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  const cost = parseNum(form.cost_price);
  const sale = parseNum(form.sale_price);
  const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

  return (
    <>
      <PageHeader
        title={editing ? "Editar produto" : "Novo produto"}
        subtitle="Dados do modelo e grade de cores × tamanhos"
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => nav("/produtos")}>
              Voltar
            </Button>
            <Button variant="primary" icon={<Save className="size-4" />} loading={saving} onClick={save}>
              Salvar produto
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card title="Dados do modelo">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex flex-col items-center gap-2">
              <ImagePicker
                size={150}
                label="Foto do modelo"
                url={main.preview ?? (main.remove ? null : main.url)}
                onPick={(f) => setMain({ url: main.url, file: f, preview: URL.createObjectURL(f) })}
                onRemove={() => setMain({ url: main.url, remove: true })}
              />
              <span className="text-[11px] text-muted">Foto geral (opcional)</span>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-6">
              <Field label="Tipo de produto *" className="md:col-span-2">
                {newCat === null ? (
                  <div className="flex gap-2">
                    <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">Selecione...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Button title="Novo tipo" onClick={() => setNewCat("")}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Ex.: Cropped"
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createCategory()}
                    />
                    <Button variant="primary" onClick={createCategory}>
                      OK
                    </Button>
                    <Button variant="ghost" onClick={() => setNewCat(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
              </Field>
              <Field label="Nome do modelo *" className="md:col-span-3">
                <Input placeholder="Ex.: Blusa Manga Bufante" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Código / SKU base *" className="md:col-span-1">
                <Input
                  className="font-mono uppercase"
                  placeholder="BL-001"
                  value={form.sku_base}
                  onChange={(e) => setForm({ ...form, sku_base: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Preço de custo (R$)" className="md:col-span-2">
                <Input inputMode="decimal" placeholder="0,00" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </Field>
              <Field label="Preço de venda (R$)" className="md:col-span-2">
                <Input inputMode="decimal" placeholder="0,00" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </Field>
              <div className="flex items-end pb-2 text-sm text-muted md:col-span-2">
                {sale > 0 && (
                  <span>
                    Margem: <b className={margin >= 0 ? "text-ok" : "text-danger"}>{margin.toFixed(1)}%</b> ({money(sale - cost)} por peça)
                  </span>
                )}
              </div>
              <Field label="Observações" className="md:col-span-6">
                <Textarea
                  placeholder="Tecido, composição, fornecedor, instruções de lavagem..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="Grade: cores × tamanhos"
          actions={<span className="text-sm text-muted">Total: <b className="text-accent">{totals.all}</b> peças</span>}
        >
          {/* tamanhos */}
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Tamanhos:</span>
              {sizes.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/10 py-1 pr-1 pl-2.5 text-sm font-bold text-accent">
                  {s}
                  <button onClick={() => removeSize(s)} className="rounded p-0.5 hover:bg-accent/20 cursor-pointer" title={`Remover ${s}`}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-24 text-xs uppercase"
                  placeholder="Outro..."
                  value={customSize}
                  maxLength={12}
                  onChange={(e) => setCustomSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customSize.trim()) {
                      addSizes([customSize]);
                      setCustomSize("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customSize.trim()) addSizes([customSize]);
                    setCustomSize("");
                  }}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-muted">Adicionar grade pronta:</span>
              {SIZE_PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant="ghost" className="border border-line" onClick={() => addSizes(p.sizes)}>
                  {p.label}
                </Button>
              ))}
              <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                Estoque mínimo padrão
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-16 text-center"
                  value={defaultMin}
                  onChange={(e) => setDefaultMin(Math.max(0, Number(e.target.value) || 0))}
                />
                <Button size="sm" variant="ghost" className="border border-line" onClick={applyMinToAll}>
                  Aplicar a todos
                </Button>
              </span>
            </div>
          </div>

          {/* matriz */}
          <div className="overflow-x-auto rounded-lg border border-line/60">
            <table className="w-full text-sm">
              <thead className="bg-ink/50">
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 text-left font-medium">Foto</th>
                  <th className="px-3 py-2.5 text-left font-medium">Cor</th>
                  {sizes.map((s) => (
                    <th key={s} className="px-1 py-2.5 text-center">
                      <span className="text-base font-bold text-text">{s}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {rows.map((r) => {
                  const rowTotal = sizes.reduce((a, s) => a + cellOf(r, s).quantity, 0);
                  const preview = r.preview ?? (r.removeImage ? null : r.imageUrl);
                  return (
                    <tr key={r.key} className="align-middle">
                      <td className="px-3 py-3">
                        <ImagePicker
                          size={64}
                          label="Foto"
                          hex={r.hex}
                          url={preview}
                          onPick={(f) => patchRow(r.key, { file: f, preview: URL.createObjectURL(f), removeImage: false })}
                          onRemove={() => patchRow(r.key, { file: undefined, preview: undefined, removeImage: true })}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-line" title="Escolher cor">
                            <input
                              type="color"
                              value={r.hex.toLowerCase()}
                              onChange={(e) => patchRow(r.key, { hex: e.target.value.toUpperCase() })}
                              className="absolute -inset-2 size-[calc(100%+1rem)]"
                            />
                          </label>
                          <div className="w-44">
                            <Input
                              list="color-presets"
                              placeholder="Nome da cor"
                              value={r.name}
                              onChange={(e) => setColorName(r, e.target.value)}
                              className="h-9"
                            />
                            <div className="mt-0.5 font-mono text-[10px] text-muted">{r.hex}</div>
                          </div>
                        </div>
                      </td>
                      {sizes.map((s) => {
                        const c = cellOf(r, s);
                        const low = c.min_stock > 0 && c.quantity <= c.min_stock;
                        return (
                          <td key={s} className="px-1 py-3 text-center">
                            <div className="mx-auto flex w-[68px] flex-col gap-1">
                              <Input
                                type="number"
                                min={0}
                                value={c.quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setCell(r, s, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                                className={cx("h-9 px-1 text-center text-base font-semibold", low && "border-accent/70 text-accent")}
                                title={`Quantidade ${r.name} ${s}`}
                              />
                              <label className="flex items-center justify-center gap-1 text-[10px] text-muted" title="Estoque mínimo (alerta)">
                                mín
                                <input
                                  type="number"
                                  min={0}
                                  value={c.min_stock}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => setCell(r, s, { min_stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                                  className="w-8 rounded border border-line/60 bg-ink/40 text-center text-[11px] text-text focus:border-accent focus:outline-none"
                                />
                              </label>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{rowTotal}</td>
                      <td className="pr-3">
                        <Button variant="ghost" size="sm" title="Remover cor" onClick={() => removeRow(r)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && sizes.length > 0 && (
                <tfoot className="bg-ink/40 text-xs text-muted">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Total por tamanho
                    </td>
                    {sizes.map((s) => (
                      <td key={s} className="py-2 text-center font-semibold text-text tabular-nums">
                        {totals.bySize[s] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-sm font-bold text-accent tabular-nums">{totals.all}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <Button
            className="mt-4"
            icon={<Plus className="size-4" />}
            onClick={() => setRows((rs) => [...rs, { key: newKey(), name: "", hex: "#888888", imageUrl: null, cells: {} }])}
          >
            Adicionar cor
          </Button>
          <p className="mt-3 text-xs text-muted">
            Dica: envie uma foto para cada cor — ela aparece na tela de pedidos e no romaneio impresso, evitando erros na separação.
          </p>
          <datalist id="color-presets">
            {COLOR_PRESETS.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </Card>

        <div className="flex justify-end">
          <Button variant="primary" size="lg" icon={<Save className="size-5" />} loading={saving} onClick={save}>
            Salvar produto
          </Button>
        </div>
      </div>
    </>
  );
}
