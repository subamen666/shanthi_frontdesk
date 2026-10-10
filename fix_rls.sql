-- FIX ROW LEVEL SECURITY (RLS) FOR NSGW EVENT APP
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Paste & Run

-- 1. Enable RLS and grant full public access to members table
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access for members" ON members;
DROP POLICY IF EXISTS "Public members" ON members;
DROP POLICY IF EXISTS "Enable read access for all users" ON members;
DROP POLICY IF EXISTS "Enable insert for all users" ON members;

CREATE POLICY "Public access for members"
ON members
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 2. Grant full public access to events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access for events" ON events;
DROP POLICY IF EXISTS "Public events" ON events;

CREATE POLICY "Public access for events"
ON events
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 3. Grant full public access to ticket_orders table
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access for ticket_orders" ON ticket_orders;
DROP POLICY IF EXISTS "Public ticket_orders" ON ticket_orders;

CREATE POLICY "Public access for ticket_orders"
ON ticket_orders
FOR ALL
TO public
USING (true)
WITH CHECK (true);
