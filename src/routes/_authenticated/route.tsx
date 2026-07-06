import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, Boxes, LogOut,
  ShoppingCart, Receipt, Truck, ClipboardList, Users, Wallet, Shield,
  FileText, ChevronDown, Settings, UserPlus, AlertTriangle, PackageMinus,
  Undo2, Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMyRoles, hasAny, type AppRole } from "@/lib/roles";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] };
type NavSection = { key: string; title: string; items: NavItem[] };

const NAV: NavSection[] = [
  { key: "dashboard", title: "Tableau de bord", items: [
    { to: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  ]},
  { key: "sell", title: "Vente", items: [
    { to: "/pos", label: "Caisse", icon: ShoppingCart },
    { to: "/sales", label: "Ventes", icon: Receipt },
    { to: "/cash-sessions", label: "Sessions & Clôture Z", icon: Wallet },
    { to: "/returns", label: "Retours clients", icon: Undo2 },
  ]},
  { key: "billing", title: "Facturation", items: [
    { to: "/billing", label: "Factures", icon: FileText },
    { to: "/billing/new", label: "Nouvelle facture", icon: FileText, roles: ["admin","responsable"] },
    { to: "/billing/settings", label: "Société", icon: Settings, roles: ["admin","responsable"] },
  ]},
  { key: "inventory", title: "Stock", items: [
    { to: "/products", label: "Produits", icon: Package },
    { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
    { to: "/defective", label: "Défectueux", icon: AlertTriangle },
    { to: "/destocking", label: "Déstockage", icon: PackageMinus },
    { to: "/warehouses", label: "Entrepôts", icon: Warehouse, roles: ["admin","responsable"] },
  ]},
  { key: "finance", title: "Finances", items: [
    { to: "/disbursement", label: "Décaissements", icon: Banknote },
  ]},
  { key: "purchasing", title: "Achats", items: [
    { to: "/suppliers", label: "Fournisseurs", icon: Truck, roles: ["admin","responsable"] },
    { to: "/purchase-orders", label: "Commandes", icon: ClipboardList, roles: ["admin","responsable"] },
  ]},
  { key: "customers", title: "Clients", items: [
    { to: "/customers", label: "Clients & fidélité", icon: Users },
  ]},
  { key: "admin", title: "Admin", items: [
    { to: "/admin/users", label: "Employés", icon: UserPlus, roles: ["admin"] },
    { to: "/admin/roles", label: "Rôles", icon: Shield, roles: ["admin"] },
  ]},
];

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const location = useLocation();
  const { data: roles } = useMyRoles();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth" });
  }

  const sections = NAV.map(s => ({
    ...s,
    items: s.items.filter(it => !it.roles || hasAny(roles, ...it.roles)),
  })).filter(s => s.items.length > 0);

  const activeSection = sections.find(s =>
    s.items.some(it => location.pathname === it.to || location.pathname.startsWith(it.to + "/"))
  ) ?? sections[0];

  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = roles && roles.length > 0 ? roles.join(" · ") : "—";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar — brand + primary nav + user menu */}
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="px-4 lg:px-8 h-14 flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-base shrink-0">
            <Boxes className="size-5 text-sidebar-primary" />
            <span>StockFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
            {sections.map(s => {
              const isActive = s.key === activeSection?.key;
              const first = s.items[0];
              return (
                <Link
                  key={s.key}
                  to={first.to}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  }`}
                >
                  {s.title}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground gap-2">
                  <span className="size-7 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-medium">
                    {initials}
                  </span>
                  <span className="hidden lg:inline text-xs">{user.email}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm">{user.email}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Secondary nav — subsections of the active area */}
        {activeSection && activeSection.items.length > 0 && (
          <div className="px-4 lg:px-8 h-11 flex items-center gap-1 overflow-x-auto border-t border-sidebar-border/50 bg-sidebar/95">
            {activeSection.items.map(it => {
              const active = location.pathname === it.to ||
                (it.to !== "/dashboard" && location.pathname.startsWith(it.to + "/"));
              return (
                <Link key={it.to} to={it.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  }`}>
                  <it.icon className="size-3.5" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Mobile primary nav */}
        <div className="md:hidden border-t border-sidebar-border overflow-x-auto">
          <div className="flex gap-1 px-2 py-2">
            {sections.map(s => {
              const isActive = s.key === activeSection?.key;
              const first = s.items[0];
              return (
                <Link key={s.key} to={first.to}
                  className={`px-3 py-1 rounded-md text-xs whitespace-nowrap ${
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
                  }`}>{s.title}</Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
