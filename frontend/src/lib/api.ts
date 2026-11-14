export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Opts = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) {
      const first = d[0] as { msg?: string; loc?: unknown[] };
      const field = Array.isArray(first.loc) ? first.loc.slice(1).join(".") : "";
      return `Dados inválidos${field ? ` (${field})` : ""}: ${first.msg ?? ""}`;
    }
  }
  return fallback;
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { json, headers: h, ...rest } = opts;
  const headers = new Headers(h);
  let body = opts.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, body });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor local. O sistema foi encerrado?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 403 && data && typeof data === "object" && "license" in data) {
      window.dispatchEvent(new CustomEvent("license-required"));
    }
    throw new ApiError(res.status, extractMessage(data, `Erro ${res.status}`));
  }
  return data as T;
}

export function uploadFile<T = unknown>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return api<T>(path, { method: "POST", body: fd });
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
