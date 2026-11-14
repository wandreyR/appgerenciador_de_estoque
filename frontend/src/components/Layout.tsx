import { NavLink, Outlet } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Package, Settings, ShoppingCart, Tags, TriangleAlert, Users } from "lucide-react";
import { useLicense } from "./License";
import { cx } from "./ui";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/pedidos/novo", label: "Novo pedido", icon: ShoppingCart, highlight: true },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList, end: true },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Layout() {
  const { license } = useLicense();
  const expiring = license?.days_left != null && license.days_left <= 15;
  const unchecked = !!license?.check_enabled && (license.days_since_check ?? 0) >= 2;

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line/50 bg-ink">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/favicon.svg" className="size-9" alt="" />
          <div className="leading-tight">
            <div className="text-sm font-bold">Gestor de Estoque</div>
            <div className="text-[11px] uppercase tracking-wider text-muted">Confecção</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-surface text-text font-medium shadow-[inset_3px_0_0_var(--color-accent)]"
                    : "text-muted hover:bg-surface/60 hover:text-text",
                  highlight && !isActive && "text-accent",
                )
              }
            >
              <Icon className="size-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line/50 px-5 py-4 text-[11px] text-muted">
          <div className="truncate">Licenciado: {license?.customer ?? "—"}</div>
          <div>{license?.lifetime ? "Licença vitalícia" : license?.expires ? `Válida até ${license.expires.split("-").reverse().join("/")}` : ""}</div>
          <div className="mt-1 opacity-60">v{license?.version}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {expiring && (
          <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-8 py-2 text-sm text-accent">
            <TriangleAlert className="size-4" />
            Sua licença expira em {license!.days_left} dia(s). Entre em contato com o suporte para renovar.
          </div>
        )}
        {unchecked && (
          <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-8 py-2 text-sm text-accent">
            <TriangleAlert className="size-4" />
            A licença não é verificada pela internet há {license!.days_since_check} dia(s). Sem conexão, o sistema será bloqueado em{" "}
            {Math.max(0, license!.grace_days - (license!.days_since_check ?? 0))} dia(s).
          </div>
        )}
        <div className="mx-auto max-w-[1400px] px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
