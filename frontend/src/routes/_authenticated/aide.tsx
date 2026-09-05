import { createFileRoute } from "@tanstack/react-router";
import { useMyRoles, hasAny, type AppRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/aide")({
  head: () => ({ meta: [{ title: "Aide — StockFlow" }] }),
  component: HelpPage,
});

const HELP_LINKS = [
  { to: "/aide", label: "Guide d'utilisation", icon: BookOpen },
];

type HelpTopic = {
  id: string;
  title: string;
  steps: string[];
  note?: string;
};

type HelpGroup = {
  key: string;
  title: string;
  description: string;
  minRole: AppRole;
  topics: HelpTopic[];
};

const GROUPS: HelpGroup[] = [
  {
    key: "vendeur",
    title: "Les bases : vente et caisse",
    description: "Ce que tout utilisateur peut faire au quotidien.",
    minRole: "vendeur",
    topics: [
      {
        id: "connexion",
        title: "Comment se connecter à l'application",
        steps: [
          "Ouvrez la page de connexion de l'application.",
          "Saisissez votre e-mail professionnel et votre mot de passe.",
          "Cliquez sur « Se connecter ».",
        ],
        note: "Si vous avez oublié votre mot de passe, un administrateur peut vous en générer un nouveau depuis la page Employés (menu Admin).",
      },
      {
        id: "vente",
        title: "Comment faire une vente (caisse / POS)",
        steps: [
          "Allez dans Vente → Caisse.",
          "Choisissez l'entrepôt dans lequel vous vendez.",
          "Ajoutez des produits au panier : scannez ou tapez un nom / SKU / code-barres dans la barre de recherche puis appuyez sur Entrée, ou cliquez directement sur une vignette produit.",
          "Ajustez les quantités avec les boutons « − » et « + », ou supprimez une ligne avec l'icône corbeille.",
          "Optionnel : associez un client via le menu déroulant « Client », et/ou appliquez une remise globale.",
          "Cliquez sur « Encaisser ».",
          "Choisissez le mode de paiement (Espèces, Carte, Virement, Chèque, Bon d'achat, Autre). Pour un paiement en espèces, saisissez le montant reçu : la monnaie à rendre est calculée automatiquement.",
          "Pour un paiement partagé entre plusieurs moyens de paiement, utilisez le bouton de paiement fractionné puis ajoutez chaque montant un par un.",
          "Cliquez sur « Valider l'encaissement ». Le reçu s'ouvre automatiquement dans un nouvel onglet.",
        ],
      },
      {
        id: "stock-consult",
        title: "Comment consulter le stock disponible",
        steps: [
          "Allez dans Stock → Produits pour voir la liste des produits avec leur stock, et repérer les produits en « Seuil bas » grâce au badge affiché.",
          "Utilisez la recherche (nom, SKU ou code-barres) pour retrouver rapidement un produit.",
          "Cliquez sur un produit pour voir le détail du stock par entrepôt.",
          "Allez dans Stock → Mouvements pour consulter l'historique complet des entrées, sorties, ajustements et transferts.",
          "Le Tableau de bord affiche aussi un résumé (unités en stock, valeur de stock) et la liste des produits sous leur seuil d'alerte.",
        ],
      },
      {
        id: "retours",
        title: "Comment gérer les retours clients",
        steps: [
          "Allez dans Vente → Retours clients puis cliquez sur « Nouveau retour ».",
          "Sélectionnez la vente d'origine dans la liste.",
          "Indiquez, pour chaque article, la quantité retournée.",
          "Choisissez la destination : remettre en stock, ou basculer en défectueux.",
          "Choisissez le mode de remboursement : Espèces, Avoir, ou Aucun.",
          "Indiquez le motif du retour (obligatoire) puis cliquez sur « Soumettre ».",
        ],
        note: "Le retour est créé en attente : un administrateur doit l'approuver avant que le stock ne soit réellement ajusté et le remboursement effectué.",
      },
      {
        id: "caisse-session",
        title: "Comment ouvrir / fermer une session de caisse",
        steps: [
          "Allez dans Vente → Sessions & Clôture Z.",
          "Pour ouvrir une caisse en début de journée : cliquez sur « Ouvrir une caisse », choisissez l'entrepôt, saisissez le fond de caisse de départ, puis cliquez sur « Ouvrir ».",
          "Pour fermer une caisse en fin de journée : cliquez sur « Fermer » sur la session ouverte, saisissez le montant compté physiquement, ajoutez une justification si un écart apparaît, puis cliquez sur « Fermer ».",
        ],
        note: "L'écart est calculé automatiquement par rapport aux paiements en espèces enregistrés pendant la session, et un rapport de clôture (rapport Z) est généré.",
      },
    ],
  },
  {
    key: "responsable",
    title: "Gestion & achats",
    description: "Fonctions supplémentaires pour les responsables (en plus des bases ci-dessus).",
    minRole: "responsable",
    topics: [
      {
        id: "produits",
        title: "Comment gérer les produits (ajout, modification)",
        steps: [
          "Pour créer un produit : allez dans Stock → Produits, cliquez sur « Nouveau produit », remplissez le nom, le SKU, le code-barres, la catégorie, le prix de vente, le coût d'achat, la TVA et le seuil d'alerte, puis cliquez sur « Créer le produit ».",
          "Pour modifier un produit : ouvrez-le depuis la liste, modifiez les champs souhaités puis cliquez sur « Enregistrer ».",
          "Pour supprimer un produit : ouvrez sa fiche et cliquez sur « Supprimer » (une confirmation vous sera demandée).",
        ],
      },
      {
        id: "entrepots",
        title: "Comment gérer les entrepôts",
        steps: [
          "Allez dans Stock → Entrepôts.",
          "Remplissez le formulaire en haut de page (code, nom, adresse) puis cliquez sur « Ajouter ».",
          "Pour supprimer un entrepôt, cliquez sur l'icône corbeille sur sa ligne (une confirmation vous sera demandée).",
        ],
      },
      {
        id: "fournisseurs-achats",
        title: "Comment gérer les fournisseurs et les commandes d'achat",
        steps: [
          "Pour créer un fournisseur : allez dans Achats → Fournisseurs, cliquez sur « Nouveau », renseignez ses informations (code, nom, contact, conditions de paiement…) puis cliquez sur « Créer ».",
          "Pour créer une commande : allez dans Achats → Commandes, cliquez sur « Nouvelle commande », choisissez le fournisseur et l'entrepôt de réception, ajoutez les lignes de produits avec quantités et coûts, puis enregistrez en brouillon ou cliquez sur « Passer commande ».",
          "Le bouton « Réappro auto » permet de générer automatiquement un brouillon de commande regroupant tous les produits sous leur seuil d'alerte pour un entrepôt donné.",
          "Pour réceptionner la marchandise : ouvrez la commande, saisissez la quantité reçue sur chaque ligne, puis cliquez sur « Recevoir ». Le stock est mis à jour automatiquement, y compris en cas de réception partielle.",
        ],
      },
      {
        id: "destockage",
        title: "Comment traiter les demandes de déstockage",
        steps: [
          "Pour soumettre une demande : allez dans Stock → Déstockage, cliquez sur « Nouvelle demande », choisissez le produit, l'entrepôt, la quantité et le motif, puis cliquez sur « Soumettre ».",
          "La demande apparaît alors en attente dans la liste, avec son statut.",
        ],
        note: "Seul un administrateur peut approuver ou rejeter une demande de déstockage (bouton coche / croix sur la ligne concernée). Une approbation peut être partielle en ajustant la quantité approuvée ; la sortie de stock est alors automatique.",
      },
      {
        id: "rapports",
        title: "Comment consulter les rapports / le tableau de bord",
        steps: [
          "Allez dans Tableau de bord → Vue d'ensemble.",
          "Vous y trouverez le nombre de références produits, le nombre d'entrepôts actifs, les unités totales en stock et la valeur totale du stock.",
          "Le panneau « Derniers mouvements de stock » montre les 8 derniers mouvements enregistrés (cliquez sur « Tout voir » pour l'historique complet).",
          "Le panneau « Alertes de seuil » liste les produits actuellement sous leur seuil d'alerte.",
        ],
      },
    ],
  },
  {
    key: "admin",
    title: "Administration",
    description: "Fonctions réservées aux administrateurs (en plus de tout ce qui précède).",
    minRole: "admin",
    topics: [
      {
        id: "employes",
        title: "Comment gérer les employés (créer un compte, assigner un rôle)",
        steps: [
          "Allez dans Admin → Employés puis cliquez sur « Nouvel employé ».",
          "Renseignez le nom affiché et l'e-mail, cochez le ou les rôles à attribuer (admin, responsable, vendeur), puis cliquez sur « Créer le compte ».",
          "Des identifiants temporaires s'affichent une seule fois : copiez-les et transmettez-les à l'employé.",
          "Pour réinitialiser le mot de passe d'un employé : cliquez sur l'icône clé sur sa ligne.",
          "Pour supprimer un compte : cliquez sur l'icône corbeille sur sa ligne (une confirmation vous sera demandée).",
        ],
      },
      {
        id: "roles",
        title: "Comment gérer les rôles et permissions",
        steps: [
          "Allez dans Admin → Rôles.",
          "Un tableau affiche chaque utilisateur en ligne et les rôles (admin, responsable, vendeur) en colonnes.",
          "Cochez ou décochez une case pour attribuer ou retirer un rôle : le changement est appliqué immédiatement, sans bouton « Enregistrer ».",
        ],
      },
      {
        id: "audit",
        title: "Comment consulter le journal d'audit",
        steps: [
          "Allez dans Admin → Journal d'audit.",
          "Vous y trouverez la liste chronologique (la plus récente en premier) de toutes les actions sensibles effectuées dans l'application, avec l'horodatage, l'utilisateur à l'origine de l'action, le type d'action, l'entité concernée et les détails associés.",
        ],
      },
      {
        id: "login-history",
        title: "Comment consulter l'historique de connexion",
        steps: [
          "Allez dans Admin → Historique de connexion.",
          "Vous y trouverez la liste des tentatives de connexion (réussies et échouées), avec l'e-mail utilisé, la date et l'heure, le statut, et l'adresse IP / l'appareil lorsqu'ils sont disponibles.",
          "La liste est triée de la plus récente à la plus ancienne et paginée si elle est longue.",
        ],
      },
    ],
  },
];

