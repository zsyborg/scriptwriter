# Scriptwriter

A mobile-first writing workspace for building story projects, characters, locations, episodes, and scenes.

## Stack

- Next.js App Router + TypeScript
- MongoDB native Node.js driver
- Responsive CSS and Lucide icons

## Requirements

- Node.js 20.9+
- pnpm (recommended)
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and configure the database and authentication secrets. The database name defaults to `scriptwriter`.

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=scriptwriter
   SESSION_SECRET=replace-with-a-long-random-secret
   ADMIN_USERNAME=zasha
   ADMIN_PASSWORD=zasha
   ```

   The requested initial admin credentials are `zasha` / `zasha` for local development when the admin variables are not set. Production mode requires explicit `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` values. **Before deploying publicly, set a strong admin password and a unique, long session secret in your hosting provider’s environment settings.** Do not commit `.env.local` or production secrets.

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Visit `/login` to sign in as a writer. Open `/admin` to sign in as the administrator, create writer accounts, reset passwords, or disable accounts. Writer accounts and password hashes are stored in the MongoDB `users` collection. The admin login is separate and uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.

## Current milestone

- Mobile-first workspace dashboard
- Project creation dialog
- MongoDB connection helper
- Project listing and creation API
- Initial project cards and navigation concepts

The initial project cards are sample preview content. Project creation uses the MongoDB API when configured; the current preview falls back to local UI state if the API is unavailable.

## Planned milestones

1. Authentication and per-user data isolation
2. Project, episode, and scene CRUD
3. Character and location libraries
4. Rich-text scene editor with structured character/location references
5. Autosave, export, and polished mobile editing

## Important security note

This is an early development scaffold. Authentication and per-user project ownership checks are implemented, but run a production build and security review before deploying with real user data. Configure strong production credentials and `SESSION_SECRET`; the default admin credentials are for initial local setup only.