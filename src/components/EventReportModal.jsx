import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  FileSpreadsheet,
  Download,
  Printer,
  X,
  Users,
  DollarSign,
  CreditCard,
  Banknote,
  FileText,
  Zap,
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle,
  Building,
} from 'lucide-react';

export default function EventReportModal({
  isOpen,
  onClose,
  events = [],
  selectedEventId = '',
}) {
  const [reportEventId, setReportEventId] = useState(selectedEventId || '');
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Keep reportEventId in sync when selectedEventId changes from parent
  useEffect(() => {
    if (selectedEventId) {
      setReportEventId(selectedEventId);
    } else if (events.length > 0 && !reportEventId) {
      setReportEventId(events[0].id);
    }
  }, [selectedEventId, events]);

  // Fetch ticket orders and members from Supabase
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch ticket orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from('ticket_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersErr) {
        console.warn('Error fetching orders:', ordersErr);
        setError('Failed to fetch ticket orders from database: ' + ordersErr.message);
      } else {
        setOrders(ordersData || []);
      }

      // 2. Fetch members to enrich benefactor details (email, phone, address, spouse)
      const { data: membersData, error: membersErr } = await supabase
        .from('members')
        .select('*');

      if (!membersErr && membersData) {
        setMembers(membersData);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setError('Could not load report data from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Find active event details
  const currentEvent = useMemo(() => {
    if (!reportEventId || reportEventId === 'all') return null;
    return events.find((e) => String(e.id) === String(reportEventId)) || null;
  }, [reportEventId, events]);

  // Create member lookup maps
  const membersById = useMemo(() => {
    const map = new Map();
    members.forEach((m) => {
      if (m.id) map.set(String(m.id), m);
    });
    return map;
  }, [members]);

  const membersByName = useMemo(() => {
    const map = new Map();
    members.forEach((m) => {
      if (m.member1) map.set(m.member1.toLowerCase().trim(), m);
    });
    return map;
  }, [members]);

  // Filter orders by selected event
  const eventOrders = useMemo(() => {
    if (!reportEventId || reportEventId === 'all') {
      return orders;
    }
    return orders.filter((ord) => String(ord.event_id) === String(reportEventId));
  }, [orders, reportEventId]);

  // Filter by search term and payment filter
  const filteredOrders = useMemo(() => {
    return eventOrders.filter((ord) => {
      // Payment filter
      if (paymentFilter !== 'all') {
        const status = String(ord.payment_status || '').toLowerCase();
        if (status !== paymentFilter.toLowerCase()) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const memberName = String(ord.member_name || '').toLowerCase();
        const eventName = String(ord.event_name || '').toLowerCase();
        const id = String(ord.id || '').toLowerCase();
        return memberName.includes(term) || eventName.includes(term) || id.includes(term);
      }

      return true;
    });
  }, [eventOrders, searchTerm, paymentFilter]);

  // Aggregate financial metrics
  const totals = useMemo(() => {
    let grossTotal = 0;
    let feesPaid = 0;
    let netTotal = 0;
    let individualTickets = 0;
    let familyTickets = 0;

    eventOrders.forEach((ord) => {
      const gross = Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0);
      const fee = Number(ord.square_fee || 0);
      const net = Number(ord.total !== undefined && ord.total !== null ? ord.total : (gross - fee));

      grossTotal += gross;
      feesPaid += fee;
      netTotal += net;

      individualTickets += Number(ord.individual_qty || 0);
      familyTickets += Number(ord.family_qty || 0);
    });

    const headcount = individualTickets + (familyTickets * 4);

    return {
      benefactorsCount: eventOrders.length,
      individualTickets,
      familyTickets,
      headcount,
      grossTotal,
      feesPaid,
      netTotal,
    };
  }, [eventOrders]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const breakdown = {
      Square: { count: 0, gross: 0, fee: 0, net: 0 },
      Cash: { count: 0, gross: 0, fee: 0, net: 0 },
      Check: { count: 0, gross: 0, fee: 0, net: 0 },
      Zelle: { count: 0, gross: 0, fee: 0, net: 0 },
      Other: { count: 0, gross: 0, fee: 0, net: 0 },
    };

    eventOrders.forEach((ord) => {
      const mode = ord.payment_status || 'Other';
      const key = breakdown[mode] ? mode : 'Other';
      const gross = Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0);
      const fee = Number(ord.square_fee || 0);
      const net = Number(ord.total !== undefined && ord.total !== null ? ord.total : (gross - fee));

      breakdown[key].count += 1;
      breakdown[key].gross += gross;
      breakdown[key].fee += fee;
      breakdown[key].net += net;
    });

    return breakdown;
  }, [eventOrders]);

  // Helper to escape CSV text values
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Generate and trigger CSV file download
  const handleDownloadCsv = () => {
    const eventTitle = currentEvent
      ? `${currentEvent.event_name} (${currentEvent.year})`
      : reportEventId === 'all'
        ? 'All Events Combined'
        : 'Event Attendance Report';

    const now = new Date();
    const dateFormatted = now.toLocaleString();
    const fileDate = now.toISOString().slice(0, 10);

    const csvLines = [
      // Header Banner
      '"=========================================================================================="',
      '"NATIVE SONS OF THE GOLDEN WEST (NSGW) - EVENT ATTENDANCE & FINANCIAL REPORT"',
      '"=========================================================================================="',
      `"Event Name:",${escapeCsv(eventTitle)}`,
      `"Event Year:",${escapeCsv(currentEvent ? currentEvent.year : 'All Years')}`,
      `"Report Generated:",${escapeCsv(dateFormatted)}`,
      '""',
      '"------------------------------------------------------------------------------------------"',
      '"EXECUTIVE FINANCIAL SUMMARY"',
      '"------------------------------------------------------------------------------------------"',
      `"Total Benefactors / Orders Registered:",${totals.benefactorsCount}`,
      `"Total Estimated Attendees (Headcount):",${totals.headcount}`,
      `"Total Individual Tickets:",${totals.individualTickets}`,
      `"Total Family of 4 Tickets:",${totals.familyTickets}`,
      `"TOTAL MONEY COLLECTED (GROSS):","$"${totals.grossTotal.toFixed(2)}`,
      `"TOTAL PROCESSING FEES PAID:","$"${totals.feesPaid.toFixed(2)}`,
      `"TOTAL MONEY AFTER FEES (NET REVENUE):","$"${totals.netTotal.toFixed(2)}`,
      '""',
      '"------------------------------------------------------------------------------------------"',
      '"PAYMENT METHOD BREAKDOWN"',
      '"------------------------------------------------------------------------------------------"',
      '"Payment Method","Orders Count","Gross Collected ($)","Fees Paid ($)","Money After Fees ($)"',
      `"Square",${paymentBreakdown.Square.count},"${paymentBreakdown.Square.gross.toFixed(2)}","${paymentBreakdown.Square.fee.toFixed(2)}","${paymentBreakdown.Square.net.toFixed(2)}"`,
      `"Cash",${paymentBreakdown.Cash.count},"${paymentBreakdown.Cash.gross.toFixed(2)}","${paymentBreakdown.Cash.fee.toFixed(2)}","${paymentBreakdown.Cash.net.toFixed(2)}"`,
      `"Check",${paymentBreakdown.Check.count},"${paymentBreakdown.Check.gross.toFixed(2)}","${paymentBreakdown.Check.fee.toFixed(2)}","${paymentBreakdown.Check.net.toFixed(2)}"`,
      `"Zelle",${paymentBreakdown.Zelle.count},"${paymentBreakdown.Zelle.gross.toFixed(2)}","${paymentBreakdown.Zelle.fee.toFixed(2)}","${paymentBreakdown.Zelle.net.toFixed(2)}"`,
      '""',
      '"=========================================================================================="',
      '"DETAILED BENEFACTOR ATTENDANCE & TRANSACTION ROSTER"',
      '"=========================================================================================="',
      [
        '"Order ID"',
        '"Benefactor Name"',
        '"Spouse / Partner"',
        '"Email"',
        '"Phone"',
        '"Address"',
        '"Notification Preference"',
        '"Individual Tickets"',
        '"Family Tickets"',
        '"Total Attendees"',
        '"Payment Method"',
        '"Gross Collected ($)"',
        '"Fees Paid ($)"',
        '"Money After Fees ($)"',
        '"Date Recorded"',
      ].join(','),
    ];

    // Data rows
    eventOrders.forEach((ord) => {
      // Find matching member for rich profile details
      let member = null;
      if (ord.member_id) {
        member = membersById.get(String(ord.member_id));
      }
      if (!member && ord.member_name) {
        const firstPart = ord.member_name.split('&')[0].trim().toLowerCase();
        member = membersByName.get(firstPart);
      }

      const spouse = member?.member2 || '';
      const email = member?.email1 || member?.email2 || '';
      const phone = member?.phone1 || member?.phone2 || '';
      const address = member?.address || '';
      const pref = member?.notification_preference || '';

      const indQty = Number(ord.individual_qty || 0);
      const famQty = Number(ord.family_qty || 0);
      const attendees = indQty + (famQty * 4);

      const gross = Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0);
      const fee = Number(ord.square_fee || 0);
      const net = Number(ord.total !== undefined && ord.total !== null ? ord.total : (gross - fee));
      const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString() : '';

      csvLines.push(
        [
          escapeCsv(String(ord.id).slice(0, 8)),
          escapeCsv(ord.member_name || member?.member1 || 'General Attendee'),
          escapeCsv(spouse),
          escapeCsv(email),
          escapeCsv(phone),
          escapeCsv(address),
          escapeCsv(pref),
          indQty,
          famQty,
          attendees,
          escapeCsv(ord.payment_status || 'Paid'),
          `"${gross.toFixed(2)}"`,
          `"${fee.toFixed(2)}"`,
          `"${net.toFixed(2)}"`,
          escapeCsv(dateStr),
        ].join(',')
      );
    });

    // Summary Totals row at the bottom
    csvLines.push(
      [
        '"TOTALS"',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        totals.individualTickets,
        totals.familyTickets,
        totals.headcount,
        '""',
        `"${totals.grossTotal.toFixed(2)}"`,
        `"${totals.feesPaid.toFixed(2)}"`,
        `"${totals.netTotal.toFixed(2)}"`,
        '""',
      ].join(',')
    );

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanName = currentEvent
      ? currentEvent.event_name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'All_Events';
    const filename = `NSGW_Report_${cleanName}_${fileDate}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box event-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        {/* Modal Header */}
        <div className="modal-header report-modal-header">
          <div className="modal-title-wrap">
            <div className="report-header-icon-wrap">
              <FileSpreadsheet className="icon-title text-emerald" />
            </div>
            <div>
              <h3 id="report-modal-title" className="modal-title">
                Event Benefactor Attendance &amp; Financial Report
              </h3>
              <p className="modal-desc">
                Summary of all benefactors, total money collected, fees paid, and money after fees
              </p>
            </div>
          </div>

          <div className="report-header-actions">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn-download-csv"
              title="Download full report as CSV spreadsheet"
            >
              <Download className="icon-btn" />
              <span>Download CSV Report</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-print-report"
              title="Print report or save as PDF"
            >
              <Printer className="icon-btn" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-close"
              aria-label="Close report dialog"
            >
              <X className="icon-sm" />
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-box alert-error" style={{ margin: '1rem 1.5rem 0' }}>
            <AlertCircle className="icon-alert" />
            <span>{error}</span>
          </div>
        )}

        {/* Event Selector & Filter Bar */}
        <div className="report-filter-bar">
          <div className="report-filter-group">
            <label htmlFor="report-event-select" className="report-filter-label">
              <Calendar className="icon-xs" /> Event:
            </label>
            <select
              id="report-event-select"
              value={reportEventId}
              onChange={(e) => setReportEventId(e.target.value)}
              className="report-event-select"
            >
              <option value="all">-- All Events Combined ({events.length}) --</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.event_name} ({evt.year})
                </option>
              ))}
            </select>
          </div>

          <div className="report-filter-group">
            <label htmlFor="report-payment-filter" className="report-filter-label">
              <CreditCard className="icon-xs" /> Payment:
            </label>
            <select
              id="report-payment-filter"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="report-payment-select"
            >
              <option value="all">All Payment Methods</option>
              <option value="Square">Square Only</option>
              <option value="Cash">Cash Only</option>
              <option value="Check">Check Only</option>
              <option value="Zelle">Zelle Only</option>
            </select>
          </div>

          <div className="report-search-group">
            <Search className="report-search-icon" />
            <input
              type="text"
              placeholder="Search benefactor name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="report-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="btn-clear-search-mini"
              >
                <X className="icon-xs" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="btn-refresh-report"
            title="Refresh database data"
            disabled={loading}
          >
            <RefreshCw className={`icon-xs ${loading ? 'spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="report-summary-cards">
          <div className="report-card">
            <div className="report-card-label">
              <Users className="icon-sm text-indigo" />
              <span>Benefactors Attended</span>
            </div>
            <div className="report-card-value font-bold text-gray-900">
              {totals.benefactorsCount}
            </div>
            <div className="report-card-sub">
              {totals.headcount} Total Attendees ({totals.individualTickets} Ind, {totals.familyTickets} Fam)
            </div>
          </div>

          <div className="report-card card-gross">
            <div className="report-card-label">
              <DollarSign className="icon-sm text-blue" />
              <span>Total Money Collected</span>
            </div>
            <div className="report-card-value font-bold text-blue">
              ${totals.grossTotal.toFixed(2)}
            </div>
            <div className="report-card-sub">
              Gross ticket sales before fee deductions
            </div>
          </div>

          <div className="report-card card-fee">
            <div className="report-card-label">
              <CreditCard className="icon-sm text-amber" />
              <span>Fees Paid</span>
            </div>
            <div className="report-card-value font-bold text-amber">
              ${totals.feesPaid.toFixed(2)}
            </div>
            <div className="report-card-sub">
              {totals.feesPaid > 0 ? 'Square card processing fee deductions' : 'No processing fees charged'}
            </div>
          </div>

          <div className="report-card card-net">
            <div className="report-card-label">
              <Banknote className="icon-sm text-emerald" />
              <span>Money After Fees</span>
            </div>
            <div className="report-card-value font-bold text-emerald">
              ${totals.netTotal.toFixed(2)}
            </div>
            <div className="report-card-sub">
              Exact net revenue retained by NSGW
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown Strip */}
        <div className="report-payment-strip">
          <div className="payment-strip-title">
            <strong>Payment Breakdown:</strong>
          </div>
          <div className="payment-strip-items">
            <div className="payment-chip chip-square">
              <CreditCard className="icon-xs" />
              <span>Square:</span>
              <strong>{paymentBreakdown.Square.count}</strong>
              <span className="chip-details">
                (Collected: ${paymentBreakdown.Square.gross.toFixed(2)} • Fees: -${paymentBreakdown.Square.fee.toFixed(2)} • Net: ${paymentBreakdown.Square.net.toFixed(2)})
              </span>
            </div>

            <div className="payment-chip chip-cash">
              <Banknote className="icon-xs" />
              <span>Cash:</span>
              <strong>{paymentBreakdown.Cash.count}</strong>
              <span className="chip-details">
                (Net: ${paymentBreakdown.Cash.net.toFixed(2)} • $0 fee)
              </span>
            </div>

            <div className="payment-chip chip-check">
              <FileText className="icon-xs" />
              <span>Check:</span>
              <strong>{paymentBreakdown.Check.count}</strong>
              <span className="chip-details">
                (Net: ${paymentBreakdown.Check.net.toFixed(2)} • $0 fee)
              </span>
            </div>

            <div className="payment-chip chip-zelle">
              <Zap className="icon-xs" />
              <span>Zelle:</span>
              <strong>{paymentBreakdown.Zelle.count}</strong>
              <span className="chip-details">
                (Net: ${paymentBreakdown.Zelle.net.toFixed(2)} • $0 fee)
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Benefactors Attendance Table */}
        <div className="report-table-section">
          <div className="report-table-header-row">
            <h4 className="report-table-title">
              Benefactors Roster &amp; Transaction Details ({filteredOrders.length} records)
            </h4>
            <span className="report-table-hint">
              * Scroll horizontally or vertically to view full details
            </span>
          </div>

          <div className="report-table-container">
            {filteredOrders.length === 0 ? (
              <div className="report-empty-state">
                <AlertCircle className="icon-lg text-gray-400" />
                <h5>No benefactors or orders match the selected criteria.</h5>
                <p>
                  {eventOrders.length === 0
                    ? 'No ticket orders have been placed for this event yet. Orders submitted via the Tickets portal will automatically display here.'
                    : 'Try clearing the search box or payment filter above.'}
                </p>
              </div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th># Order</th>
                    <th>Benefactor Name</th>
                    <th>Contact Details</th>
                    <th>Tickets</th>
                    <th>Attendees</th>
                    <th>Payment</th>
                    <th className="text-right">Money Collected</th>
                    <th className="text-right">Fees Paid</th>
                    <th className="text-right">Money After Fees</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((ord) => {
                    let member = null;
                    if (ord.member_id) {
                      member = membersById.get(String(ord.member_id));
                    }
                    if (!member && ord.member_name) {
                      const firstPart = ord.member_name.split('&')[0].trim().toLowerCase();
                      member = membersByName.get(firstPart);
                    }

                    const indQty = Number(ord.individual_qty || 0);
                    const famQty = Number(ord.family_qty || 0);
                    const attendees = indQty + (famQty * 4);

                    const gross = Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0);
                    const fee = Number(ord.square_fee || 0);
                    const net = Number(ord.total !== undefined && ord.total !== null ? ord.total : (gross - fee));
                    const dateStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Today';

                    return (
                      <tr key={ord.id}>
                        <td>
                          <code>#{String(ord.id).slice(0, 8)}</code>
                        </td>
                        <td>
                          <div className="benefactor-name-cell">
                            <strong>{ord.member_name || member?.member1 || 'General Attendee'}</strong>
                            {member?.member2 && (
                              <span className="benefactor-spouse-sub">
                                &amp; {member.member2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="benefactor-contact-cell">
                            {member?.email1 && <span>{member.email1}</span>}
                            {member?.phone1 && <span className="text-muted">{member.phone1}</span>}
                            {!member?.email1 && !member?.phone1 && (
                              <span className="text-muted italic">No contact info</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="ticket-badges-cell">
                            {indQty > 0 && (
                              <span className="badge badge-ind">
                                {indQty} Ind
                              </span>
                            )}
                            {famQty > 0 && (
                              <span className="badge badge-fam">
                                {famQty} Fam
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="headcount-pill">
                            {attendees} {attendees === 1 ? 'person' : 'people'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`payment-mode-pill mode-${String(ord.payment_status || 'paid').toLowerCase()}`}
                          >
                            {ord.payment_status || 'Paid'}
                          </span>
                        </td>
                        <td className="text-right font-semibold">
                          ${gross.toFixed(2)}
                        </td>
                        <td className="text-right">
                          {fee > 0 ? (
                            <span className="text-amber">-${fee.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted">$0.00</span>
                          )}
                        </td>
                        <td className="text-right font-bold text-emerald">
                          ${net.toFixed(2)}
                        </td>
                        <td className="text-muted text-nowrap">{dateStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="report-table-totals-row">
                    <td colSpan="3">
                      <strong>TOTALS ({filteredOrders.length} Benefactors)</strong>
                    </td>
                    <td>
                      <strong>
                        {filteredOrders.reduce((sum, o) => sum + Number(o.individual_qty || 0), 0)} Ind,{' '}
                        {filteredOrders.reduce((sum, o) => sum + Number(o.family_qty || 0), 0)} Fam
                      </strong>
                    </td>
                    <td>
                      <strong>
                        {filteredOrders.reduce(
                          (sum, o) => sum + Number(o.individual_qty || 0) + Number(o.family_qty || 0) * 4,
                          0
                        )}{' '}
                        Attendees
                      </strong>
                    </td>
                    <td>-</td>
                    <td className="text-right font-bold">
                      $
                      {filteredOrders
                        .reduce(
                          (sum, o) =>
                            sum + Number(o.subtotal !== undefined && o.subtotal !== null ? o.subtotal : o.total || 0),
                          0
                        )
                        .toFixed(2)}
                    </td>
                    <td className="text-right font-bold text-amber">
                      $
                      {filteredOrders
                        .reduce((sum, o) => sum + Number(o.square_fee || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td className="text-right font-bold text-emerald" style={{ fontSize: '1.05rem' }}>
                      $
                      {filteredOrders
                        .reduce((sum, o) => sum + Number(o.total || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td>-</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="report-modal-footer">
          <div className="report-footer-summary">
            <span>
              Report ready for: <strong>{currentEvent ? currentEvent.event_name : 'Selected Events'}</strong>
            </span>
            <span className="footer-pipe">•</span>
            <span>
              Net Retained: <strong className="text-emerald">${totals.netTotal.toFixed(2)}</strong>
            </span>
          </div>

          <div className="report-footer-actions">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn-download-csv"
            >
              <Download className="icon-btn" />
              <span>Download CSV Report</span>
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
