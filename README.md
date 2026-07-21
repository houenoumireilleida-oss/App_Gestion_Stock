# Exact Screenshot

Application de gestion structurée en deux parties indépendantes.

## Structure

- `frontend/` contient l'application React/TanStack Start/Vite, ses sources, sa configuration TypeScript, ESLint, Prettier, shadcn/ui et ses dépendances Bun.
- `backend/` contient la configuration Supabase et les migrations de base de données.

## Frontend

```bash
cd frontend
bun install
bun run dev
```

Les variables utilisées par Vite et le serveur TanStack Start sont dans `frontend/.env`.

## Backend

```bash
cd backend
supabase status
```

La configuration Supabase se trouve dans `backend/supabase/config.toml` et les migrations dans `backend/supabase/migrations/`.
