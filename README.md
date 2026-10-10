# Shanthi Event & Benefactor Management App

A modular React application built with Vite and Supabase for managing benefactor profiles, event creation, and event ticketing with Square processing fee calculation.

---

## 🏗️ Modular Architecture

As requested, the application is strictly modularized into dedicated JSX components instead of a monolithic file:

```text
Shanthi_event_app/
├── supabase_schema.sql             # Complete SQL schema for Supabase
├── .env.example                    # Sample environment variables
├── src/
│   ├── components/
│   │   ├── MemberProfile.jsx       # 1. Benefactor / Member Profile management
│   │   ├── CreateEvent.jsx         # 2. "Create Event" modal & form
│   │   ├── Tickets.jsx             # 3. Tickets section (Individual & Family of Four)
│   │   └── SupabaseConfigModal.jsx # Quick database connection & schema copy tool
│   ├── supabaseClient.js           # Supabase client with resilient offline/fallback support
│   ├── App.jsx                     # Root application coordinating all modular components
│   ├── App.css                     # Modern UI styling
│   ├── index.css                   # Global reset
│   └── main.jsx                    # React entry point
```

---

## 📋 Features

### 1. Member / Benefactor Profile (`src/components/MemberProfile.jsx`)
- Collects all requested fields matching your database:
  - **Benefactor Name** (`member1`)
  - **Benefactor Spouse Name** (`member2`)
  - **Address** (`address`)
  - **Phone 1** (`phone1`)
  - **Phone 2** (`phone2`)
  - **Email 1** (`email1`)
  - **Email 2** (`email2`)
  - **Notification Preferences** (`notification_preference` - supports multiple selections e.g. Email, SMS / Text Message, Phone Call, Postal Mail)
- **Live Search & Autofill**: Search existing benefactors across `member1`, `member2`, `phone1`, `phone2`, `email1`, and `email2`. Selecting any matching benefactor automatically populates the form and links them to the tickets section.
- **Update or Insert**: Loaded profiles can be edited and updated in Supabase, or saved as a new benefactor.

### 2. Create Event Component (`src/components/CreateEvent.jsx`)
- Includes a prominent **"Create Event"** button.
- Opens a dedicated modal dialog allowing entry of:
  - **Event Name**
  - **Year** (e.g. 2026)
  - **Individual Ticket Price**
  - **Family of Four Ticket Price**
  - **Square Fees**
- Saves the event directly to Supabase (`events` table) and instantly refreshes the Tickets section.

### 3. Tickets Section (`src/components/Tickets.jsx`)
- Queries event ticket prices dynamically from the Supabase `events` table.
- Provides 2 ticket options:
  - **Individual Ticket**
  - **Family of Four**
- Includes quantity selectors (`-` / `+`), item subtotal calculations, Square fee breakdown, and Grand Total.
- Allows assigning orders to a registered Benefactor.
- Records orders in the Supabase `ticket_orders` table and shows recent purchase receipts.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase Database
1. Open your Supabase Dashboard at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** tab -> **New query**.
3. Copy the contents of [`supabase_schema.sql`](file:///c:/Working/Shanthi_event_app/supabase_schema.sql) and click **Run**.
4. Retrieve your **Project URL** and **Anon Public Key** from **Project Settings -> API**.

### 3. Connect Supabase
You can connect in either of two ways:
- **Option A (Environment File)**: Create a `.env` file in the root directory:
  ```env
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```
- **Option B (Direct in UI)**: Click the **Supabase** pill in the top navbar inside the app and enter your Project URL and Anon Key directly!

*(Note: If no Supabase credentials are configured, the app seamlessly runs in local fallback mode with sample data so you can test all features immediately).*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
