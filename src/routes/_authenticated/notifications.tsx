import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotifRead, markAllNotifsRead } from "@/lib/workflows";
import { formatDate } from "@/lib/stock";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — StockFlow" }] }),
  component: NotifPage,
});
function NotifPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["notifications"], queryFn: () => fetchNotifications(200) });
  async function readOne(id: string) { await markNotifRead(id); qc.invalidateQueries({ queryKey: ["notifications"] }); }
  async function readAll() { await markAllNotifsRead(); qc.invalidateQueries({ queryKey: ["notifications"] }); }
  return (
    <div className="p-4 lg:p-8 max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Bell /> Notifications</h1>
        <Button variant="outline" onClick={readAll}><CheckCheck className="size-4" /> Tout marquer lu</Button>
      </header>
      <Card className="divide-y">
        {(list.data ?? []).map(n => (
          <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.read_at ? "bg-accent/5" : ""}`}>
            <span className={`size-2 rounded-full mt-2 ${n.read_at ? "bg-muted" : "bg-accent"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">{formatDate(n.created_at)}</div>
              </div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="flex gap-3 mt-1">
                {n.link && <Link to={n.link} className="text-xs text-accent hover:underline">Ouvrir</Link>}
                {!n.read_at && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => readOne(n.id)}>Marquer lu</button>}
              </div>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && <div className="p-8 text-center text-muted-foreground">Aucune notification.</div>}
      </Card>
    </div>
  );
}
