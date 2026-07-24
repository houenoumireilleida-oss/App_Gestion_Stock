import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLog } from "@/lib/workflows";
import { formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Journal d'audit — StockFlow" }] }),
  component: AuditPage,
});

function AuditPage() {
  const rows = useQuery({ queryKey: ["audit_log"], queryFn: () => fetchAuditLog(300) });
  return (
    <TooltipProvider>
      <div className="p-4 lg:p-8 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ScrollText className="text-slate-600" /> Journal d'audit</h1>
          <p className="text-sm text-muted-foreground">Trace horodatée et inaltérable de toutes les actions sensibles.</p>
        </header>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr>
              <th className="p-3">Horodatage</th><th className="p-3">Acteur</th>
              <th className="p-3">Action</th><th className="p-3">Entité</th>
              <th className="p-3">Détails</th>
            </tr></thead>
            <tbody className="divide-y">
              {(rows.data ?? []).map(r => (
                <tr key={r.id}>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="p-3">
                    <ActorName actorId={r.actor_id} displayName={r.actor_display_name} />
                  </td>
                  <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.action}</code></td>
                  <td className="p-3">{r.entity}<span className="text-muted-foreground text-xs"> · {r.entity_id?.slice(0, 8) ?? ""}</span></td>
                  <td className="p-3"><pre className="text-xs text-muted-foreground max-w-md overflow-x-auto">{r.details ? JSON.stringify(r.details) : ""}</pre></td>
                </tr>
              ))}
              {(rows.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Journal vide.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </Card>
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
