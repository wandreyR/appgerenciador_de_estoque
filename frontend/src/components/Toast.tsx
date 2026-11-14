import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "./ui";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; message: string };
type Ctx = { push: (kind: Kind, message: string) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId++;
      setItems((l) => [...l, { id, kind, message }]);
      setTimeout(() => remove(id), kind === "error" ? 7000 : 3500);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="no-print fixed right-4 bottom-4 z-[60] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-xl",
              t.kind === "success" && "border-ok/50",
              t.kind === "error" && "border-danger/60",
              t.kind === "info" && "border-line",
            )}
          >
            {t.kind === "success" && <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />}
            {t.kind === "error" && <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />}
            {t.kind === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info" />}
            <span className="flex-1 whitespace-pre-line">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-muted hover:text-text cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
