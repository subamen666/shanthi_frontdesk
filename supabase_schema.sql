-- Shanthi Event App - Supabase Database Schema
-- Run this SQL in your Supabase project's SQL Editor (SQL Editor -> New Query -> Run)

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Members / Benefactors Table
-- Matches the exact columns requested and shown in screenshot:
-- member1, member2, address, phone1, phone2, email1, email2, notification_preference, created_at
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member1 TEXT NOT NULL,                         -- Benefactor Name
  member2 TEXT,                                  -- Benefactor Spouse Name
  address TEXT,                                  -- Address
  phone1 TEXT,                                   -- Phone 1
  phone2 TEXT,                                   -- Phone 2
  email1 TEXT,                                   -- Email 1
  email2 TEXT,                                   -- Email 2
  notification_preference TEXT,                  -- Notification Preference
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Events Table
-- Stores Event Name, Year, Individual Ticket Price, Family of Four Ticket Price, and Square Fees
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,                      -- Event Name
  year INTEGER NOT NULL,                         -- Year (e.g. 2026)
  individual_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- Individual ticket price
  family_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0,      -- Family of Four ticket price
  square_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- Square fees (e.g. $3.50 or flat fee)
  square_fee_percentage NUMERIC(5, 2) DEFAULT 0, -- Square fee percentage (e.g. 2.9%)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Ticket Orders Table (Records purchases/registrations)
CREATE TABLE IF NOT EXISTS ticket_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  event_name TEXT,
  member_name TEXT,
  individual_qty INTEGER DEFAULT 0,
  family_qty INTEGER DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  square_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',         -- 'pending', 'paid', 'completed'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) and allow public read/write for anon access (ideal for local/app testing)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select/insert/update/delete for the app
DROP POLICY IF EXISTS "Public access for members" ON members;
CREATE POLICY "Public access for members" ON members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for events" ON events;
CREATE POLICY "Public access for events" ON events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for ticket_orders" ON ticket_orders;
CREATE POLICY "Public access for ticket_orders" ON ticket_orders FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert initial sample event if table is empty
-- INSERT INTO events (event_name, year, individual_ticket_price, family_ticket_price, square_fee, square_fee_percentage, is_active)
-- SELECT 'Annual Gala & Benefit', 2026, 45.00, 150.00, 0.30, 2.90, true
-- WHERE NOT EXISTS (SELECT 1 FROM events);
