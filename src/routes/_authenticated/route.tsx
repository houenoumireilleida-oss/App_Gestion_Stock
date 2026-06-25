import { createFileRoute, Outlet, redirect, Link, useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Package, Warehouse, ArrowLeftRight, Boxes, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const nav = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/products", label: "Produits", icon: Package },
  { to: "/warehouses", label: "Entrepôts", icon: Warehouse },
  { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
] as const;

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const location = useLocation();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-5 flex items-center gap-2 text-lg font-semibold border-b border-sidebar-border">
          <Boxes className="size-6 text-sidebar-primary" />
          StockFlow
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(item => {
            const active = location.pathname.startsWith(item.to);
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
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
          <div className="px-3 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="size-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile nav */}
        <div className="md:hidden border-b bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Boxes className="size-5 text-sidebar-primary" /> StockFlow</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground"><LogOut className="size-4" /></Button>
        </div>
        <div className="md:hidden border-b bg-sidebar/95 text-sidebar-foreground overflow-x-auto">
          <div className="flex gap-1 px-2 py-2">
            {nav.map(item => {
              const active = location.pathname.startsWith(item.to);
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
