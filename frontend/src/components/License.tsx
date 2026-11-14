import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { LicenseStatus } from "../lib/types";
import Activation from "../pages/Activation";
import { Spinner } from "./ui";

type Ctx = { license: LicenseStatus | null; reload: () => Promise<void> };
const LicenseCtx = createContext<Ctx>({ license: null, reload: async () => {} });
export const useLicense = () => useContext(LicenseCtx);

/** Bloqueia toda a aplicação até existir uma licença válida. */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLicense(await api<LicenseStatus>("/api/license/status"));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    reload();
    const onRequired = () => reload();
    window.addEventListener("license-required", onRequired);
    return () => window.removeEventListener("license-required", onRequired);
  }, [reload]);

  if (offline)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Servidor local não está respondendo.</p>
        <p className="text-sm text-muted">Abra novamente o programa "Gestor de Estoque" e recarregue esta página.</p>
        <button onClick={reload} className="mt-2 rounded-lg bg-accent px-4 py-2 font-semibold text-ink cursor-pointer">
          Tentar novamente
        </button>
      </div>
    );
  if (!license) return <Spinner label="Verificando licença..." />;
  if (!license.valid) return <Activation status={license} onActivated={setLicense} />;
  return <LicenseCtx.Provider value={{ license, reload }}>{children}</LicenseCtx.Provider>;
}
