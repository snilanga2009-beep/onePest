# 🚀 PestControl Pro - Production Deployment Guide
### Vercel (PWA Frontend & Serverless) + Supabase (PostgreSQL/RLS/Realtime) + Firebase (Web Push)

This document provides complete, step-by-step instructions to deploy the Pest Control Management System to production on **free tier services** with enterprise-grade security and zero vendor lock-in.

---

## 🏗️ Architecture & Free-Tier Blueprint

| Component | Provider | Free Tier Allocation | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend & PWA** | **Vercel** | Unlimited HTTPS, Global Edge CDN | Hosts the Vite React PWA with offline caching & installability |
| **Serverless Functions** | **Vercel Functions** | 100k executions/mo | Secure FCM push dispatcher & Text.lk SMS proxy |
| **Database & Realtime** | **Supabase** | 500 MB PostgreSQL, 50k MAU, Realtime | Central database with Row Level Security (RLS) & live sync |
| **File Storage** | **Supabase Storage** | 1 GB Free Storage | Customer signatures, completion photos & logos |
| **Web Push Dispatch** | **Firebase (FCM)** | **100% Free Unlimited** | Real Web Push notifications (Android, iOS 16.4+, iPad, Desktop) |
| **SMS Gateway** | **Text.lk** | Pay-as-you-go / Simulation | Sri Lanka SMS alerts and technician OTP dispatch |

---

## STEP 1: Set Up Supabase (PostgreSQL, RLS & Storage)

