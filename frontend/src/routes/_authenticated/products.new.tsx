import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products/new")({
  head: () => ({ meta: [{ title: "Nouveau produit — StockFlow" }] }),
  component: NewProduct,
});

function NewProduct() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sku: "", name: "", barcode: "", category: "", description: "",
    unit: "pcs", price: "0", cost: "0", vat_rate: "20", low_stock_threshold: "5",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        sku: form.sku.trim(),
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        unit: form.unit.trim() || "pcs",
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        vat_rate: Number(form.vat_rate) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit créé");
      navigate({ to: "/products" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Retour aux produits
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-6">Nouveau produit</h1>

      <Card className="p-6">
        <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nom *"><Input required value={form.name} onChange={set("name")} /></Field>
            <Field label="SKU *"><Input required value={form.sku} onChange={set("sku")} placeholder="REF-001" /></Field>
            <Field label="Code-barres"><Input value={form.barcode} onChange={set("barcode")} /></Field>
            <Field label="Catégorie"><Input value={form.category} onChange={set("category")} /></Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={form.description} onChange={set("description")} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Unité"><Input value={form.unit} onChange={set("unit")} placeholder="pcs, kg…" /></Field>
            <Field label="Prix de vente HT (FCFA)"><Input type="number" step="1" value={form.price} onChange={set("price")} /></Field>
            <Field label="Coût d'achat (FCFA)"><Input type="number" step="1" value={form.cost} onChange={set("cost")} /></Field>
            <Field label="TVA (%)"><Input type="number" step="0.1" value={form.vat_rate} onChange={set("vat_rate")} /></Field>
            <Field label="Seuil d'alerte"><Input type="number" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link to="/products"><Button type="button" variant="outline">Annuler</Button></Link>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "…" : "Créer le produit"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
