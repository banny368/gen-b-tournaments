# Gen B Tournaments — Deployment Guide

> **Static Site** | Supabase Backend | Vercel Hosting  
> Estimated setup time: **~45 minutes**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Supabase Setup](#step-1-supabase-setup)
3. [Step 2: Cloudinary Setup](#step-2-cloudinary-setup)
4. [Step 3: OneSignal Setup](#step-3-onesignal-setup)
5. [Step 4: Update config.js](#step-4-update-configjs)
6. [Step 5: GitHub Setup](#step-5-github-setup)
7. [Step 6: Vercel Deployment](#step-6-vercel-deployment)
8. [Step 7: Post-Deploy Configuration](#step-7-post-deploy-configuration)
9. [Step 8: Create First Admin](#step-8-create-first-admin)
10. [Step 9: DNS & Custom Domain](#step-9-dns--custom-domain)
11. [Troubleshooting](#troubleshooting)
12. [Environment Checklist](#environment-checklist)

---

## Prerequisites

Create free accounts on these platforms before starting:

| Platform    | URL                          | Purpose                        |
|-------------|------------------------------|-------------------------------|
| GitHub      | https://github.com           | Code repository hosting        |
| Vercel      | https://vercel.com           | Static site hosting (free)     |
| Supabase    | https://supabase.com         | Database + Auth + Storage      |
| Cloudinary  | https://cloudinary.com       | Image CDN for screenshots      |
| OneSignal   | https://onesignal.com        | Push notifications (free)      |

---

## Step 1: Supabase Setup

### 1.1 — Create a New Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose your organization
4. Fill in:
   - **Name**: `gen-b-tournaments`
   - **Database Password**: Generate a strong password and **save it securely**
   - **Region**: Choose the region closest to your users (e.g., `ap-south-1` for India)
5. Click **Create new project**
6. Wait ~2 minutes for provisioning

### 1.2 — Run the Database Schema

1. In the Supabase sidebar, click **SQL Editor**
2. Click **New query**
3. Open `docs/database-schema.md` from this project
4. Copy and paste each SQL block **in order**:
   - Prerequisites (extensions)
   - Table definitions (1–19)
   - Indexes
   - RLS Enable statements
   - Helper functions (`is_admin`, `is_moderator_or_admin`)
   - RLS Policies for each table
   - RPC Functions
   - Triggers
5. Click **Run** after each block and verify no errors

> **Tip**: Run one section at a time to isolate any errors.

### 1.3 — Enable Authentication

1. Go to **Authentication > Providers**
2. **Email**: Ensure it is enabled
   - Toggle OFF **Confirm email** during testing (enable later in production)
3. **Google OAuth** (optional):
   - Enable the Google provider
   - Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com)
   - Set **Authorized redirect URI** to:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Copy Client ID and Secret into Supabase

### 1.4 — Configure Auth Settings

1. Go to **Authentication > URL Configuration**
2. Set **Site URL**: `https://your-vercel-domain.vercel.app`
3. Add **Redirect URLs**:
   ```
   https://your-vercel-domain.vercel.app/
   https://your-vercel-domain.vercel.app/**
   http://localhost:3000/
   http://localhost:5500/
   ```

### 1.5 — Set Up Storage Buckets

1. Go to **Storage** in the sidebar
2. Click **New bucket** and create each:

   | Bucket Name           | Public? | Settings                    |
   |-----------------------|---------|-----------------------------|
   | `payment-proofs`      | No      | Private, 5 MB max           |
   | `avatars`             | Yes     | Public, 2 MB max            |
   | `tournament-banners`  | Yes     | Public, 5 MB max            |
   | `clan-logos`          | Yes     | Public, 2 MB max            |

3. For each bucket, go to **Policies** and add the storage RLS policies from `database-schema.md`

### 1.6 — Get Your API Keys

1. Go to **Project Settings > API**
2. Copy and save:
   - **Project URL** (e.g., `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (safe to expose in frontend)
   - **service_role** key (**NEVER expose** — server-side only)

### 1.7 — Enable Realtime

1. Go to **Database > Replication**
2. Under **Supabase Realtime**, ensure these tables are enabled:
   - `tournaments`
   - `tournament_registrations`
   - `notifications`
   - `messages`
   - `announcements`
   - `wallets`

---

## Step 2: Cloudinary Setup

### 2.1 — Create Account

1. Sign up at [https://cloudinary.com](https://cloudinary.com)
2. Note your **Cloud Name** from the dashboard

### 2.2 — Create Upload Preset

This allows unsigned uploads from the browser (no secret key exposed):

1. Go to **Settings > Upload**
2. Scroll to **Upload presets**
3. Click **Add upload preset**
4. Configure:
   - **Preset name**: `genb_unsigned`
   - **Signing Mode**: `Unsigned`
   - **Folder**: `genb/payment-proofs` (or leave blank)
   - **Allowed formats**: `jpg, jpeg, png, webp`
   - **Max file size**: `5000000` (5 MB)
5. Click **Save**

### 2.3 — Note Your Config

```
Cloud Name:    your_cloud_name
Upload Preset: genb_unsigned
Upload URL:    https://api.cloudinary.com/v1_1/your_cloud_name/image/upload
```

---

## Step 3: OneSignal Setup

### 3.1 — Create Web App

1. Sign up at [https://onesignal.com](https://onesignal.com)
2. Click **New App/Website**
3. Name it: `Gen B Tournaments`
4. Choose **Web** platform
5. Select **Typical Site**

### 3.2 — Configure Web Push

1. Set **Your Site URL**: `https://your-vercel-domain.vercel.app`
2. Set **My site is not fully HTTPS**: Leave unchecked (Vercel is HTTPS)
3. **Default Notification Icon**: Upload your logo
4. Click **Save**

### 3.3 — Get App ID

1. Go to **Settings > Keys & IDs**
2. Copy **OneSignal App ID** (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 3.4 — Download SDK Files

OneSignal requires two files in your project root:
- `OneSignalSDKWorker.js`
- `OneSignalSDKUpdaterWorker.js`

Download from your OneSignal dashboard or use the CDN approach in your `config.js`.

---

## Step 4: Update config.js

Open `assets/js/config.js` and fill in all credentials:

```javascript
const CONFIG = {
  supabase: {
    url:    'https://YOUR_PROJECT_REF.supabase.co',  // From Step 1.6
    anonKey: 'YOUR_ANON_PUBLIC_KEY'                   // From Step 1.6
  },
  cloudinary: {
    cloudName:    'YOUR_CLOUD_NAME',   // From Step 2.2
    uploadPreset: 'genb_unsigned'      // From Step 2.2
  },
  oneSignal: {
    appId: 'YOUR_ONESIGNAL_APP_ID'    // From Step 3.3
  },
  app: {
    name:    'Gen B Tournaments',
    url:     'https://your-vercel-domain.vercel.app',  // Update after Step 6
    version: '1.0.0'
  }
};
```

> ⚠️ **NEVER** put your Supabase `service_role` key in `config.js`. It should only be used server-side.

---

## Step 5: GitHub Setup

### 5.1 — Create Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: `gen-b-tournaments`
3. Set to **Private** (recommended) or Public
4. Do NOT initialize with README (you have existing files)
5. Click **Create repository**

### 5.2 — Initialize Git and Push

Open terminal/PowerShell in your project folder (`Final/`):

```powershell
# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "feat: initial Gen B Tournaments deployment"

# Add remote (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/gen-b-tournaments.git

# Push to main branch
git branch -M main
git push -u origin main
```

### 5.3 — Verify .gitignore

Ensure these are in `.gitignore` (already configured in project root):
- `.env`
- `node_modules/`
- No `service_role` keys anywhere

---

## Step 6: Vercel Deployment

### 6.1 — Import Project

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Connect your GitHub account if not already done
4. Select your `gen-b-tournaments` repository
5. Click **Import**

### 6.2 — Configure Build Settings

Vercel will auto-detect this as a static site. Verify:

| Setting           | Value                                    |
|-------------------|------------------------------------------|
| Framework Preset  | `Other` (static HTML)                    |
| Build Command     | *(leave empty)*                          |
| Output Directory  | *(leave empty, or `.`)*                  |
| Install Command   | *(leave empty)*                          |
| Root Directory    | *(leave empty)*                          |

### 6.3 — Environment Variables (Optional)

If you want to avoid hardcoding credentials, add them as Vercel env vars:

1. In project settings > **Environment Variables**
2. Add (these would need a build step to inject, or use config.js directly):
   ```
   SUPABASE_URL      = https://xxx.supabase.co
   SUPABASE_ANON_KEY = your_anon_key
   ```

> For a fully static site, credentials in `config.js` is the standard approach since the anon key is safe to expose.

### 6.4 — Deploy

1. Click **Deploy**
2. Wait ~30 seconds for deployment
3. Your site will be live at: `https://gen-b-tournaments.vercel.app` (or similar)
4. Note your deployment URL

### 6.5 — Verify vercel.json

Ensure `vercel.json` is in your project root. It handles:
- Clean URLs (no `.html` extension)
- Admin route rewrites
- Security headers

---

## Step 7: Post-Deploy Configuration

### 7.1 — Update Supabase Auth URLs

1. Go to **Supabase > Authentication > URL Configuration**
2. Update **Site URL**: `https://your-actual-vercel-domain.vercel.app`
3. Add to **Redirect URLs**:
   ```
   https://your-actual-vercel-domain.vercel.app/
   https://your-actual-vercel-domain.vercel.app/**
   ```

### 7.2 — Update config.js app.url

```javascript
app: {
  url: 'https://your-actual-vercel-domain.vercel.app'
}
```

Commit and push to redeploy:
```powershell
git add assets/js/config.js
git commit -m "config: update production URL"
git push
```

### 7.3 — Update OneSignal Domain

1. Go to OneSignal > **Settings > Platforms > Web Push**
2. Update site URL to your actual Vercel domain

### 7.4 — Test the Full Auth Flow

1. Visit your deployed site
2. Click **Sign Up** and create a test account
3. Check Supabase Dashboard > Authentication > Users — verify user appears
4. Check Database > profiles table — verify profile + wallet were auto-created
5. Test login/logout

### 7.5 — Configure Admin Settings (QR Code, UPI)

1. Go to Supabase > **SQL Editor**
2. Update the payment QR code:
   ```sql
   UPDATE public.admin_settings
   SET value = '"https://your-qr-code-url.com/qr.png"'
   WHERE key = 'qr_code_url';

   UPDATE public.admin_settings
   SET value = '"yourupi@bank"'
   WHERE key = 'upi_id';
   ```

---

## Step 8: Create First Admin

### Option A — Via Supabase Dashboard (Recommended)

1. Create your account via the website signup flow first
2. Go to Supabase > **Table Editor > profiles**
3. Find your profile row
4. Click the row to edit
5. Change `role` from `user` to `admin`
6. Click **Save**

### Option B — Via SQL Editor

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@gmail.com';
```

### Verify Admin Access

1. Log in with your admin account
2. Navigate to `/admin/index.html`
3. You should see the admin dashboard
4. If redirected to home, the role update may not have taken effect — try logging out and back in

---

## Step 9: DNS & Custom Domain

### 9.1 — Add Domain in Vercel

1. Go to your Vercel project > **Settings > Domains**
2. Click **Add Domain**
3. Enter your domain: `tournaments.genb.gg` or `genb.com`

### 9.2 — Configure DNS

Add these DNS records at your domain registrar:

**For apex domain** (`genb.com`):
```
Type: A
Name: @
Value: 76.76.21.21
```

**For subdomain** (`tournaments.genb.gg`):
```
Type: CNAME
Name: tournaments
Value: cname.vercel-dns.com
```

### 9.3 — Enable HTTPS

Vercel automatically provisions SSL certificates via Let's Encrypt within minutes.

### 9.4 — Update All Domain References

After DNS propagates (~5–30 minutes):
1. Update Supabase Site URL and Redirect URLs with custom domain
2. Update OneSignal site URL
3. Update `config.js` `app.url`
4. Commit and push

---

## Troubleshooting

### Auth redirect loop / not redirecting back

**Cause**: Site URL in Supabase doesn't match actual domain.  
**Fix**: Update Site URL in Supabase > Authentication > URL Configuration.

### "Row violates RLS policy" error

**Cause**: A write operation is blocked by RLS.  
**Fix**: Check the relevant table's RLS policies. Ensure user is authenticated and policy conditions are met.

### Profile not created after signup

**Cause**: The `handle_new_user` trigger failed.  
**Fix**: Check Supabase logs (Logs > Postgres). Ensure `auth.users` trigger is created.

### Images not uploading to Cloudinary

**Cause**: Incorrect `cloudName` or `uploadPreset`.  
**Fix**: Verify both values in `config.js` match your Cloudinary dashboard exactly. Ensure the preset is set to `Unsigned`.

### Admin page accessible without admin role

**Cause**: Client-side role check missing or bypassed.  
**Fix**: Verify `assets/js/auth.js` checks user role on each admin page load and redirects non-admins.

### Vercel 404 on admin routes

**Cause**: `vercel.json` rewrites not working.  
**Fix**: Ensure `vercel.json` is in the project root and committed to Git. Check Vercel deploy logs.

### OneSignal notifications not showing

**Cause**: Browser permission not granted, or service worker not loading.  
**Fix**: Check browser console for service worker errors. Ensure OneSignal SDK files are in project root.

---

## Environment Checklist

Run through this checklist before going live:

### Supabase
- [ ] Project created and region set
- [ ] Full SQL schema executed without errors
- [ ] Auth email provider enabled
- [ ] Site URL and Redirect URLs configured
- [ ] Storage buckets created (`payment-proofs`, `avatars`, `tournament-banners`, `clan-logos`)
- [ ] Realtime enabled for required tables
- [ ] API URL and anon key copied

### Cloudinary
- [ ] Account created
- [ ] Cloud name noted
- [ ] Unsigned upload preset created (`genb_unsigned`)

### OneSignal
- [ ] App created for Web Push
- [ ] App ID copied
- [ ] Site URL configured

### Config
- [ ] `assets/js/config.js` filled with all credentials
- [ ] `app.url` set to production domain

### GitHub
- [ ] Repository created
- [ ] All files pushed
- [ ] `.gitignore` confirmed (no secrets exposed)

### Vercel
- [ ] Project imported from GitHub
- [ ] Build settings verified (no build command)
- [ ] `vercel.json` deployed and active
- [ ] Deployment URL noted

### Post-Deploy
- [ ] Supabase Auth URLs updated with production domain
- [ ] OneSignal domain updated
- [ ] Test user signup and login working
- [ ] Admin profile role set to `admin`
- [ ] Admin dashboard accessible
- [ ] QR code URL and UPI ID set in admin_settings
- [ ] Test tournament creation
- [ ] Test deposit submission
- [ ] Test wallet operations

### Security
- [ ] `service_role` key NOT in any frontend file
- [ ] HTTPS enabled (Vercel auto-provisions)
- [ ] Security headers active (from `vercel.json`)
- [ ] RLS enabled on all tables

---

## Continuous Deployment

Every push to `main` branch auto-deploys via Vercel:

```powershell
# Make changes
git add .
git commit -m "feat: your feature description"
git push origin main
# Vercel auto-deploys in ~30 seconds
```

### Branch Previews

Vercel creates preview URLs for every branch/PR:
```powershell
git checkout -b feature/new-feature
# Make changes
git push origin feature/new-feature
# Preview URL auto-created: https://gen-b-tournaments-git-feature-xxx.vercel.app
```

---

*End of Deployment Guide — Gen B Tournaments*
