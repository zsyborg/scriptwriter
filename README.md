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

2. Copy `.env.example` to `.env.local` and configure `MONGODB_URI`. The database name defaults to `scriptwriter`.

   Example local connection:

   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=scriptwriter
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Visit http://localhost:3000. Check the database connection at `/api/health`.

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

This is an early development scaffold. Do not deploy publicly with real user data until authentication, authorization, and per-user data isolation have been implemented and tested.