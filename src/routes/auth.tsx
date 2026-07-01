import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Boxes, Sparkles, ShieldCheck, Zap } from "lucide-react";
import heroImg from "@/assets/auth-hero.jpg";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — StockFlow" },
      { name: "description", content: "Connectez-vous pour piloter votre catalogue et vos stocks." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Compte créé. Connexion en cours…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-sidebar text-sidebar-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <Boxes className="size-6 text-sidebar-primary" />
          StockFlow
        </Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Une vue unique sur votre stock,<br /> tous canaux confondus.
          </h2>
          <p className="text-sidebar-foreground/70">
            Catalogue centralisé, multi-entrepôts, traçabilité complète des mouvements,
            alertes de réapprovisionnement.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Hébergement UE · RGPD · Sauvegardes automatiques
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8">
          <div className="lg:hidden mb-6 flex items-center gap-2 text-lg font-semibold">
            <Boxes className="size-6 text-accent" /> StockFlow
          </div>
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Accédez à votre espace de gestion." : "Rejoignez votre équipe."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail professionnel</Label>
              <Input id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="vous@entreprise.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          >
            {mode === "signin"
              ? "Pas encore de compte ? Créer un compte"
              : "Déjà inscrit ? Se connecter"}
          </button>
        </Card>
      </div>
    </div>
  );
}
