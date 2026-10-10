import React, { useState, useEffect, useRef } from 'react';
import MemberProfile from './components/MemberProfile';
import CreateEvent from './components/CreateEvent';
import Tickets from './components/Tickets';
import SupabaseConfigModal from './components/SupabaseConfigModal';
import EventReportModal from './components/EventReportModal';
import { supabase, getSupabaseStatus } from './supabaseClient';
import {
  CalendarDays,
  Database,
  Layers,
  Sparkles,
  Ticket,
  UserCheck,
  Building,
  FileSpreadsheet,
} from 'lucide-react';
import './App.css';

const SAVED_EVENT_KEY = 'shanthi_selected_event_id';

export default function App() {
  const memberProfileRef = useRef(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [benefactorName, setBenefactorName] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'profile', 'tickets'

  // Global event state hoisted to top of page with persistent selection
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(() => {
    return localStorage.getItem(SAVED_EVENT_KEY) || '';
  });

  const supabaseStatus = getSupabaseStatus();

  // Fetch events from Supabase and ensure selected event remains selected
  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching events from Supabase:', error.message);
      } else if (data && data.length > 0) {
        setEvents(data);
        const storedId = localStorage.getItem(SAVED_EVENT_KEY);
        // If an event was selected and still exists in DB, KEEP it selected!
        if (storedId && data.some((e) => e.id === storedId)) {
          setSelectedEventId(storedId);
        } else if (data.length === 1) {
          // If only 1 event exists in database, select it by default
          setSelectedEventId(data[0].id);
          localStorage.setItem(SAVED_EVENT_KEY, data[0].id);
        } else if (storedId && !data.some((e) => e.id === storedId)) {
          // Stored event was deleted from DB
          setSelectedEventId('');
          localStorage.removeItem(SAVED_EVENT_KEY);
        }
      } else {
        setEvents([]);
        setSelectedEventId('');
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSelectEvent = (id) => {
    setSelectedEventId(id);
    if (id) {
      localStorage.setItem(SAVED_EVENT_KEY, id);
    } else {
      localStorage.removeItem(SAVED_EVENT_KEY);
    }
  };

  const handleBenefactorNameChange = (name) => {
    setBenefactorName(name || '');
  };

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    if (member && member.member1) {
      setBenefactorName(member.member1);
    } else if (!member) {
      setBenefactorName('');
    }
    // Smoothly scroll to tickets if appropriate
    const ticketSection = document.getElementById('tickets-section');
    if (ticketSection && activeTab === 'all') {
      ticketSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSaveBenefactor = async () => {
    if (memberProfileRef.current && memberProfileRef.current.saveProfile) {
      return await memberProfileRef.current.saveProfile();
    }
    if (selectedMember && selectedMember.id) {
      return { data: selectedMember };
    }
    return { error: 'Please enter benefactor information.' };
  };

  const handleEventCreated = (newEvent) => {
    fetchEvents();
    // If a new event was created and none is selected, select it
    if (newEvent && newEvent.id && !selectedEventId) {
      handleSelectEvent(newEvent.id);
    }
  };

  const currentEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="nav-brand">
            <div className="brand-logo">
              <Building className="brand-icon" />
            </div>
            <div>
              <h1 className="brand-title">Shanthi Event & Benefactor Portal</h1>
              <p className="brand-subtitle">
                Shanthi • Event Registration & Ticketing
              </p>
            </div>
          </div>

          <div className="nav-center-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'all' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Layers className="icon-xs" /> All-in-One Dashboard
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'profile' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <UserCheck className="icon-xs" /> Benefactor
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'tickets' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('tickets')}
            >
              <Ticket className="icon-xs" /> Tickets &amp; Checkout
            </button>
          </div>

          <div className="nav-actions">
            {/* Supabase Connection Status Pill */}
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className={`db-status-pill ${supabaseStatus.isConfigured ? 'status-connected' : 'status-mock'
                }`}
              title="Click to configure Supabase URL & Key or view SQL"
            >
              <Database className="icon-xs" />
              <span>
                {supabaseStatus.isConfigured ? 'Supabase Connected' : 'Supabase (Demo/Setup)'}
              </span>
            </button>

            {/* Event Attendance & Financial Report Button */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="btn-navbar-report"
              title="Generate downloadable CSV report of event benefactors and financial totals"
            >
              <FileSpreadsheet className="icon-xs" />
              <span>Event Report &amp; CSV</span>
            </button>

            {/* Modular Create Event Button */}
            <CreateEvent onEventCreated={handleEventCreated} />
          </div>
        </div>
      </header>

      {/* Prominent Active Event Bar at the Top of the Page */}
      <div className="top-event-bar">
        <div className="top-event-container">
          <div className="top-event-left">
            <div className="top-event-icon-badge">
              <CalendarDays className="top-event-icon" />
            </div>
            <div className="top-event-select-group">
              <label htmlFor="top-event-select" className="top-event-label">
                Active Event:
              </label>
              <select
                id="top-event-select"
                value={selectedEventId}
                onChange={(e) => handleSelectEvent(e.target.value)}
                className={`top-event-dropdown ${!selectedEventId ? 'top-event-unselected' : ''}`}
                aria-label="Select active event"
              >
                {events.length > 1 && (
                  <option value="">-- Please Select an Event ({events.length} available) --</option>
                )}
                {events.length === 0 && (
                  <option value="">
                    {loadingEvents ? 'Loading events from database...' : 'No events in database. Click "Create Event" to add one.'}
                  </option>
                )}
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.event_name} ({evt.year}) — Ind: ${Number(evt.individual_ticket_price).toFixed(2)}, Fam: ${Number(evt.family_ticket_price).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentEvent ? (
            <div className="top-event-details">
              <span className="top-event-chip">
                <strong>Year:</strong> {currentEvent.year}
              </span>
              <span className="top-event-chip">
                <strong>Ind Ticket:</strong> ${Number(currentEvent.individual_ticket_price || 0).toFixed(2)}
              </span>
              <span className="top-event-chip">
                <strong>Family of 4:</strong> ${Number(currentEvent.family_ticket_price || 0).toFixed(2)}
              </span>
              <span className="top-event-chip chip-fee">
                <strong>Square Fee:</strong>{' '}
                {currentEvent.square_fee_percentage > 0 ? `${currentEvent.square_fee_percentage}%` : ''}
                {currentEvent.square_fee_percentage > 0 && currentEvent.square_fee > 0 ? ' + ' : ''}
                {currentEvent.square_fee > 0 ? `${Math.round(currentEvent.square_fee * 100)}¢` : ''}
                {!currentEvent.square_fee_percentage && !currentEvent.square_fee ? '$0.00' : ''} / txn
              </span>
              <span className="top-event-chip chip-status">
                Active
              </span>
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="btn-top-bar-report"
                title="Generate downloadable CSV report of event benefactors, fees, and money after fees"
              >
                <FileSpreadsheet className="icon-xs" />
                <span>Generate Report &amp; CSV</span>
              </button>
            </div>
          ) : (
            <div className="top-event-prompt">
              <Sparkles className="icon-xs text-amber" />
              <span>Select an event above to enable ticketing and pricing across the portal</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'all' ? (
          <div className="dashboard-grid">
            <div className="dashboard-col left-col">
              <MemberProfile
                ref={memberProfileRef}
                onSelectMember={handleMemberSelect}
                selectedMemberId={selectedMember ? selectedMember.id : null}
                onBenefactorNameChange={handleBenefactorNameChange}
              />
            </div>
            <div className="dashboard-col right-col">
              <Tickets
                selectedMember={selectedMember}
                benefactorName={benefactorName}
                onSaveBenefactor={handleSaveBenefactor}
                events={events}
                selectedEventId={selectedEventId}
                onEventRefreshed={handleEventCreated}
                loadingEvents={loadingEvents}
                onOpenReport={() => setShowReportModal(true)}
              />
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          <div className="single-view-container">
            <MemberProfile
              ref={memberProfileRef}
              onSelectMember={handleMemberSelect}
              selectedMemberId={selectedMember ? selectedMember.id : null}
              onBenefactorNameChange={handleBenefactorNameChange}
            />
          </div>
        ) : (
          <div className="single-view-container">
            <Tickets
              selectedMember={selectedMember}
              benefactorName={benefactorName}
              onSaveBenefactor={handleSaveBenefactor}
              events={events}
              selectedEventId={selectedEventId}
              onEventRefreshed={handleEventCreated}
              loadingEvents={loadingEvents}
              onOpenReport={() => setShowReportModal(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>
            Shanthi Event Application
          </p>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="footer-link"
          >
            Database Settings &amp; SQL Schema
          </button>
        </div>
      </footer>

      {/* Database Setup & Settings Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />

      {/* Event Benefactor Attendance & Financial CSV Report Modal */}
      <EventReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        events={events}
        selectedEventId={selectedEventId}
      />
    </div>
  );
}
