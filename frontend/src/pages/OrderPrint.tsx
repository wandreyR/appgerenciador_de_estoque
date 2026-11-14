import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "../lib/api";
import { STATUS_LABEL, dateTime, sizeKey, textOn } from "../lib/format";
import type { Order, Settings } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { Button, ErrorBox, Spinner } from "../components/ui";

/**
 * Romaneio de separação em A4 — fundo branco, alto contraste, foto grande da
 * peça na cor exata, badge de cor, tamanho em destaque e checkbox para caneta.
 */
export default function OrderPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const auto = params.get("auto") === "1";
  const printed = useRef(false);

  const order = useLoad(() => api<Order>(`/api/orders/${id}`), [id]);
  const settings = useLoad(() => api<Settings>("/api/settings"), []);
  const o = order.data;
  const s = settings.data;

  const items = useMemo(() => {
    const list = [...(o?.items ?? [])];
    // ordena para facilitar o caminho no estoque: modelo > cor > tamanho
    list.sort((a, b) => {
      const ka = sizeKey(a.size);
      const kb = sizeKey(b.size);
      return (
        a.product_name.localeCompare(b.product_name) ||
        a.color_name.localeCompare(b.color_name) ||
        ka[0] - kb[0] ||
        ka[1] - kb[1] ||
        ka[2].localeCompare(kb[2])
      );
    });
    return list;
  }, [o]);

  useEffect(() => {
    if (!o) return;
    const prev = document.title;
    document.title = `Romaneio-Pedido-${o.number}`;
    return () => {
      document.title = prev;
    };
  }, [o]);

  useEffect(() => {
    if (!o || !s || !auto || printed.current) return;
    printed.current = true;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".print-page img"));
    Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.addEventListener("load", () => r(), { once: true });
              img.addEventListener("error", () => r(), { once: true });
            }),
      ),
    ).then(() => setTimeout(() => window.print(), 200));
  }, [o, s, auto]);

  if (order.error) return <ErrorBox message={order.error} />;
  if (!o || !s) return <Spinner />;

  const now = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="min-h-full bg-[#2a3546] pb-10 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink px-6 py-3">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => nav(`/pedidos/${o.id}`)}>
          Voltar ao pedido
        </Button>
        <span className="text-sm text-muted">Pré-visualização A4 · use "Salvar como PDF" na janela de impressão para gerar o arquivo</span>
        <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      <div className="print-page mt-6 shadow-2xl print:mt-0">
        {/* Cabeçalho */}
        <header className="flex items-stretch justify-between gap-4 border-b-[3px] border-black pb-3">
          <div className="min-w-0">
            <div className="text-[18pt] leading-tight font-extrabold">{s.company_name || "Minha Confecção"}</div>
            <div className="mt-1 text-[9pt] leading-snug text-[#333]">
              {[s.company_document, s.company_phone].filter(Boolean).join(" · ")}
              {(s.company_address || s.company_city) && <br />}
              {[s.company_address, s.company_city].filter(Boolean).join(" — ")}
            </div>
          </div>
          <div className="shrink-0 border-[3px] border-black px-4 py-2 text-right">
            <div className="text-[9pt] font-bold tracking-[0.2em] uppercase">Romaneio de separação</div>
            <div className="text-[26pt] leading-none font-black">Nº {o.number}</div>
            <div className="mt-1 text-[9pt]">Pedido em {dateTime(o.created_at)}</div>
          </div>
        </header>

        {/* Cliente */}
        <section className="avoid-break mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-2 border-black p-3 text-[10pt]">
          <div>
            <span className="text-[8pt] font-bold uppercase text-[#444]">Cliente</span>
            <div className="text-[14pt] leading-tight font-extrabold">{o.customer_name}</div>
            <div className="text-[9pt] text-[#222]">
              {[o.customer_phone, o.customer_document].filter(Boolean).join(" · ")}
              {(o.customer_address || o.customer_city) && " · "}
              {[o.customer_address, o.customer_city].filter(Boolean).join(" — ")}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[8pt] font-bold uppercase text-[#444]">Total de peças</span>
            <div className="text-[22pt] leading-none font-black">{o.total_pieces}</div>
            <div className="text-[8pt]">{items.length} item(ns) · {STATUS_LABEL[o.status]}</div>
          </div>
          {o.notes && (
            <div className="col-span-2 mt-1 border-t border-dashed border-black pt-1.5 text-[10pt] whitespace-pre-line">
              <b>OBS.:</b> {o.notes}
            </div>
          )}
        </section>

        {/* Assinaturas */}
        <section className="avoid-break mt-3 grid grid-cols-3 gap-3 text-[8pt]">
          {["Separado por", "Conferido por", "Data / hora da separação"].map((label) => (
            <div key={label} className="border border-black px-2 pt-6 pb-1">
              <div className="border-t border-black pt-0.5 font-bold uppercase">{label}</div>
            </div>
          ))}
        </section>

        {/* Itens */}
        <table className="mt-4 w-full border-collapse text-[10pt]">
          <thead>
            <tr className="bg-black text-left text-[8pt] tracking-wide text-white uppercase">
              <th className="w-[12mm] border border-black p-1 text-center">Sep.</th>
              <th className="w-[34mm] border border-black p-1">Foto</th>
              <th className="border border-black p-1">Produto / SKU</th>
              <th className="w-[34mm] border border-black p-1">Cor</th>
              <th className="w-[18mm] border border-black p-1 text-center">Tam.</th>
              <th className="w-[16mm] border border-black p-1 text-center">Qtd</th>
              <th className="w-[12mm] border border-black p-1 text-center">Conf.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={i.id} className="avoid-break">
                <td className="border border-black text-center align-middle">
                  <span className="inline-block size-[8mm] border-[2.5px] border-black bg-white" />
                </td>
                <td className="border border-black p-1 align-middle">
                  {i.image_url ? (
                    <img src={i.image_url} alt="" className="block h-[32mm] w-[32mm] object-cover" />
                  ) : (
                    <div className="flex h-[32mm] w-[32mm] items-center justify-center text-[8pt] font-bold" style={{ background: i.color_hex, color: textOn(i.color_hex) }}>
                      SEM FOTO
                    </div>
                  )}
                </td>
                <td className="border border-black px-2 align-middle">
                  <div className="text-[8pt] text-[#555]">#{idx + 1}</div>
                  <div className="text-[11pt] leading-tight font-bold">{i.product_name}</div>
                  <div className="mt-1 font-mono text-[9pt]">{i.sku}</div>
                </td>
                <td className="border border-black px-2 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-[9mm] shrink-0 rounded-full border-2 border-black" style={{ background: i.color_hex }} />
                    <span className="text-[10.5pt] leading-tight font-bold uppercase">{i.color_name}</span>
                  </div>
                </td>
                <td className="border border-black text-center align-middle">
                  <span className="inline-block min-w-[12mm] border-[2.5px] border-black px-1 py-0.5 text-[18pt] leading-none font-black">{i.size}</span>
                </td>
                <td className="border border-black text-center align-middle text-[22pt] font-black">{i.quantity}</td>
                <td className="border border-black text-center align-middle">
                  <span className="inline-block size-[8mm] border-[2.5px] border-black bg-white" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="border border-black p-2 text-right text-[10pt] font-bold uppercase">
                Total de peças a separar
              </td>
              <td className="border border-black text-center text-[18pt] font-black">{o.total_pieces}</td>
              <td className="border border-black" />
            </tr>
          </tfoot>
        </table>

        <footer className="avoid-break mt-4 flex justify-between border-t border-black pt-2 text-[8pt] text-[#333]">
          <span className="whitespace-pre-line">{s.print_footer || "Confira cor, tamanho e quantidade antes de embalar."}</span>
          <span>Impresso em {now}</span>
        </footer>
      </div>
    </div>
  );
}
