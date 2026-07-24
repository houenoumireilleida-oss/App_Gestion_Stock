import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchWarehouses, formatMoney, formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

type CashSession = {
  id: string; warehouse_id: string; opened_by: string; closed_by: string | null;
  opening_float: number; closing_counted: number | null; expected_cash: number | null; variance: number | null;
  notes: string | null; opened_at: string; closed_at: string | null;
};

export const Route = createFileRoute("/_authenticated/cash-sessions")({
  head: () => ({ meta: [{ title: "Sessions de caisse — StockFlow" }] }),
  component: CashSessionsPage,
});

async function fetchSessions(): Promise<CashSession[]> {
  const { data, error } = await supabase.from("cash_sessions").select("*").order("opened_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data as CashSession[];
}

function CashSessionsPage() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ["cash_sessions"], queryFn: fetchSessions });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState<CashSession | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  async function openSession(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("cash_sessions").insert({
      warehouse_id: warehouseId, opened_by: u.user.id, opening_float: parseFloat(opening) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Caisse ouverte");
    setOpenOpen(false); setOpening("0");
    qc.invalidateQueries({ queryKey: ["cash_sessions"] });
  }

  async function closeSession(e: React.FormEvent) {
    e.preventDefault();
    if (!closeOpen) return;
    try {
      const { closeCashSession } = await import("@/lib/workflows");
      const z = await closeCashSession(closeOpen.id, parseFloat(counted) || 0, notes || "");
      toast.success(`Caisse fermée — Rapport ${z}`);
      setCloseOpen(null); setCounted(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["cash_sessions"] });
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sessions de caisse</h1>
          <p className="text-muted-foreground mt-1">Ouverture, fermeture, justification des écarts.</p>
        </div>
        <Button onClick={() => setOpenOpen(true)}>Ouvrir une caisse</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-4 py-2">Entrepôt</th><th className="px-4 py-2">Ouverte</th><th className="px-4 py-2">Fermée</th><th className="px-4 py-2 text-right">Fond</th><th className="px-4 py-2 text-right">Compté</th><th className="px-4 py-2 text-right">Écart</th><th className="px-4 py-2">Action</th></tr>
          </thead>
          <tbody className="divide-y">
            {(sessions.data ?? []).map(s => {
              const w = (wh.data ?? []).find(w => w.id === s.warehouse_id);
              return (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">{w?.name ?? "—"}</td>
                  <td className="px-4 py-2">{formatDate(s.opened_at)}</td>
                  <td className="px-4 py-2">{s.closed_at ? formatDate(s.closed_at) : <Badge>Ouverte</Badge>}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(s.opening_float)}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.closing_counted != null ? formatMoney(s.closing_counted) : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.variance != null ? <span className={s.variance < 0 ? "text-destructive" : s.variance > 0 ? "text-warning" : ""}>{formatMoney(s.variance)}</span> : "—"}</td>
                  <td className="px-4 py-2">{!s.closed_at && <Button size="sm" variant="outline" onClick={() => setCloseOpen(s)}>Fermer</Button>}</td>
                </tr>
              );
            })}
            {(sessions.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucune session.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouvrir une caisse</DialogTitle></DialogHeader>
          <form onSubmit={openSession} className="space-y-3">
            <div>
              <Label>Entrepôt *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{(wh.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fond de caisse (FCFA)</Label><Input type="number" step="1" value={opening} onChange={e => setOpening(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Ouvrir</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeOpen} onOpenChange={v => !v && setCloseOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fermer la caisse</DialogTitle></DialogHeader>
          <form onSubmit={closeSession} className="space-y-3">
            <p className="text-sm text-muted-foreground">L'écart sera calculé par rapport aux paiements espèces de la session.</p>
            <div><Label>Montant compté (FCFA) *</Label><Input type="number" step="1" required value={counted} onChange={e => setCounted(e.target.value)} /></div>
            <div><Label>Justification de l'écart</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Fermer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
