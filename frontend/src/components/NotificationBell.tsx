import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications, markAllNotifsRead } from "@/lib/workflows";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/stock";

export function NotificationBell() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["notifications"], queryFn: () => fetchNotifications(20) });
  const unread = (list.data ?? []).filter(n => !n.read_at).length;

  useEffect(() => {
    const ch = supabase.channel("notif-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function readAll() {
    await markAllNotifsRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-auto p-0">
        <div className="p-3 flex items-center justify-between border-b">
          <span className="font-medium text-sm">Notifications</span>
          {unread > 0 && <button className="text-xs text-accent hover:underline" onClick={readAll}>Tout marquer lu</button>}
        </div>
        <div className="divide-y">
          {(list.data ?? []).slice(0, 10).map(n => (
            <Link key={n.id} to={n.link || "/notifications"}
              className={`block p-3 hover:bg-muted/50 ${!n.read_at ? "bg-accent/5" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">{n.title}</div>
                <div className="text-[10px] text-muted-foreground shrink-0">{formatDate(n.created_at)}</div>
              </div>
              {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
            </Link>
          ))}
          {(list.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Aucune notification.</div>}
        </div>
        <div className="p-2 border-t"><Link to="/notifications" className="block text-xs text-center text-accent hover:underline">Voir tout</Link></div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
