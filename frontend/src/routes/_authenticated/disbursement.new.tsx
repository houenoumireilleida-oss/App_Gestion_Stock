import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createDisbursement, uploadJustification, DISB_CAT_LABEL, type DisbCategory } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/disbursement/new")({
  head: () => ({ meta: [{ title: "Nouveau décaissement — StockFlow" }] }),
  component: NewDisb,
});
function NewDisb() {
  const nav = useNavigate();
  const [amount, setA] = useState(0);
  const [beneficiary, setB] = useState("");
  const [category, setC] = useState<DisbCategory>("achat");
  const [description, setD] = useState("");
  const [file, setF] = useState<File | null>(null);
  const [loading, setL] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!beneficiary.trim() || !description.trim() || amount <= 0) return;
    setL(true);
    try {
      let path: string | null = null;
      if (file) path = await uploadJustification(file);
      await createDisbursement({ amount, category, beneficiary, description, justification_url: path });
      toast.success("Demande envoyée à l'admin");
      nav({ to: "/disbursement" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setL(false); }
  }
  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Nouvelle demande de décaissement</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Montant (FCFA)</Label><Input type="number" step="1" min={0} value={amount || ""} onChange={e => setA(parseFloat(e.target.value) || 0)} required /></div>
            <div><Label>Catégorie</Label>
              <Select value={category} onValueChange={v => setC(v as DisbCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DISB_CAT_LABEL) as DisbCategory[]).map(c => <SelectItem key={c} value={c}>{DISB_CAT_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Bénéficiaire</Label><Input value={beneficiary} onChange={e => setB(e.target.value)} required /></div>
          <div><Label>Description / motif</Label><Textarea value={description} onChange={e => setD(e.target.value)} required rows={3} /></div>
          <div><Label>Justificatif (PDF ou image)</Label>
            <Input type="file" accept=".pdf,image/*" onChange={e => setF(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => nav({ to: "/disbursement" })}>Annuler</Button>
            <Button type="submit" disabled={loading}>Soumettre</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