1. **Create Project**:
   - Go to [https://supabase.com](https://supabase.com) and create a free account.
   - Click **New Project**, choose a project name (e.g., `pest-control-prod`) and a database password.
   - Select the region closest to your operations (e.g., `Singapore (ap-southeast-1)` or `Mumbai (ap-south-1)`).

2. **Execute Database Migrations**:
   - In your Supabase Dashboard, open the **SQL Editor** on the left menu.
   - Open [supabase/migrations/20260923000000_initial_schema.sql](./supabase/migrations/20260923000000_initial_schema.sql), copy all content, paste into the SQL Editor, and click **Run**.
   - Open [supabase/migrations/20260923000001_rls_policies.sql](./supabase/migrations/20260923000001_rls_policies.sql), copy all content, paste into the SQL Editor, and click **Run**.
   - Open [supabase/seed.sql](./supabase/seed.sql), copy all content, paste into the SQL Editor, and click **Run**.

3. **Create Storage Buckets**:
   - In Supabase Dashboard, navigate to **Storage**.
   - Click **New Bucket**:
     - Name: `job-photos` (Enable **Public Bucket** so technician photos load seamlessly).
   - Click **New Bucket**:
     - Name: `app-branding` (Enable **Public Bucket** for company logos & app icons).

4. **Copy API Keys**:
   - In Supabase Dashboard, go to **Project Settings** (gear icon) $\rightarrow$ **API**.
   - Note down:
     - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
     - **Project API Keys $\rightarrow$ `anon` / `public`**
     - **Project API Keys $\rightarrow$ `service_role` / `secret`** (Never share or expose in client code).

---

## STEP 2: Set Up Firebase Cloud Messaging (FCM Web Push)

1. **Create Firebase Project**:
   - Go to [https://console.firebase.google.com](https://console.firebase.google.com).
   - Click **Add Project**, name it (e.g. `pestcontrol-pwa`), and keep Google Analytics enabled or disabled (Free Spark plan).

2. **Register Web App**:
   - On the Project Overview page, click the **Web icon (`</>`)**.
   - App nickname: `PestControl Web PWA`.
   - Check **Also set up Firebase Hosting** (optional, Vercel is our primary host).
   - Click **Register App**.
   - Copy the generated `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

3. **Generate Web Push Certificate (VAPID Key)**:
   - Click the gear icon next to Project Overview $\rightarrow$ **Project settings**.
   - Go to the **Cloud Messaging** tab.
   - Scroll down to **Web configuration** $\rightarrow$ **Web Push certificates**.
   - Click **Generate key pair**.
   - Copy the generated public key string (e.g., `BKagvny...`). This is your `VITE_FIREBASE_VAPID_KEY`.

4. **Generate Service Account Private Key**:
   - Still in **Project settings**, go to the **Service accounts** tab.
   - Ensure **Node.js** is selected.
   - Click **Generate new private key** and confirm.
   - A `.json` file will download to your computer. Open it in a text editor to get:
     - `project_id`
     - `client_email`
     - `private_key` (keep the entire multi-line string including `-----BEGIN PRIVATE KEY-----`).

---

## STEP 3: Deploy on Vercel

1. **Import Repository**:
   - Go to [https://vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **Add New... $\rightarrow$ Project**.
   - Select the GitHub repository: `snilanga2009-beep/onePest`.

2. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default root)
   - **Build Command**: `npm --prefix client run build`
   - **Output Directory**: `client/dist`

3. **Add Environment Variables**:
   Under the **Environment Variables** section in Vercel, add each of the following:

   | Key | Value | Scope | Description |
   | :--- | :--- | :--- | :--- |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Production, Preview | Supabase Public Anon Key |
   | `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Production, Preview | Firebase Web API Key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` | Production, Preview | Firebase Auth Domain |
   | `VITE_FIREBASE_PROJECT_ID` | `project-id` | Production, Preview | Firebase Project ID |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `project.appspot.com` | Production, Preview | Firebase Storage Bucket |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `103953800507` | Production, Preview | Firebase Messaging Sender ID |
   | `VITE_FIREBASE_APP_ID` | `1:103953800507:web:...` | Production, Preview | Firebase Web App ID |
   | `VITE_FIREBASE_VAPID_KEY` | `BKagvny...` | Production, Preview | Web Push Certificate Public Key |
   | `SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview | Supabase URL for Serverless |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Production, Preview | **Server Secret** (Service Role) |
   | `FIREBASE_PROJECT_ID` | `project-id` | Production, Preview | Firebase Admin Project ID |
   | `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxx@...` | Production, Preview | Firebase Service Account Email |
   | `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Production, Preview | Firebase Admin Private Key |
   | `TEXT_LK_API_TOKEN` | *(Your Text.lk Token)* | Production, Preview | Text.lk Sri Lanka SMS Token |
   | `TEXT_LK_SENDER_ID` | `TextLKDemo` | Production, Preview | SMS Sender ID (e.g. TextLKDemo) |

4. **Click Deploy**:
   - Vercel will build the frontend with Vite and provision the `/api/*` serverless routes.
   - Upon completion, you will receive your production URL (e.g., `https://onepest.vercel.app`).
   - SSL / HTTPS is automatically enabled by Vercel.

---

## STEP 4: PWA Installation & Testing Guide

### 📱 Android Phones & Tablets:
1. Open your Vercel URL in **Google Chrome**.
2. A bottom banner will prompt **"Add PestControl Pro to Home screen"**, or tap the **three dots menu $\rightarrow$ Install app**.
3. Once installed, launch the app directly from your home screen.
4. Tap **"Enable Push Notifications"** when prompted. The device token is automatically registered with Supabase.

### 🍏 iPhones & iPads (iOS 16.4+):
> [!IMPORTANT]
> Apple iOS requires web apps to be installed to the Home Screen to receive Web Push notifications.
1. Open your Vercel URL in **Safari**.
2. Tap the **Share button** (square with arrow pointing up) at the bottom/top bar.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**.
5. Launch **PestControl** from your iOS Home Screen.
6. Log in via 1-time phone OTP or credentials and tap **"Enable Push Notifications"**.

### 💻 Desktop Browsers (Chrome / Edge / Safari):
1. In the address bar, click the **Install icon** (monitor with down arrow).
2. The app opens in its own standalone window with keyboard shortcuts and native OS push notifications.

---

## STEP 5: Verification & Zero Data Loss Testing

### 1. Test Web Push Dispatch:
- In the technician app, go to **Profile / Notifications** and tap **"Send Test Push"**.
- A native notification with sound and vibration will appear immediately on your device.
- Tapping the notification automatically opens and highlights the assigned job.

### 2. Test Offline Support & Zero Data Loss:
1. Open the Technician panel (`/tech`).
2. Turn on **Airplane Mode** (no WiFi, no mobile data).
3. The app displays **`OFFLINE MODE`**.
4. Tap **Start Job**, enter completion notes, and capture a customer signature.
5. Tap **Complete Job**. The action is saved safely to IndexedDB with status **`WAITING FOR SYNC (1 pending)`**.
6. Turn off Airplane Mode.
7. The sync engine automatically detects connectivity and uploads the completed job and signature to the database.
8. Status updates to **`SYNCED ✓`** with zero lost data!

---

## STEP 6: Future Migration & Portability
If you choose to migrate away from Vercel or Supabase in the future:
- **Database**: Standard PostgreSQL 15 schema can be exported via `pg_dump` and restored to AWS RDS, DigitalOcean, or self-hosted Docker PostgreSQL.
- **Frontend**: The Vite React app can be built with `npm run build` and served from any Nginx, Cloudflare Pages, AWS S3, or Docker container.
- **Push Engine**: The FCM serverless functions follow standard Node.js Express format and can run on any Node.js server.
