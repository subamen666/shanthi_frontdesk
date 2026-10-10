import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../supabaseClient';
import {
  User,
  Users,
  MapPin,
  Phone,
  Mail,
  Bell,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Search,
  X,
  Edit3,
  UserPlus,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

const NOTIFICATION_OPTIONS = [
  'Email',
  'Postal',
];

const MemberProfile = forwardRef(function MemberProfile(
  { onSelectMember, selectedMemberId, onBenefactorNameChange },
  ref
) {
  // Form State
  const [formData, setFormData] = useState({
    member1: '',
    member2: '',
    address: '',
    phone1: '',
    phone2: '',
    email1: '',
    email2: '',
    notificationPreferences: [],
  });

  // Track if we are editing an existing benefactor loaded from search
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [loadedMemberName, setLoadedMemberName] = useState('');
  const [originalNotificationPref, setOriginalNotificationPref] = useState('');

  // Search States
  const [benefactorSearchTerm, setBenefactorSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchWrapperRef = useRef(null);

  // General Component States
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [message, setMessage] = useState(null);
  const [savedMembers, setSavedMembers] = useState([]);
  const [copiedRls, setCopiedRls] = useState(false);

  const copyRlsSql = () => {
    const sql = `ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for members" ON members;
CREATE POLICY "Public access for members" ON members FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for events" ON events;
CREATE POLICY "Public access for events" ON events FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for ticket_orders" ON ticket_orders;
CREATE POLICY "Public access for ticket_orders" ON ticket_orders FOR ALL TO public USING (true) WITH CHECK (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedRls(true);
    setTimeout(() => setCopiedRls(false), 2500);
  };

  // Normalize phone digits for resilient search
  const cleanDigits = (val) => (val ? String(val).replace(/\D/g, '') : '');

  // Parse notification preferences string into array
  const parsePreferences = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    return parts;
  };

  // Fetch all members from Supabase
  const loadMembers = async () => {
    setFetchingMembers(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching members from Supabase:', error.message);
        setMessage({
          type: 'error',
          text: `Supabase members query notice: ${error.message}. Please run fix_rls.sql if RLS is enabled.`,
        });
      } else if (data) {
        setSavedMembers(data);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setFetchingMembers(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Actively execute search directly querying Supabase
  const executeSearch = async (termToUse = benefactorSearchTerm) => {
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setSearchError(`Database query error: ${error.message}`);
      } else if (data) {
        setSavedMembers(data);
      }
    } catch (err) {
      setSearchError(`Search query failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  // Filter members matching search query across member1, member2, phone1, phone2, email1, email2
  const searchResults = useMemo(() => {
    const term = benefactorSearchTerm.trim().toLowerCase();
    if (!term) return [];

    const digits = cleanDigits(term);

    return savedMembers.filter((member) => {
      const isTextMatch = (val) => val && String(val).toLowerCase().includes(term);

      const isPhoneMatch = (phoneVal) => {
        if (!phoneVal) return false;
        const phoneStr = String(phoneVal).toLowerCase();
        if (phoneStr.includes(term)) return true;
        if (digits.length >= 3 && cleanDigits(phoneVal).includes(digits)) return true;
        return false;
      };

      return (
        isTextMatch(member.member1) ||
        isTextMatch(member.member2) ||
        isPhoneMatch(member.phone1) ||
        isPhoneMatch(member.phone2) ||
        isTextMatch(member.email1) ||
        isTextMatch(member.email2)
      );
    });
  }, [benefactorSearchTerm, savedMembers]);

  // Quick 1-click test data seeder to help user verify search immediately
  const handleInsertSampleMembers = async () => {
    setLoading(true);
    try {
      const sample1 = {
        member1: 'Robert Sterling',
        member2: 'Claire Sterling',
        address: '450 California St, San Francisco, CA 94104',
        phone1: '(415) 555-0144',
        phone2: '(415) 555-0145',
        email1: 'rsterling@example.org',
        email2: 'csterling@example.org',
        notification_preference: 'Email, SMS / Text Message',
      };
      const sample2 = {
        member1: 'Marcus Vance',
        member2: 'Elena Vance',
        address: '782 Sutter St, San Francisco, CA 94109',
        phone1: '(415) 555-0192',
        phone2: '(415) 555-0193',
        email1: 'mvance@example.org',
        email2: 'evance@example.org',
        notification_preference: 'Phone Call',
      };

      await supabase.from('members').insert([sample1, sample2]);
      await loadMembers();
      setMessage({
        type: 'success',
        text: 'Added 2 sample benefactors to test search & notification preferences!',
      });
    } catch (err) {
      console.error('Error inserting samples:', err);
    } finally {
      setLoading(false);
    }
  };

  // Populate form with selected benefactor data
  const handleSelectAndPopulate = (member) => {
    const rawPref = member.notification_preference || '';

    setFormData({
      member1: member.member1 || '',
      member2: member.member2 || '',
      address: member.address || '',
      phone1: member.phone1 || '',
      phone2: member.phone2 || '',
      email1: member.email1 || '',
      email2: member.email2 || '',
      notificationPreferences: parsePreferences(rawPref),
    });

    setEditingMemberId(member.id);
    setLoadedMemberName(member.member1 + (member.member2 ? ` & ${member.member2}` : ''));
    setOriginalNotificationPref(rawPref);
    setBenefactorSearchTerm(member.member1);
    setIsDropdownOpen(false);

    setMessage({
      type: 'success',
      text: `Selected "${member.member1}". Benefactor information populated. Existing preference: "${rawPref || 'None'}". Any changes will overwrite on save.`,
    });

    // Notify parent to select this member for ticket purchasing too
    if (onSelectMember) {
      onSelectMember(member);
    }
    if (onBenefactorNameChange) {
      onBenefactorNameChange(member.member1 || '');
    }

    // Scroll to form smoothly
    const formEl = document.getElementById('benefactor-entry-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Reset/Clear Form back to blank state
  const handleClearForm = () => {
    setFormData({
      member1: '',
      member2: '',
      address: '',
      phone1: '',
      phone2: '',
      email1: '',
      email2: '',
      notificationPreferences: [],
    });
    setEditingMemberId(null);
    setLoadedMemberName('');
    setOriginalNotificationPref('');
    setBenefactorSearchTerm('');
    setIsDropdownOpen(false);
    setMessage(null);
    if (onBenefactorNameChange) {
      onBenefactorNameChange('');
    }
    if (onSelectMember) {
      onSelectMember(null);
    }
  };

  // Toggle multi-select notification preference
  const toggleNotificationPreference = (option) => {
    setFormData((prev) => {
      const exists = prev.notificationPreferences.includes(option);
      const updated = exists
        ? prev.notificationPreferences.filter((item) => item !== option)
        : [...prev.notificationPreferences, option];
      return {
        ...prev,
        notificationPreferences: updated,
      };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'member1' && onBenefactorNameChange) {
      onBenefactorNameChange(value);
    }
  };

  // Save changes - ALWAYS overwrite notification_preference with current selection
  const performSave = async (forceCreateNew = false) => {
    setMessage(null);

    const name = formData.member1.trim();
    if (!name) {
      setMessage({ type: 'error', text: 'Benefactor Name (member1) is required.' });
      return { error: 'Benefactor Name (member1) is required.' };
    }

    setLoading(true);

    try {
      // Formatted preference string from current user selection
      const updatedPrefString = formData.notificationPreferences.join(', ');

      const payload = {
        member1: name,
        member2: formData.member2.trim() || null,
        address: formData.address.trim() || null,
        phone1: formData.phone1.trim() || null,
        phone2: formData.phone2.trim() || null,
        email1: formData.email1.trim() || null,
        email2: formData.email2.trim() || null,
        // ALWAYS overwrite notification preference with the selection made
        notification_preference: updatedPrefString || null,
      };

      let savedRecord = null;

      if (editingMemberId && !forceCreateNew) {
        // UPDATE existing row in Supabase - explicitly overwriting notification_preference
        const { data, error } = await supabase
          .from('members')
          .update(payload)
          .eq('id', editingMemberId)
          .select();

        if (error) {
          if (error.code === '42501') {
            throw new Error('Supabase Row Level Security (RLS) blocked update. Please run fix_rls.sql in Supabase SQL editor.');
          }
          throw error;
        }

        savedRecord = data && data[0] ? data[0] : { ...payload, id: editingMemberId };

        setMessage({
          type: 'success',
          text: `Benefactor profile for "${name}" updated! Notification preference overwritten with "${updatedPrefString || 'None'}".`,
        });

        // Update tracking
        setOriginalNotificationPref(updatedPrefString);
      } else {
        // INSERT new row in Supabase
        const { data, error } = await supabase
          .from('members')
          .insert([payload])
          .select();

        if (error) {
          if (error.code === '42501') {
            throw new Error('Supabase Row Level Security (RLS) blocked insert. Please run fix_rls.sql in Supabase SQL editor.');
          }
          throw error;
        }

        savedRecord = data && data[0] ? data[0] : { ...payload, id: `new-${Date.now()}` };

        setMessage({
          type: 'success',
          text: `Benefactor profile for "${name}" created with preference: "${updatedPrefString || 'None'}"!`,
        });
      }

      // Reload member list from database to reflect changes immediately
      await loadMembers();

      // If callback provided, notify parent
      if (savedRecord && onSelectMember) {
        onSelectMember(savedRecord);
      }
      if (savedRecord && onBenefactorNameChange) {
        onBenefactorNameChange(savedRecord.member1);
      }

      // Update current loaded member tracking
      if (savedRecord) {
        setEditingMemberId(savedRecord.id);
        setLoadedMemberName(savedRecord.member1 + (savedRecord.member2 ? ` & ${savedRecord.member2}` : ''));
      }

      return { data: savedRecord };
    } catch (error) {
      console.error('Save member error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to save member information to Supabase.',
      });
      return { error: error.message || 'Failed to save member information to Supabase.' };
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e, forceCreateNew = false) => {
    if (e && e.preventDefault) e.preventDefault();
    await performSave(forceCreateNew);
  };

  // Expose saveProfile imperative method to parent via ref
  useImperativeHandle(ref, () => ({
    saveProfile: async () => {
      return await performSave();
    },
    getFormData: () => formData,
  }));

  return (
    <div className="section-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <User className="icon-title" /> Benefactor Information
          </h2>
        </div>
        <button
          type="button"
          onClick={loadMembers}
          className="btn-refresh"
          title="Refresh members from database"
          disabled={fetchingMembers}
        >
          <RefreshCw className={`icon-sm ${fetchingMembers ? 'spin' : ''}`} />
          {fetchingMembers ? 'Refreshing...' : 'Sync with DB'}
        </button>
      </div>

      {/* Benefactor Search Section */}
      <div className="benefactor-search-panel">
        <div className="search-panel-header">

        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchResults.length > 0) {
              handleSelectAndPopulate(searchResults[0]);
            } else {
              executeSearch();
            }
          }}
          className="search-form-row"
        >
          <div className="search-input-wrapper" ref={searchWrapperRef}>
            <Search className="search-icon-inside" />
            <input
              id="benefactor-search-input"
              type="text"
              value={benefactorSearchTerm}
              onChange={(e) => {
                setBenefactorSearchTerm(e.target.value);
                setIsDropdownOpen(true);
                setHasSearched(true);
              }}
              onFocus={() => {
                if (benefactorSearchTerm.trim().length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              placeholder="Search by Benefactor Name, Spouse, Phone, or Email..."
              className="search-input-large"
              autoComplete="off"
            />
            {benefactorSearchTerm && (
              <button
                type="button"
                onClick={() => {
                  setBenefactorSearchTerm('');
                  setIsDropdownOpen(false);
                  setHasSearched(false);
                }}
                className="btn-clear-search"
                title="Clear search"
              >
                <X className="icon-xs" />
              </button>
            )}

            {/* Dropdown Menu - Selecting the name directly populates the form (no button needed) */}
            {isDropdownOpen && benefactorSearchTerm.trim().length > 0 && (
              <div className="search-dropdown-menu">
                <div className="search-dropdown-header">
                  <span>
                    Matching Benefactors ({searchResults.length})
                  </span>
                  <span className="dropdown-hint">Click name to populate form</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="dropdown-empty-state">
                    <AlertCircle className="icon-xs text-amber" />
                    <span>No benefactor found matching &ldquo;{benefactorSearchTerm}&rdquo;</span>
                  </div>
                ) : (
                  <div className="dropdown-list-items">
                    {searchResults.map((member) => (
                      <div
                        key={member.id}
                        className={`dropdown-item ${editingMemberId === member.id ? 'dropdown-item-active' : ''}`}
                        onClick={() => handleSelectAndPopulate(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectAndPopulate(member);
                          }
                        }}
                      >
                        <div className="dropdown-item-left">
                          <div className="dropdown-item-name-row">
                            <span className="dropdown-name">{member.member1}</span>
                            {member.member2 && (
                              <span className="dropdown-spouse"> &amp; {member.member2}</span>
                            )}
                            {editingMemberId === member.id && (
                              <span className="badge badge-editing">Loaded</span>
                            )}
                          </div>

                          <div className="dropdown-item-sub-row">
                            {(member.phone1 || member.phone2) && (
                              <span className="sub-item">📞 {member.phone1 || member.phone2}</span>
                            )}
                            {(member.email1 || member.email2) && (
                              <span className="sub-item">📧 {member.email1 || member.email2}</span>
                            )}
                            {member.address && (
                              <span className="sub-item">📍 {member.address}</span>
                            )}
                          </div>
                        </div>

                        <div className="dropdown-item-select-hint">
                          <span className="select-hint-text">Select</span>
                          <CheckCircle className={`icon-xs ${editingMemberId === member.id ? 'text-emerald' : 'text-indigo'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-search-action"
            disabled={searching}
          >
            <Search className={`icon-xs ${searching ? 'spin' : ''}`} />
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Database state notice / RLS Diagnostic & Fix button */}
        {savedMembers.length === 0 ? (
          <div className="empty-db-hint rls-diagnostic-card">
            <div className="rls-diag-header">
              <AlertCircle className="icon-inline text-amber" />
              <strong>Have records in your Supabase Dashboard, but seeing 0 records here?</strong>
            </div>
            <p className="rls-diag-body">
              This happens because PostgreSQL <strong>Row Level Security (RLS)</strong> is enabled on your <code>members</code> table, which blocks anonymous web apps from reading records until a public policy is added.
            </p>
            <div className="rls-diag-actions">
              <button
                type="button"
                onClick={copyRlsSql}
                className="btn-rls-action"
              >
                {copiedRls ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
                {copiedRls ? 'RLS Fix SQL Copied!' : 'Copy 1-Click RLS Fix SQL'}
              </button>
              <button
                type="button"
                onClick={handleInsertSampleMembers}
                className="btn-secondary"
                disabled={loading}
              >
                <Sparkles className="icon-xs" /> Insert Sample Benefactors
              </button>
              <span className="rls-diag-hint">
                Paste into your Supabase <strong>SQL Editor</strong> &amp; click Run. Then click <strong>Sync with DB</strong> above.
              </span>
            </div>
          </div>
        ) : (
          <div className="search-quick-chips">
            {/* <span className="quick-chips-label">Quick select:</span>
            {savedMembers.slice(0, 3).map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip-btn"
                onClick={() => handleSelectAndPopulate(m)}
                title={`Select and populate form with ${m.member1}`}
              >
                🔍 "{m.member1}"
              </button>
            ))} */}
            {benefactorSearchTerm && (
              <button
                type="button"
                className="chip-btn chip-btn-clear"
                onClick={() => {
                  setBenefactorSearchTerm('');
                  setIsDropdownOpen(false);
                }}
              >
                ✕ Clear Search
              </button>
            )}
          </div>
        )}

        {searchError && (
          <div className="alert-box alert-error">
            <AlertCircle className="icon-alert" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Loaded Profile Active Banner */}
      {editingMemberId && (
        <div className="loaded-profile-banner">
          <div className="loaded-profile-left">
            <UserCheck className="icon-inline text-emerald" />
            <div>
              <span className="loaded-profile-title">
                Loaded: <strong>{loadedMemberName}</strong> • DB Pref: <strong className="text-emerald">"{originalNotificationPref || 'None'}"</strong> (overwritten on save)
              </span>
            </div>
          </div>
          <div className="loaded-profile-actions">
            <button
              type="button"
              onClick={handleClearForm}
              className="btn-clear-loaded"
            >
              <UserPlus className="icon-xs" />
              Clear &amp; New Benefactor
            </button>
          </div>
        </div>
      )}

      {/* Success / Error Message */}
      {message && (
        <div className={`alert-box ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message.type === 'error' ? (
            <AlertCircle className="icon-alert" />
          ) : (
            <CheckCircle className="icon-alert" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Benefactor Information Form */}
      <form id="benefactor-entry-form" onSubmit={(e) => handleSubmit(e, false)} className="member-form">
        <div className="form-grid">
          {/* Member 1: Benefactor Name */}
          <div className="form-group">
            <label htmlFor="member1" className="form-label">
              <User className="icon-inline" /> Benefactor Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="member1"
              name="member1"
              value={formData.member1}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          {/* Member 2: Spouse Name */}
          <div className="form-group">
            <label htmlFor="member2" className="form-label">
              <Users className="icon-inline" /> Benefactor Spouse Name
            </label>
            <input
              type="text"
              id="member2"
              name="member2"
              value={formData.member2}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Address */}
          <div className="form-group full-width">
            <label htmlFor="address" className="form-label">
              <MapPin className="icon-inline" /> Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Phone 1 */}
          <div className="form-group">
            <label htmlFor="phone1" className="form-label">
              <Phone className="icon-inline" /> Phone 1
            </label>
            <input
              type="tel"
              id="phone1"
              name="phone1"
              value={formData.phone1}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Phone 2 */}
          <div className="form-group">
            <label htmlFor="phone2" className="form-label">
              <Phone className="icon-inline" /> Phone 2
            </label>
            <input
              type="tel"
              id="phone2"
              name="phone2"
              value={formData.phone2}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Email 1 */}
          <div className="form-group">
            <label htmlFor="email1" className="form-label">
              <Mail className="icon-inline" /> Email 1
            </label>
            <input
              type="email"
              id="email1"
              name="email1"
              value={formData.email1}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Email 2 */}
          <div className="form-group">
            <label htmlFor="email2" className="form-label">
              <Mail className="icon-inline" /> Email 2
            </label>
            <input
              type="email"
              id="email2"
              name="email2"
              value={formData.email2}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Notification Preference (Multiple Selection & Always Overwrite) */}
          <div className="form-group full-width">
            <label className="form-label">
              <Bell className="icon-inline" /> Notification Preferences <span className="pref-multi-hint">(select all that apply)</span>
            </label>

            {/* Overwrite notification indicator when an existing benefactor is loaded */}
            {editingMemberId && (
              <div className="pref-overwrite-indicator">
                <span className="overwrite-label">Existing in DB:</span>
                <span className="badge badge-existing">{originalNotificationPref || 'None'}</span>
                <span className="overwrite-arrow">➔</span>
                <span className="overwrite-label">Will overwrite with:</span>
                <span className="badge badge-new">
                  {formData.notificationPreferences.join(', ') || 'None selected'}
                </span>
              </div>
            )}

            <div className="multi-pref-container">
              {NOTIFICATION_OPTIONS.map((opt) => {
                const isSelected = formData.notificationPreferences.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleNotificationPreference(opt)}
                    className={`pref-chip-btn ${isSelected ? 'pref-chip-active' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <span className="pref-chip-checkbox">
                      {isSelected ? <Check className="icon-xs" /> : null}
                    </span>
                    <span className="pref-chip-text">{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="pref-selected-summary">
              <span>
                Selection: <strong>{formData.notificationPreferences.join(', ') || 'None'}</strong>
                <span className="text-emerald font-semibold"> (Overwrites on save)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleClearForm}
            className="btn-secondary"
            disabled={loading}
          >
            Clear / Reset
          </button>

          {editingMemberId && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="btn-secondary"
              disabled={loading}
              title="Save these details as a new separate member row in Supabase"
            >
              <UserPlus className="icon-xs" />
              Save as New Benefactor
            </button>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              'Saving to Supabase...'
            ) : editingMemberId ? (
              <>
                <Edit3 className="icon-btn" />
                Update &amp; Overwrite Profile
              </>
            ) : (
              <>
                <UserCheck className="icon-btn" />
                Save Benefactor Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
});

export default MemberProfile;
