# Smart Bookmark App

A simple bookmark manager built with Next.js (App Router), Supabase, and Tailwind CSS.

## Features

- Google OAuth sign in/sign up (no email/password)
- Add bookmarks with URL and title
- Delete bookmarks
- Bookmarks are private per user (Row Level Security)
- Real-time updates across tabs without page refresh
- Deployed on Vercel

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (Auth, PostgreSQL Database, Realtime Broadcast)
- **Tailwind CSS** for styling

## Setup

1. Clone the repo
2. `npm install`
3. Create a `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Set up the Supabase database (see SQL below)
5. Enable Google OAuth in Supabase Auth providers
6. `npm run dev`

### Supabase Database Setup

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE abstrabit_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE abstrabit_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON abstrabit_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON abstrabit_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON abstrabit_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE abstrabit_bookmarks REPLICA IDENTITY FULL;
```

Then enable Realtime on the `abstrabit_bookmarks` table in the Supabase dashboard.

## Problems I Ran Into

### 1. Hydration mismatch on page load

Right after setting up the layout, I started getting React hydration errors in the console. Took me a minute to figure out it wasn't my code  - it was the Dark Reader browser extension injecting its own attributes (`data-darkreader-*`) into the `<html>` tag before React could hydrate. The server-rendered HTML didn't have those attributes, so React complained about the mismatch.

Fixed it by adding `suppressHydrationWarning` to the `<html>` tag in `layout.tsx`. This is the standard Next.js fix for browser extensions that modify the DOM before React hydrates.

### 2. Real-time sync only worked for deletes, not inserts

This one took the most debugging. I had set up Supabase's `postgres_changes` subscription to listen for INSERT and DELETE events on the bookmarks table. Deleting a bookmark in one tab would correctly remove it from another tab in real-time. But adding a bookmark? Nothing. The other tab just sat there.

I dug into it and found that Supabase Realtime handles these events differently under the hood. For DELETE events, it skips RLS checks entirely (the row is already gone, so there's nothing to verify). But for INSERT events, the Realtime server actually impersonates the subscribing user and runs a SELECT against the new row to check if they're allowed to see it. If the RLS policy evaluation fails or doesn't match, the event gets silently dropped  - no error, no warning, just nothing.

I tried recreating the SELECT policy with an explicit `TO authenticated` role, verified the publication config had `pubinsert = true`  - still nothing. The INSERT events just wouldn't come through.

Ended up switching from `postgres_changes` to **Supabase Broadcast** channels. Instead of relying on database-level change detection, the app now explicitly broadcasts events when a bookmark is added or deleted. Each user gets their own channel (`bookmarks_${user.id}`), and any tab subscribed to that channel picks up the event instantly. It's simpler, more reliable, and sidesteps the whole RLS evaluation issue with Realtime.
