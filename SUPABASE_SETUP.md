# Supabase Setup Instructions

## Step 1: Create Environment File

Create a file named `.env.local` in the project root (`/Users/shartfin/.gemini/antigravity/scratch/SoraWebUI/.env.local`) with the following content:

```
VITE_SUPABASE_URL=https://krcjjkftrtddkmkcobmi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyY2pqa2Z0cnRkZGtta2NvYm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MzM5MjYsImV4cCI6MjA4MTAwOTkyNn0.Ut76cfTIB1T6fg6w38OaQykRwlbg7vZ_ZtUwDQ30V7Q
```

## Step 2: Run Database Schema

1. Go to your Supabase project: https://supabase.com/dashboard/project/krcjjkftrtddkmkcobmi
2. Click on "SQL Editor" in the left sidebar
3. Click "+ New Query"
4. Copy the entire contents of `supabase-schema.sql` 
5. Paste into the SQL editor
6. Click "Run" or press Cmd+Enter

This will create:
- 4 tables: `user_settings`, `user_modules`, `watch_history`, `hidden_items`
- Row Level Security policies (users can only see their own data)
- Indexes for performance
- Auto-update triggers

## Step 3: Test the Implementation

1. Start the dev server: `npm run dev`
2. Open the app in your browser
3. Click the "Login" button in the header
4. Create a new account with your email and password
5. Your existing localStorage data will automatically migrate to the cloud
6. Log in on a different browser/device to verify sync works

## Features

### Authentication
- ✅ Email/password login and registration
- ✅ Password reset via email
- ✅ Session persistence
- ✅ Automatic logout on session expiry

### Sync
- ✅ **Auto-sync on login**: Pulls data from cloud on first login
- ✅ **Auto-sync on changes**: Active module changes sync automatically
- ✅ **Manual sync button**: In Settings > Account section
- ✅ **Offline-first**: Works without internet, syncs when connected
- ✅ **Data migration**: Existing localStorage data migrates on first login

### Synced Data
- Theme and accent color
- Subtitle settings (size, color, background, outline)
- App behavior (auto-activate, auto-refetch modules)
- Custom proxy settings
- Module list and active module
- Watch history (continue watching)
- Hidden continue watching items

### Security
- ✅ Row Level Security (RLS) policies ensure users only see their own data
- ✅ Anon key is safe for client-side use
- ✅ Authentication handled by Supabase Auth

## Troubleshooting

### "Auth session missing" errors
- Make sure `.env.local` file exists with correct credentials
- Restart the dev server after creating `.env.local`

### Database connection errors
- Verify you ran the SQL schema in Supabase
- Check Supabase project is active at https://supabase.com/dashboard

### Sync not working
- Check browser console for errors
- Verify you're logged in (check Settings > Account section)
- Try manual sync button in Settings

### Page keeps reloading
- This is expected behavior when logging in for the first time
- The app reloads to apply synced settings from the cloud
