import React, { useState } from 'react';
import {
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  getSupabaseStatus,
} from '../supabaseClient';
import { Database, Key, Globe, Check, Copy, X, Server, AlertCircle } from 'lucide-react';

export default function SupabaseConfigModal({ isOpen, onClose }) {
  const status = getSupabaseStatus();
  const [url, setUrl] = useState(localStorage.getItem('Shanthi_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [key, setKey] = useState(localStorage.getItem('Shanthi_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!url || !key) {
      alert('Please provide both Supabase URL and Anon Key.');
      return;
    }
    saveSupabaseCredentials(url, key);
  };

  const handleReset = () => {
    if (confirm('Clear custom Supabase configuration and revert to default?')) {
      clearSupabaseCredentials();
    }
  };

  const copySqlSchema = () => {
    const sql = `-- Shanthi Event App - Supabase Database Schema
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member1 TEXT NOT NULL,
  member2 TEXT,
  address TEXT,
  phone1 TEXT,
  phone2 TEXT,
  email1 TEXT,
  email2 TEXT,
  notification_preference TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  individual_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  family_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  square_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  square_fee_percentage NUMERIC(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
  payment_status TEXT DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe migrations in case table already existed
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS square_fee NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public ticket_orders" ON ticket_orders FOR ALL USING (true) WITH CHECK (true);
`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Database className="icon-title text-indigo" />
            <div>
              <h3 className="modal-title">Supabase Database Connection</h3>
              <p className="modal-desc">
                Configure your Supabase project keys or run the SQL schema
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-close">
            <X className="icon-sm" />
          </button>
        </div>

        <div className="config-status-banner">
          <Server className="icon-inline" />
          <div>
            <strong>Status: </strong>
            {status.isConfigured ? (
              <span className="text-emerald font-semibold">
                Connected to Supabase ({status.url})
              </span>
            ) : (
              <span className="text-amber font-semibold">
                Running in Local Fallback Mode (Ready to connect)
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              <Globe className="icon-inline" /> Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Key className="icon-inline" /> Anon / Public API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="form-input"
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={copySqlSchema}
              className="btn-secondary"
            >
              {copied ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
              {copied ? 'SQL Schema Copied!' : 'Copy SQL Schema'}
            </button>

            {status.isConfigured && (
              <button
                type="button"
                onClick={handleReset}
                className="btn-danger"
              >
                Disconnect
              </button>
            )}

            <button type="submit" className="btn-primary">
              Save & Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
