import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, Boxes, LogOut,
  ShoppingCart, Receipt, Truck, ClipboardList, Users, Wallet, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMyRoles, hasAny, type AppRole } from "@/lib/roles";

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

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Vente",
    items: [
      { to: "/pos", label: "Caisse", icon: ShoppingCart },
      { to: "/sales", label: "Ventes", icon: Receipt },
      { to: "/cash-sessions", label: "Sessions de caisse", icon: Wallet },
    ],
  },
  {
    title: "Stock",
    items: [
      { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { to: "/products", label: "Produits", icon: Package },
      { to: "/warehouses", label: "Entrepôts", icon: Warehouse, roles: ["admin", "responsable"] },
      { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Achats",
    items: [
      { to: "/suppliers", label: "Fournisseurs", icon: Truck, roles: ["admin", "responsable"] },
      { to: "/purchase-orders", label: "Commandes", icon: ClipboardList, roles: ["admin", "responsable"] },
    ],
  },
  {
    title: "Clients",
    items: [
      { to: "/customers", label: "Clients & fidélité", icon: Users },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/users", label: "Utilisateurs & rôles", icon: Shield, roles: ["admin"] },
    ],
  },
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

  const sections = NAV_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(it => !it.roles || hasAny(roles, ...it.roles)),
  })).filter(s => s.items.length > 0);

  const roleLabel = roles && roles.length > 0 ? roles.join(" · ") : "—";

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-5 flex items-center gap-2 text-lg font-semibold border-b border-sidebar-border">
          <Boxes className="size-6 text-sidebar-primary" />
          StockFlow
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {sections.map(section => (
            <div key={section.title}>
              <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map(item => {
                  const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                  return (
                    <Link key={item.to} to={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <div className="px-3 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
          <div className="px-3 text-[10px] text-sidebar-foreground/40 uppercase tracking-wider">{roleLabel}</div>
          <Button variant="ghost" size="sm" onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="size-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden border-b bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Boxes className="size-5 text-sidebar-primary" /> StockFlow</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground"><LogOut className="size-4" /></Button>
        </div>
        <div className="md:hidden border-b bg-sidebar/95 text-sidebar-foreground overflow-x-auto">
          <div className="flex gap-1 px-2 py-2">
            {sections.flatMap(s => s.items).map(item => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                    active ? "bg-sidebar-accent" : "text-sidebar-foreground/70"
                  }`}>
                  <item.icon className="size-3.5" /> {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
