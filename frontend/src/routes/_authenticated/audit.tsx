import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog } from "@/lib/workflows";
import { formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionHero } from "@/components/SectionHero";
import { ScrollText, Shield, UserPlus, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Journal d'audit — StockFlow" }] }),
  component: AuditPage,
});

const ADMIN_LINKS = [
  { to: "/admin/users", label: "Employés", icon: UserPlus },
  { to: "/admin/roles", label: "Rôles", icon: Shield },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText },
  { to: "/admin/login-history", label: "Historique de connexion", icon: History },
];

function AuditPage() {
  const rows = useQuery({ queryKey: ["audit_log"], queryFn: () => fetchAuditLog(300) });
  return (
    <TooltipProvider>
      <div>
        <SectionHero eyebrow="Admin" title="Employés, rôles, journal d'audit et connexions" links={ADMIN_LINKS} />
        <div className="p-6 lg:p-10 space-y-6">
        <header className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <ScrollText className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Journal d'audit</h1>
            <p className="text-sm text-muted-foreground">{(rows.data ?? []).length} action{(rows.data ?? []).length > 1 ? "s" : ""} enregistrée{(rows.data ?? []).length > 1 ? "s" : ""}</p>
          </div>
        </header>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark text-left"><tr>
              <th className="px-4 py-2">Horodatage</th><th className="px-4 py-2">Acteur</th>
              <th className="px-4 py-2">Action</th><th className="px-4 py-2">Entité</th>
              <th className="px-4 py-2">Détails</th>
            </tr></thead>
            <tbody className="divide-y">
              {(rows.data ?? []).map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-2">
                    <ActorName actorId={r.actor_id} displayName={r.actor_display_name} />
                  </td>
                  <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.action}</code></td>
                  <td className="px-4 py-2">{r.entity}<span className="text-muted-foreground text-xs"> · {r.entity_id?.slice(0, 8) ?? ""}</span></td>
                  <td className="px-4 py-2"><pre className="text-xs text-muted-foreground max-w-md overflow-x-auto">{r.details ? JSON.stringify(r.details) : ""}</pre></td>
                </tr>
              ))}
              {(rows.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Journal vide.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ActorName({ actorId, displayName }: { actorId: string | null; displayName: string | null }) {
  const label = actorId ? (displayName ?? "Utilisateur supprimé") : "Système";
  const detail = actorId ? `ID : ${actorId}` : "Action système";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block max-w-48 truncate align-middle font-medium">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono">{detail}</span>
      </TooltipContent>
    </Tooltip>
  );
}