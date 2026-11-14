import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, errMsg } from "../lib/api";
import type { Category } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/Toast";
import { Badge, Button, Card, Input, PageHeader, Spinner } from "../components/ui";

export default function Categories() {
  const { push } = useToast();
  const list = useLoad(() => api<Category[]>("/api/categories"), []);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      push("success", ok);
      list.reload();
      return true;
    } catch (e) {
      push("error", errMsg(e));
      return false;
    }
  }

  const add = async () => {
    if (!name.trim()) return;
    if (await run(() => api("/api/categories", { method: "POST", json: { name } }), "Categoria criada.")) setName("");
  };
  const save = async () => {
    if (!edit) return;
    if (await run(() => api(`/api/categories/${edit.id}`, { method: "PUT", json: { name: edit.name } }), "Categoria renomeada.")) setEdit(null);
  };

  return (
    <>
      <PageHeader title="Categorias" subtitle="Tipos de produto (Blusa, Calça, Vestido...)" />
      <Card className="max-w-2xl">
        <div className="mb-5 flex gap-2">
          <Input placeholder="Nova categoria, ex.: Cropped" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={add}>
            Adicionar
          </Button>
        </div>
        {list.loading && !list.data ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-line/40">
            {list.data?.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                {edit?.id === c.id ? (
                  <>
                    <Input
                      autoFocus
                      className="h-9"
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && save()}
                    />
                    <Button size="sm" variant="primary" onClick={save}>
                      <Check className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{c.name}</span>
                    <Badge>{c.product_count} produto(s)</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ id: c.id, name: c.name })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.confirm(`Excluir a categoria "${c.name}"?`) &&
                        run(() => api(`/api/categories/${c.id}`, { method: "DELETE" }), "Categoria excluída.")
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
