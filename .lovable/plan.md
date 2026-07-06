## Objectif

Livrer les workflows sélectionnés en gardant "toujours 1 admin approuve", mono-site avec `site_id` optionnel (visibilité globale), pas de NF525.

## Périmètre (ce lot)

### 1. Matériaux défectueux
- Table `defective_items` : product_id, warehouse_id, quantity, severity (mineur/majeur/critique), category (casse/vol/péremption/défaut_fournisseur/autre), reason, reported_by, evidence_url?, status (declared/confirmed/rejected), created_at.
- À la déclaration : mouvement stock `out` automatique (raison "Défectueux : …"), stock à jour en direct.
- Écran vendeur/responsable : formulaire déclaration + liste "mes déclarations".
- Écran admin : liste + confirmation/rejet (rejet = réintègre le stock).

### 2. Déstockage (destocking requests)
- Table `destocking_requests` : product_id, warehouse_id, quantity, reason, requested_by, status (pending/approved/rejected/executed), approver_id, approver_note, created_at, decided_at.
- Vendeur/responsable soumet → admin approuve/rejette → à l'approbation, mouvement `out` déclenché automatiquement + statut `executed`.

### 3. Décaissement (cash disbursement)
- Table `disbursement_requests` : amount, currency EUR, category (achat/salaire/loyer/autre), beneficiary, description, justification_url? (upload), requested_by, status (pending/approved/rejected/paid), approver_id, paid_at, payment_method, notes.
- Bucket Storage `disbursement-evidence` (privé) pour PDF/photos justificatifs.
- Workflow : soumission → admin approuve → admin marque "payé" (archivage automatique via `paid_at`).

### 4. Retours clients
- Table `customer_returns` liée à `sales` : sale_id, product_id, quantity, reason, destination (stock/defective), refund_type (cash/store_credit/none), status (pending/approved/rejected), approver_id.
- Écran vendeur : sélection vente → produits → destination + type remboursement.
- Écran admin : approbation. Sur approbation :
  - si destination=stock → mouvement `in`
  - si destination=defective → ligne dans `defective_items`
  - si refund=cash → sortie caisse enregistrée dans session ouverte

### 5. Clôture de caisse journalière (Z)
- Étendre `cash_sessions` (déjà existante) : ajout `closing_expected`, `closing_counted`, `variance`, `closed_by`, `closed_at`, `z_report_number`.
- Écran clôture : calcul auto de l'attendu (ventes cash + ouverture − remboursements), saisie compté physique, écart affiché, bouton "Clôturer" (admin ou responsable). Génère un rapport Z imprimable.

### 6. Seuils & règles (choix "toujours 1 admin")
- Pas de table de seuils cette itération. Toute demande (déstockage, décaissement, retour, défectueux critique) nécessite 1 approbation admin. Défectueux mineur/majeur = auto-appliqué, critique = attente confirmation.

### 7. Notifications in-app
- Table `notifications` : user_id, type, title, body, link, read_at, created_at.
- Cloche dans le header (badge count non-lus), dropdown liste, page `/notifications`.
- Triggers Postgres : nouvelle demande → notifier tous les admins ; décision → notifier le demandeur.
- Realtime via Supabase (`postgres_changes` sur `notifications`).

### 8. Admin — profils & droits
- Page `/admin/users` (existe) enrichie : tableau avec colonnes email, nom, rôles (badges), dernière connexion, actif oui/non, actions (éditer rôles, réinitialiser mdp, supprimer).
- Dialog édition rôles (checkboxes admin/responsable/vendeur).

### 9. Reporting enrichi (dashboard)
- Ajout cards : décaissements du mois, valeur stock défectueux du mois, demandes en attente (par type), écart de caisse moyen 30j.
- Graphique ventes 30j (existe déjà si présent, sinon simple line chart).

### 10. Multi-sites (léger)
- Colonne `site_id uuid` sur warehouses (nullable) + table `sites` (name, address). Visibilité globale : pas de RLS par site, juste un filtre facultatif dans les rapports. Vendeur voit tout.

## Hors périmètre (à traiter plus tard)
Lots/n° série/péremption, promotions avec approbation, mode hors-ligne PWA, conformité NF525, archivage automatique long terme, alertes email/SMS.

## Détails techniques

- Migration unique : nouvelles tables + colonnes + fonctions Postgres (`declare_defective`, `approve_destocking`, `approve_disbursement`, `process_customer_return`, `close_cash_session`, `notify_admins`) + triggers de notification + GRANT + RLS (authenticated pour lecture ; écrite via RPC SECURITY DEFINER qui vérifie `has_role`).
- Bucket privé `disbursement-evidence`, upload signé côté client.
- Server functions dans `src/lib/*.functions.ts` pour les opérations admin (approbations) avec `requireSupabaseAuth` + check role admin.
- UI : nouvelles routes sous `_authenticated/` :
  - `defective.index.tsx`, `defective.new.tsx`
  - `destocking.index.tsx`, `destocking.new.tsx`
  - `disbursement.index.tsx`, `disbursement.new.tsx`, `disbursement.$id.tsx`
  - `returns.index.tsx`, `returns.new.tsx`
  - `cash-sessions.$id.tsx` (clôture Z)
  - `notifications.tsx`
- Nav sidebar réorganisée en sections : Opérations, Approbations (admin), Finances, Administration.
- Realtime notifications via `supabase.channel().on('postgres_changes', ...)`.

## Ordre d'exécution
1. Migration DB (tables + fonctions + triggers + storage bucket + RLS + GRANT).
2. Server functions admin (`approveDestocking`, `approveDisbursement`, `processReturn`, `closeCashSession`, `updateUserRoles`).
3. Librairies client (`defective.ts`, `destocking.ts`, `disbursement.ts`, `returns.ts`, `notifications.ts`).
4. Pages UI listées ci-dessus.
5. Cloche notifications + realtime dans `__root.tsx` (authenticated).
6. Dashboard enrichi.
7. Sidebar réorganisée.

Volume estimé : ~1 migration + ~5 server functions + ~6 libs + ~12 routes + refonte sidebar/dashboard.