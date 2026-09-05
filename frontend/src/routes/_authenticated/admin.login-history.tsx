import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchLoginHistory } from "@/lib/loginHistory";
import { formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHero } from "@/components/SectionHero";
import { History, ShieldAlert, CheckCircle2, XCircle, Shield, UserPlus, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/login-history")({
  head: () => ({ meta: [{ title: "Historique de connexion — StockFlow" }] }),
  component: LoginHistoryPage,
});

const ADMIN_LINKS = [
  { to: "/admin/users", label: "Employés", icon: UserPlus },
  { to: "/admin/roles", label: "Rôles", icon: Shield },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText },
  { to: "/admin/login-history", label: "Historique de connexion", icon: History },
];

const PAGE_SIZE = 20;

function LoginHistoryPage() {
  const { data: myRoles } = useMyRoles();
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["login_history", page],
    queryFn: () => fetchLoginHistory(page, PAGE_SIZE),
  });

  if (!hasAny(myRoles, "admin")) {
    return (
      <div>
        <SectionHero eyebrow="Admin" title="Employés, rôles, journal d'audit et connexions" links={ADMIN_LINKS} />
        <div className="p-10 max-w-xl">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto size-10 text-warning mb-3" />
            <h2 className="font-semibold">Accès réservé</h2>
            <p className="text-sm text-muted-foreground mt-1">Seuls les administrateurs peuvent consulter l'historique de connexion.</p>
          </Card>
        </div>
      </div>
    );
  }

  const rows = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div>
      <SectionHero eyebrow="Admin" title="Employés, rôles, journal d'audit et connexions" links={ADMIN_LINKS} />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex items-center gap-3">
        <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
          <History className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historique de connexion</h1>
          <p className="text-sm text-muted-foreground">{count} entrée{count > 1 ? "s" : ""} enregistrée{count > 1 ? "s" : ""}</p>
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark text-left">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Date / heure</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Adresse IP</th>
                <th className="px-4 py-2">Appareil</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{r.email}</td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(r.logged_in_at)}</td>
                  <td className="px-4 py-2">
                    {r.success ? (
                      <Badge variant="outline" className="text-success border-success/30 gap-1">
                        <CheckCircle2 className="size-3.5" /> Réussie
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/30 gap-1">
                        <XCircle className="size-3.5" /> Échouée
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.ip_address ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    <span className="block max-w-xs truncate" title={r.user_agent ?? undefined}>
                      {r.user_agent ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {query.isLoading ? "Chargement…" : "Aucune connexion enregistrée."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {count > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} sur {totalPages} · {count} entrée{count > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}