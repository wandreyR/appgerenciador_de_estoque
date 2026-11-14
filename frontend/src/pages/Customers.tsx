import { useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { api, errMsg, qs } from "../lib/api";
import type { Customer } from "../lib/types";
import { useDebounced, useLoad } from "../lib/useLoad";
import { CustomerFormModal } from "../components/CustomerFormModal";
import { useToast } from "../components/Toast";
import { Button, Card, EmptyState, ErrorBox, Input, PageHeader, Spinner } from "../components/ui";

export default function Customers() {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useLoad(() => api<Customer[]>(`/api/customers${qs({ q: dq })}`), [dq]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  async function remove(c: Customer) {
    if (!window.confirm(`Excluir o cliente "${c.name}"? Os pedidos existentes serão mantidos.`)) return;
    try {
      await api(`/api/customers/${c.id}`, { method: "DELETE" });
      push("success", "Cliente excluído.");
      list.reload();
    } catch (e) {
      push("error", errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Novo cliente
          </Button>
        }
      />
      <Card>
        <div className="relative mb-4">
          <Search className="absolute top-3 left-3 size-4 text-muted" />
          <Input className="pl-9" placeholder="Buscar por nome, telefone ou documento..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.error && <ErrorBox message={list.error} />}
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <EmptyState icon={<Users className="size-10" />} title="Nenhum cliente cadastrado" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="px-3 font-medium">Telefone</th>
                <th className="px-3 font-medium">Documento</th>
                <th className="px-3 font-medium">Cidade</th>
                <th className="px-3 text-right font-medium">Pedidos</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {list.data.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/50">
                  <td className="py-3 pr-3 font-medium">{c.name}</td>
                  <td className="px-3 text-muted">{c.phone ?? "—"}</td>
                  <td className="px-3 text-muted">{c.document ?? "—"}</td>
                  <td className="px-3 text-muted">{c.city ?? "—"}</td>
                  <td className="px-3 text-right tabular-nums">{c.order_count ?? 0}</td>
                  <td className="pl-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <CustomerFormModal
        open={open}
        customer={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          list.reload();
        }}
      />
    </>
  );
}
