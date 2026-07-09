import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Boxes, Sparkles, ShieldCheck, Zap, Eye, EyeOff } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden text-sidebar-foreground p-12 flex-col justify-between">
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 hero-gradient opacity-90" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />

        <Link to="/" className="relative flex items-center gap-2 text-lg font-semibold z-10">
          <div className="size-9 rounded-lg accent-gradient grid place-items-center shadow-glow">
            <Boxes className="size-5 text-white" />
          </div>
          StockFlow
        </Link>

        <div className="relative space-y-6 max-w-md z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-dark text-xs">
            <Sparkles className="size-3 text-sidebar-primary" />
            Plateforme unifiée · POS · Stock · Facturation
          </div>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Une vue unique sur votre stock,<br />
            <span className="text-sidebar-primary">tous canaux confondus.</span>
          </h2>
          <p className="text-sidebar-foreground/80 text-base leading-relaxed">
            Catalogue centralisé, multi-entrepôts, traçabilité complète des mouvements,
            alertes de réapprovisionnement.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="glass-dark rounded-lg p-3">
              <ShieldCheck className="size-4 text-sidebar-primary mb-2" />
              <p className="text-xs font-medium">Sécurité RGPD</p>
              <p className="text-[11px] text-sidebar-foreground/60">Hébergement UE</p>
            </div>
            <div className="glass-dark rounded-lg p-3">
              <Zap className="size-4 text-sidebar-primary mb-2" />
              <p className="text-xs font-medium">Temps réel</p>
              <p className="text-[11px] text-sidebar-foreground/60">Sync multi-sites</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-sidebar-foreground/60 z-10">
          © {new Date().getFullYear()} StockFlow · Sauvegardes automatiques
        </p>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-12 grid-pattern">
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <Card className="relative w-full max-w-md p-8 shadow-elegant border-border/60">
          <div className="lg:hidden mb-6 flex items-center gap-2 text-lg font-semibold">
            <div className="size-8 rounded-lg accent-gradient grid place-items-center">
              <Boxes className="size-5 text-white" />
            </div>
            StockFlow
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Bon retour parmi nous</h1>
          <p className="text-sm text-muted-foreground mt-1">Accédez à votre espace de gestion.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail professionnel</Label>
              <Input id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="vous@entreprise.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full accent-gradient text-white border-0 hover:opacity-90 shadow-glow">
              {loading ? "…" : "Se connecter"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