function HelpPage() {
  const { data: roles } = useMyRoles();

  const visibleGroups = GROUPS.filter(g => {
    if (g.minRole === "vendeur") return true;
    if (g.minRole === "responsable") return hasAny(roles, "admin", "responsable");
    return hasAny(roles, "admin");
  });

  return (
    <div>
      <SectionHero
        eyebrow="Aide"
        title="Guide d'utilisation de l'application, adapté à votre rôle"
        links={HELP_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex items-center gap-3">
        <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guide d'utilisation</h1>
          <p className="text-sm text-muted-foreground">{visibleGroups.length} section{visibleGroups.length > 1 ? "s" : ""} disponible{visibleGroups.length > 1 ? "s" : ""} selon votre rôle</p>
        </div>
      </header>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sommaire</h2>
        <div className="space-y-4">
          {visibleGroups.map(g => (
            <div key={g.key}>
              <p className="text-sm font-medium">{g.title}</p>
              <ul className="mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {g.topics.map(t => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-sm text-primary hover:underline">{t.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {visibleGroups.map(g => (
        <Card key={g.key} className="p-6">
          <div className="mb-2">
            <h2 className="text-xl font-semibold">{g.title}</h2>
            <p className="text-sm text-muted-foreground">{g.description}</p>
          </div>
          <Accordion type="multiple" className="w-full">
            {g.topics.map(t => (
              <AccordionItem key={t.id} value={t.id} id={t.id} className="scroll-mt-20">
                <AccordionTrigger>{t.title}</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm">
                    {t.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {t.note && (
                    <p className="mt-3 text-sm text-muted-foreground border-l-2 border-border pl-3">{t.note}</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ))}
      </div>
    </div>
  );
}