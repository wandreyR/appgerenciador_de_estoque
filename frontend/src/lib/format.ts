const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");

export const money = (v: number | null | undefined) => brl.format(v ?? 0);
export const num = (v: number | null | undefined) => int.format(v ?? 0);

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function isoDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/** Contraste para texto sobre a cor (badge de cor). */
export function textOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000" : "#fff";
}

const ORDER = ["RN", "PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "G4", "G5", "U", "UNICO"];

export function sizeKey(s: string): [number, number, string] {
  const u = s.trim().toUpperCase();
  const i = ORDER.indexOf(u);
  if (i >= 0) return [0, i, ""];
  const n = Number(u.replace(",", "."));
  if (!Number.isNaN(n)) return [1, n, ""];
  return [2, 0, u];
}

export function sortSizes(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const ka = sizeKey(a);
    const kb = sizeKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });
}

export const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando separação",
  separado: "Separado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  cadastro: "Cadastro",
  pedido: "Pedido",
  cancelamento: "Estorno",
};

export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Preto", hex: "#111111" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Off-White", hex: "#F3EEE3" },
  { name: "Cinza", hex: "#9CA3AF" },
  { name: "Grafite", hex: "#3F4651" },
  { name: "Azul", hex: "#2563EB" },
  { name: "Azul Marinho", hex: "#1F2A44" },
  { name: "Azul Bebê", hex: "#A9CCF0" },
  { name: "Jeans", hex: "#4A6B8A" },
  { name: "Vermelho", hex: "#DC2626" },
  { name: "Vinho", hex: "#7F1D2D" },
  { name: "Rosa", hex: "#EC4899" },
  { name: "Rosa Bebê", hex: "#F7C6D9" },
  { name: "Lilás", hex: "#C084FC" },
  { name: "Roxo", hex: "#7E22CE" },
  { name: "Verde", hex: "#16A34A" },
  { name: "Verde Militar", hex: "#4B5320" },
  { name: "Verde Água", hex: "#7ED6C4" },
  { name: "Amarelo", hex: "#FACC15" },
  { name: "Mostarda", hex: "#C9A227" },
  { name: "Laranja", hex: "#F97316" },
  { name: "Terracota", hex: "#C0583A" },
  { name: "Bege", hex: "#D6C3A5" },
  { name: "Nude", hex: "#E3BC9A" },
  { name: "Caramelo", hex: "#A86B32" },
  { name: "Marrom", hex: "#6B3F24" },
];
