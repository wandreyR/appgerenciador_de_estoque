import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useEffect,
} from "react";
import { ImageOff, LoaderCircle, X } from "lucide-react";
import { STATUS_LABEL, textOn } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

const BTN: Record<BtnVariant, string> = {
  primary: "bg-accent text-ink font-semibold hover:bg-accent-strong shadow-[0_0_0_1px_rgba(255,176,32,.3)]",
  secondary: "bg-surface-2 text-text border border-line hover:border-muted/60",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20",
};
const BTN_SIZE = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" };

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer",
        BTN[variant],
        BTN_SIZE[size],
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const FIELD =
  "rounded-lg bg-ink/60 border border-line px-3 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:opacity-60";

/** Aplica w-full só quando o chamador não definiu uma largura própria. */
const width = (c?: string) => (c && /(^|\s)w-/.test(c) ? "" : "w-full");

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} {...rest} className={cx(FIELD, width(className), "h-10", className)} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(FIELD, width(className), "h-10 pr-8", className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(FIELD, width(className), "py-2 min-h-20", className)} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted/70">{hint}</span>}
    </label>
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-line/60 bg-surface", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/60 px-5 py-3.5">
          <h2 className="font-semibold text-text">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "danger" | "ok" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent/15 text-accent border-accent/40",
  danger: "bg-danger/15 text-danger border-danger/40",
  ok: "bg-ok/12 text-ok border-ok/35",
  info: "bg-info/12 text-info border-info/35",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = { pendente: "accent", separado: "info", entregue: "ok", cancelado: "danger" };

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function ColorDot({ hex, size = 14, className }: { hex: string; size?: number; className?: string }) {
  return (
    <span
      className={cx("inline-block shrink-0 rounded-full border border-white/25", className)}
      style={{ background: hex, width: size, height: size }}
    />
  );
}

export function ColorChip({ name, hex }: { name: string; hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink/40 py-0.5 pr-2.5 pl-1 text-xs">
      <ColorDot hex={hex} size={14} />
      {name}
    </span>
  );
}

export function SizeTag({ size, className }: { size: string; className?: string }) {
  return (
    <span className={cx("inline-flex min-w-8 items-center justify-center rounded-md bg-ink/70 px-1.5 py-0.5 text-xs font-bold text-text border border-line", className)}>
      {size}
    </span>
  );
}

export function Thumb({ src, alt = "", size = 48, hex, className }: { src: string | null | undefined; alt?: string; size?: number; hex?: string; className?: string }) {
  return (
    <div
      className={cx("relative shrink-0 overflow-hidden rounded-lg border border-line/70 bg-ink/60 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : hex ? (
        <span className="h-full w-full" style={{ background: hex }}>
          <span className="sr-only">{alt}</span>
        </span>
      ) : (
        <ImageOff className="size-1/3 text-muted/50" />
      )}
      {src && hex && (
        <span className="absolute right-1 bottom-1 rounded-full border border-white/60" style={{ background: hex, width: 10, height: 10 }} />
      )}
    </div>
  );
}

export function Spinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <LoaderCircle className="size-5 animate-spin text-accent" /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon && <div className="mb-2 text-muted/50">{icon}</div>}
      <p className="font-medium text-text">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger whitespace-pre-line">{message}</div>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx("w-full rounded-xl border border-line bg-surface shadow-2xl", width)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line/60 px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text cursor-pointer">
            <X className="size-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line/60 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Kpi({ label, value, sub, icon, highlight }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; highlight?: boolean }) {
  return (
    <div className={cx("rounded-xl border bg-surface p-5", highlight ? "border-accent/60" : "border-line/60")}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className={cx("rounded-lg p-2", highlight ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}>{icon}</span>
      </div>
      <div className={cx("mt-3 text-3xl font-bold tabular-nums", highlight ? "text-accent" : "text-text")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function ColorBadgePrint({ name, hex }: { name: string; hex: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-black px-2 py-1 text-sm font-semibold" style={{ background: hex, color: textOn(hex) }}>
      {name}
    </span>
  );
}
