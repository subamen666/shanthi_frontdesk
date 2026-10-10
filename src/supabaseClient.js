import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite environment variables or localStorage override
const getCredentials = () => {
  const localUrl = localStorage.getItem('nsgw_supabase_url');
  const localKey = localStorage.getItem('nsgw_supabase_key');

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = localUrl || (envUrl && envUrl !== 'https://your-project-ref.supabase.co' ? envUrl : '');
  const key = localKey || (envKey && envKey !== 'your-anon-key-here' ? envKey : '');

  return { url, key };
};

export const saveSupabaseCredentials = (url, key) => {
  if (url && key) {
    localStorage.setItem('nsgw_supabase_url', url.trim());
    localStorage.setItem('nsgw_supabase_key', key.trim());
    window.location.reload();
  }
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('nsgw_supabase_url');
  localStorage.removeItem('nsgw_supabase_key');
  window.location.reload();
};

const { url: supabaseUrl, key: supabaseAnonKey } = getCredentials();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Fallback Local Storage Mock Store when real Supabase is not configured yet
const LOCAL_STORAGE_MEMBERS_KEY = 'nsgw_mock_members';
const LOCAL_STORAGE_EVENTS_KEY = 'nsgw_mock_events';
const LOCAL_STORAGE_ORDERS_KEY = 'nsgw_mock_orders';

const getInitialEvents = () => [
  {
    id: 'evt-1',
    event_name: 'NSGW Annual Heritage Dinner',
    year: 2026,
    individual_ticket_price: 50.0,
    family_ticket_price: 160.0,
    square_fee: 0.30,
    square_fee_percentage: 2.9,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    event_name: 'Spring Charity Gala',
    year: 2026,
    individual_ticket_price: 65.0,
    family_ticket_price: 200.0,
    square_fee: 0.30,
    square_fee_percentage: 2.9,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const getInitialMembers = () => [
  {
    id: 'mem-101',
    member1: 'Robert Sterling',
    member2: 'Claire Sterling',
    address: '450 California St, San Francisco, CA 94104',
    phone1: '(415) 555-0144',
    phone2: '(415) 555-0145',
    email1: 'rsterling@example.org',
    email2: 'csterling@example.org',
    notification_preference: 'Email',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'mem-102',
    member1: 'Marcus Vance',
    member2: 'Elena Vance',
    address: '782 Sutter St, San Francisco, CA 94109',
    phone1: '(415) 555-0192',
    phone2: '(415) 555-0193',
    email1: 'mvance@example.org',
    email2: 'evance@example.org',
    notification_preference: 'SMS / Text Message',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Initialize mock storage if empty
try {
  const existingEvents = JSON.parse(localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY) || '[]');
  if (!Array.isArray(existingEvents) || existingEvents.length === 0) {
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(getInitialEvents()));
  }
} catch (e) {
  localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(getInitialEvents()));
}

try {
  const existingMembers = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY) || '[]');
  if (!Array.isArray(existingMembers) || existingMembers.length === 0) {
    localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(getInitialMembers()));
  }
} catch (e) {
  localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(getInitialMembers()));
}

const getInitialOrders = () => [
  {
    id: 'ord-1001',
    event_id: 'evt-1',
    event_name: 'NSGW Annual Heritage Dinner',
    member_id: 'mem-101',
    member_name: 'Robert Sterling & Claire Sterling',
    individual_qty: 2,
    family_qty: 1,
    subtotal: 260.0,
    square_fee: 7.84,
    total: 252.16,
    payment_status: 'Square',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'ord-1002',
    event_id: 'evt-1',
    event_name: 'NSGW Annual Heritage Dinner',
    member_id: 'mem-102',
    member_name: 'Marcus Vance & Elena Vance',
    individual_qty: 1,
    family_qty: 0,
    subtotal: 50.0,
    square_fee: 0.0,
    total: 50.0,
    payment_status: 'Zelle',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

try {
  const existingOrders = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY) || '[]');
  if (!Array.isArray(existingOrders) || existingOrders.length === 0) {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(getInitialOrders()));
  }
} catch (e) {
  localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(getInitialOrders()));
}

// Create real client or fallback mock client
let clientInstance = null;

if (isSupabaseConfigured) {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Error creating Supabase client:', err);
  }
}

// Emulate client interface for seamless demo/fallback operation if unconfigured
export const supabase = clientInstance || {
  isMock: true,
  from(tableName) {
    return {
      select(columns = '*') {
        const createQueryChain = (filterFn = null, orderCol = null, ascending = true, limitCount = null) => {
          return {
            eq(col, val) {
              const newFilter = (row) => (filterFn ? filterFn(row) : true) && String(row[col]) === String(val);
              return createQueryChain(newFilter, orderCol, ascending, limitCount);
            },
            order(col, { ascending: asc = true } = {}) {
              return createQueryChain(filterFn, col, asc, limitCount);
            },
            limit(count) {
              return createQueryChain(filterFn, orderCol, ascending, count);
            },
            async then(resolve) {
              const key = `nsgw_mock_${tableName}`;
              let data = JSON.parse(localStorage.getItem(key) || '[]');
              if (filterFn) {
                data = data.filter(filterFn);
              }
              if (orderCol) {
                data.sort((a, b) => {
                  const valA = a[orderCol];
                  const valB = b[orderCol];
                  if (valA < valB) return ascending ? -1 : 1;
                  if (valA > valB) return ascending ? 1 : -1;
                  return 0;
                });
              }
              if (limitCount !== null) {
                data = data.slice(0, limitCount);
              }
              resolve({ data, error: null });
            },
          };
        };

        return createQueryChain();
      },
      async insert(rows) {
        const key = `nsgw_mock_${tableName}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const toInsert = Array.isArray(rows) ? rows : [rows];
        const newRows = toInsert.map((item) => ({
          id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          created_at: new Date().toISOString(),
          ...item,
        }));
        const updated = [...newRows, ...current];
        localStorage.setItem(key, JSON.stringify(updated));
        return { data: newRows, error: null };
      },
      update(updates) {
        return {
          eq(column, value) {
            return {
              select() {
                return {
                  async then(resolve) {
                    const key = `nsgw_mock_${tableName}`;
                    const current = JSON.parse(localStorage.getItem(key) || '[]');
                    let updatedRow = null;
                    const updated = current.map((row) => {
                      if (String(row[column]) === String(value)) {
                        updatedRow = { ...row, ...updates };
                        return updatedRow;
                      }
                      return row;
                    });
                    localStorage.setItem(key, JSON.stringify(updated));
                    resolve({ data: updatedRow ? [updatedRow] : [], error: null });
                  },
                };
              },
              async then(resolve) {
                const key = `nsgw_mock_${tableName}`;
                const current = JSON.parse(localStorage.getItem(key) || '[]');
                let updatedRow = null;
                const updated = current.map((row) => {
                  if (String(row[column]) === String(value)) {
                    updatedRow = { ...row, ...updates };
                    return updatedRow;
                  }
                  return row;
                });
                localStorage.setItem(key, JSON.stringify(updated));
                resolve({ data: updatedRow ? [updatedRow] : [], error: null });
              },
            };
          },
        };
      },
    };
  },
};

export const getSupabaseStatus = () => {
  return {
    isConfigured: isSupabaseConfigured,
    url: supabaseUrl || '',
    isMock: !isSupabaseConfigured || Boolean(supabase.isMock),
  };
};
