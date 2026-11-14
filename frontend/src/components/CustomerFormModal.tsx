import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import type { Customer } from "../lib/types";
import { useToast } from "./Toast";
import { Button, Field, Input, Modal, Textarea } from "./ui";

const EMPTY = { name: "", document: "", phone: "", email: "", address: "", city: "", notes: "" };

export function CustomerFormModal({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? {
              name: customer.name,
              document: customer.document ?? "",
              phone: customer.phone ?? "",
              email: customer.email ?? "",
              address: customer.address ?? "",
              city: customer.city ?? "",
              notes: customer.notes ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, customer]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) return push("error", "Informe o nome do cliente.");
    setSaving(true);
    try {
      const saved = customer
        ? await api<Customer>(`/api/customers/${customer.id}`, { method: "PUT", json: form })
        : await api<Customer>("/api/customers", { method: "POST", json: form });
      push("success", "Cliente salvo.");
      onSaved(saved);
    } catch (e) {
      push("error", errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Editar cliente" : "Novo cliente"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Salvar cliente
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome / Razão social *" className="col-span-2">
          <Input autoFocus value={form.name} onChange={set("name")} onKeyDown={(e) => e.key === "Enter" && save()} />
        </Field>
        <Field label="CPF / CNPJ">
          <Input value={form.document} onChange={set("document")} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Cidade / UF">
          <Input value={form.city} onChange={set("city")} />
        </Field>
        <Field label="Endereço" className="col-span-2">
          <Input value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Observações" className="col-span-2">
          <Textarea value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}
