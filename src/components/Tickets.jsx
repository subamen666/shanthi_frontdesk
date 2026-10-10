import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  Ticket,
  Users,
  User,
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Receipt,
  Tag,
  Banknote,
  FileText,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';

const SAVED_EVENT_KEY = 'nsgw_selected_event_id';

export default function Tickets({
  selectedMember,
  benefactorName = '',
  onSaveBenefactor,
  events: propEvents,
  selectedEventId: propSelectedEventId,
  onEventRefreshed,
  loadingEvents = false,
  onOpenReport,
}) {
  const [localEvents, setLocalEvents] = useState([]);
  const [localSelectedEventId, setLocalSelectedEventId] = useState(() => {
    return localStorage.getItem(SAVED_EVENT_KEY) || '';
  });
  const [localLoading, setLocalLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);

  // Mode of payment: '' (none selected by default), 'Square', 'Cash', 'Check', 'Zelle'
  const [paymentMode, setPaymentMode] = useState('');

  // Ticket quantities (both default to 0)
  const [individualQty, setIndividualQty] = useState(0);
  const [familyQty, setFamilyQty] = useState(0);

  // Controlled or uncontrolled events and selectedEventId
  const events = propEvents !== undefined ? propEvents : localEvents;
  const selectedEventId = propSelectedEventId !== undefined ? propSelectedEventId : localSelectedEventId;
  const loading = propEvents !== undefined ? loadingEvents : localLoading;

  // Fetch events and ticket prices from Supabase (fallback if not provided by parent)
  const fetchEvents = async () => {
    if (propEvents !== undefined) {
      if (onEventRefreshed) onEventRefreshed();
      return;
    }
    setLocalLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.warn('Error fetching events from Supabase:', fetchErr.message);
        setError('Could not fetch ticket prices from Supabase: ' + fetchErr.message);
      } else if (data && data.length > 0) {
        setLocalEvents(data);
        const storedId = localStorage.getItem(SAVED_EVENT_KEY);
        if (storedId && data.some((e) => e.id === storedId)) {
          setLocalSelectedEventId(storedId);
        } else if (data.length === 1) {
          setLocalSelectedEventId(data[0].id);
          localStorage.setItem(SAVED_EVENT_KEY, data[0].id);
        } else if (storedId && !data.some((e) => e.id === storedId)) {
          setLocalSelectedEventId('');
          localStorage.removeItem(SAVED_EVENT_KEY);
        }
      } else {
        setLocalEvents([]);
        setLocalSelectedEventId('');
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to query ticket prices from Supabase.');
    } finally {
      setLocalLoading(false);
    }
  };

  // Fetch recent ticket orders from Supabase (last 5 transactions)
  const fetchOrders = async () => {
    try {
      const { data, error: ordersErr } = await supabase
        .from('ticket_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!ordersErr && data) {
        setRecentOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  };

  useEffect(() => {
    if (propEvents === undefined) {
      fetchEvents();
    }
    fetchOrders();
  }, [propEvents]);

  // Current active event - only if selectedEventId is selected
  const currentEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  // Benefactor Name tracking
  const effectiveBenefactorName = (benefactorName && benefactorName.trim())
    || (selectedMember && selectedMember.member1 && selectedMember.member1.trim())
    || '';
  const hasBenefactorName = Boolean(effectiveBenefactorName);

  // Tickets section is disabled if no event is active OR benefactor name is empty
  const isTicketsDisabled = !currentEvent || !hasBenefactorName;

  // Prices queried from Supabase
  const individualPrice = currentEvent ? Number(currentEvent.individual_ticket_price || 0) : 0;
  const familyPrice = currentEvent ? Number(currentEvent.family_ticket_price || 0) : 0;

  // Square Fee rate parameters (charged per transaction: x% + y cents)
  const feePercent = currentEvent ? Number(currentEvent.square_fee_percentage || 0) : 0;
  const feeFixedDollars = currentEvent ? Number(currentEvent.square_fee || 0) : 0;
  const feeFixedCents = Math.round(feeFixedDollars * 100);

  // Calculation (Only Square charges fee; Cash, Check, Zelle have 0 fee)
  const subtotal = !isTicketsDisabled ? individualQty * individualPrice + familyQty * familyPrice : 0;
  const grossTotal = subtotal;
  const totalSquareFee = (!isTicketsDisabled && grossTotal > 0 && paymentMode === 'Square')
    ? (grossTotal * (feePercent / 100)) + feeFixedDollars
    : 0;
  // Exact revenue after deducting Square processing fees (if applicable)
  const netRevenue = Math.max(0, grossTotal - totalSquareFee);

  const handleQuantityChange = (type, delta) => {
    if (isTicketsDisabled) return;
    if (type === 'individual') {
      setIndividualQty((prev) => Math.max(0, prev + delta));
    } else if (type === 'family') {
      setFamilyQty((prev) => Math.max(0, prev + delta));
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (isTicketsDisabled) {
      if (!currentEvent) {
        setError('Please select an event before placing an order.');
      } else {
        setError('Please enter a Benefactor Name before placing an order.');
      }
      return;
    }
    if (grossTotal <= 0) {
      setError('Please select at least one ticket before proceeding.');
      return;
    }
    if (!paymentMode) {
      setError('Please select a mode of payment (Cash, Check, Zelle, or Square) before placing an order.');
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccessOrder(null);

    try {
      // In addition to existing ticket order conditions: SAVE BENEFACTOR PROFILE FIRST!
      let activeMember = selectedMember;
      if (onSaveBenefactor) {
        const res = await onSaveBenefactor();
        if (res && res.error) {
          throw new Error('Failed to save benefactor profile: ' + res.error);
        }
        if (res && res.data) {
          activeMember = res.data;
        }
      }

      const memberName = activeMember
        ? (activeMember.member1 + (activeMember.member2 ? ` & ${activeMember.member2}` : ''))
        : (effectiveBenefactorName || 'General Attendee');

      const orderPayload = {
        event_id: currentEvent ? currentEvent.id : null,
        event_name: currentEvent ? currentEvent.event_name : 'General Event',
        member_id: activeMember ? activeMember.id : null,
        member_name: memberName,
        individual_qty: individualQty,
        family_qty: familyQty,
        subtotal: Number(grossTotal.toFixed(2)),
        square_fee: Number(totalSquareFee.toFixed(2)),
        total: Number(netRevenue.toFixed(2)),
        payment_status: paymentMode,
      };

      let { data, error: orderErr } = await supabase
        .from('ticket_orders')
        .insert([orderPayload])
        .select();

      if (orderErr && orderErr.message && orderErr.message.includes('payment_status')) {
        // Fallback without payment_status if column does not exist
        const { payment_status, ...fallbackPayload } = orderPayload;
        const fallbackRes = await supabase.from('ticket_orders').insert([fallbackPayload]).select();
        data = fallbackRes.data;
        orderErr = fallbackRes.error;
      }

      if (orderErr) {
        throw orderErr;
      }

      const orderResult = (data && data[0]) ? data[0] : { ...orderPayload, id: `ord-${Date.now()}` };

      setSuccessOrder(orderResult);
      // Reset quantities to 0
      setIndividualQty(0);
      setFamilyQty(0);
      // Reset payment method
      setPaymentMode('');
      await fetchOrders();
    } catch (err) {
      console.error('Order placement error:', err);
      setError(err.message || 'Failed to record ticket order in Supabase.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <Ticket className="icon-title" /> Tickets
          </h2>
          <p className="section-subtitle">
            {currentEvent ? (
              <>Active Event: <strong>{currentEvent.event_name} ({currentEvent.year})</strong></>
            ) : (
              <>Select an event above to enable ticketing</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchEvents();
            fetchOrders();
          }}
          className="btn-refresh"
          title="Refresh ticket prices from database"
          disabled={loading}
        >
          <RefreshCw className={`icon-sm ${loading ? 'spin' : ''}`} />
          {loading ? 'Querying DB...' : 'Refresh Prices'}
        </button>
      </div>

      {error && (
        <div className="alert-box alert-error">
          <AlertCircle className="icon-alert" />
          <span>{error}</span>
        </div>
      )}

      {successOrder && (
        <div className="alert-box alert-success">
          <CheckCircle className="icon-alert" />
          <div>
            <strong>Ticket Order Confirmed &amp; Benefactor Profile Saved to Supabase!</strong>
            <div>
              Order #{successOrder.id.toString().slice(0, 8)} • Payment: <strong>{successOrder.payment_status || paymentMode}</strong> • Net Revenue: ${Number(successOrder.total).toFixed(2)} • Attendee: {successOrder.member_name}
            </div>
          </div>
        </div>
      )}

      {/* Notice when tickets section is disabled */}
      {isTicketsDisabled && (
        <div className="tickets-disabled-notice">
          <AlertCircle className="icon-sm text-amber" />
          <div className="disabled-notice-text">
            {!currentEvent ? (
              events.length === 0 ? (
                <>
                  <strong>No events found in database.</strong>
                  <p>Click &quot;Create Event&quot; at the top to configure your first event.</p>
                </>
              ) : (
                <>
                  <strong>No event selected.</strong>
                  <p>Please select an event from the Active Event dropdown above.</p>
                </>
              )
            ) : (
              <>
                <strong>Benefactor Name is required.</strong>
                <p>Please enter a Benefactor Name (Member 1) or select a benefactor from search to enable tickets.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tickets Content Wrapper */}
      <div className={`tickets-content-wrapper ${isTicketsDisabled ? 'tickets-section-disabled' : ''}`}>
        {/* Benefactor Link Banner */}
        <div className="benefactor-link-card">
          <div className="benefactor-link-info">
            <User className="icon-inline text-indigo" />
            <span className="benefactor-link-label">Assign To:</span>
            <div className="benefactor-link-name">
              {selectedMember ? (
                <>
                  <span className="font-semibold text-emerald">{selectedMember.member1}</span>
                  {selectedMember.member2 && <span> &amp; {selectedMember.member2}</span>}
                  <span className="badge badge-pref">
                    Pref: {selectedMember.notification_preference || 'None'}
                  </span>
                </>
              ) : effectiveBenefactorName ? (
                <>
                  <span className="font-semibold text-emerald">{effectiveBenefactorName}</span>
                  <span className="badge badge-pref">Profile Pending Save</span>
                </>
              ) : (
                <span className="text-muted">
                  Benefactor Name required to assign tickets
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2 Ticket Options Section */}
        <div className="tickets-grid">
          {/* Option 1: Individual Ticket */}
          <div className={`ticket-card ${individualQty > 0 ? 'ticket-card-active' : ''}`}>
            <div className="ticket-card-header">
              <div className="ticket-badge">Option 1</div>
              <div className="ticket-type-icon">
                <User className="icon-lg text-blue" />
              </div>
            </div>

            <div className="ticket-body">
              <h3 className="ticket-name">Individual Ticket</h3>

              <div className="ticket-price-display">
                <span className="price-currency">$</span>
                <span className="price-amount">{isTicketsDisabled ? '0.00' : individualPrice.toFixed(2)}</span>
                <span className="price-unit">/ person</span>
              </div>

              {/* Quantity Controller */}
              <div className="ticket-qty-control">
                <label className="qty-label">Quantity</label>
                <div className="qty-buttons">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange('individual', -1)}
                    disabled={isTicketsDisabled || individualQty <= 0}
                    className="btn-qty"
                    aria-label="Decrease individual tickets"
                  >
                    -
                  </button>
                  <span className="qty-value">{isTicketsDisabled ? 0 : individualQty}</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange('individual', 1)}
                    disabled={isTicketsDisabled}
                    className="btn-qty"
                    aria-label="Increase individual tickets"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="ticket-subtotal">
                Subtotal: <strong>${(!isTicketsDisabled ? individualQty * individualPrice : 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Option 2: Family of Four Ticket */}
          <div className={`ticket-card ${familyQty > 0 && !isTicketsDisabled ? 'ticket-card-active' : ''}`}>
            <div className="ticket-card-header">
              <div className="ticket-badge badge-purple">Option 2</div>
              <div className="ticket-type-icon">
                <Users className="icon-lg text-purple" />
              </div>
            </div>

            <div className="ticket-body">
              <h3 className="ticket-name">Family of Four</h3>

              <div className="ticket-price-display">
                <span className="price-currency">$</span>
                <span className="price-amount">{isTicketsDisabled ? '0.00' : familyPrice.toFixed(2)}</span>
                <span className="price-unit">/ 4 attendees</span>
              </div>

              {/* Quantity Controller */}
              <div className="ticket-qty-control">
                <label className="qty-label">Quantity</label>
                <div className="qty-buttons">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange('family', -1)}
                    disabled={isTicketsDisabled || familyQty <= 0}
                    className="btn-qty"
                    aria-label="Decrease family tickets"
                  >
                    -
                  </button>
                  <span className="qty-value">{isTicketsDisabled ? 0 : familyQty}</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange('family', 1)}
                    disabled={isTicketsDisabled}
                    className="btn-qty"
                    aria-label="Increase family tickets"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="ticket-subtotal">
                Subtotal: <strong>${(!isTicketsDisabled ? familyQty * familyPrice : 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary & Square Fees Breakdown */}
        <div className="order-summary-box">
          <div className="summary-header">
            <Receipt className="icon-title text-indigo" />
            <h3 className="summary-title">Order Summary &amp; Payment Details</h3>
          </div>

          {/* Mode of Payment Selector */}
          <div className="payment-mode-section">
            <div className="payment-mode-title">
              <span>
                Mode of Payment: {!paymentMode && <span className="text-amber" style={{ fontSize: '0.8rem', fontWeight: 500 }}>(Please select one)</span>}
              </span>
              <span className="payment-mode-subtitle">Only Square charges processing fees</span>
            </div>
            <div className="payment-mode-options">
              {[
                { id: 'Square', label: 'Square', icon: CreditCard },
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'Check', label: 'Check', icon: FileText },
                { id: 'Zelle', label: 'Zelle', icon: Zap },
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = paymentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    disabled={isTicketsDisabled}
                    className={`payment-mode-btn ${isSelected ? 'payment-mode-active' : ''}`}
                  >
                    <Icon className="icon-sm" />
                    <div className="payment-mode-btn-text">
                      <span className="payment-mode-btn-label">{mode.label}</span>
                      <span className="payment-mode-btn-note">{mode.note}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="summary-rows">
            <div className="summary-row summary-fee-row">
              <span className="fee-label">
                <CreditCard className="icon-xs inline-icon" />
                {paymentMode === 'Square'
                  ? 'Square Processing Fee (Deducted)'
                  : paymentMode
                    ? `${paymentMode} Processing Fee`
                    : 'Processing Fee'}
                <span className="fee-note">
                  {!paymentMode ? (
                    <>(Select payment mode above — only Square charges fee)</>
                  ) : paymentMode === 'Square' ? (
                    <>
                      ({feePercent > 0 ? `${feePercent}%` : ''}
                      {feePercent > 0 && feeFixedCents > 0 ? ' + ' : ''}
                      {feeFixedCents > 0 ? `${feeFixedCents}¢` : ''}
                      {!feePercent && !feeFixedCents ? 'per transaction' : ' per transaction'})
                    </>
                  ) : (
                    <>(No fee • 100% net revenue retained)</>
                  )}
                </span>
              </span>
              <span className={`font-semibold ${paymentMode === 'Square' ? 'text-amber' : paymentMode ? 'text-emerald' : 'text-muted'}`}>
                {!paymentMode
                  ? '$0.00'
                  : paymentMode === 'Square'
                    ? (grossTotal > 0 ? `- $${totalSquareFee.toFixed(2)}` : '$0.00')
                    : '$0.00 (No fee)'}
              </span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total-row">
              <div>
                <span>Exact Revenue (Net)</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}>
                  {!paymentMode
                    ? 'Select payment method above to complete calculation'
                    : paymentMode === 'Square'
                      ? 'Gross ticket sales minus Square processing fees'
                      : `Gross ticket sales (no processing fee for ${paymentMode})`}
                </div>
              </div>
              <span className="total-price font-bold text-emerald">${netRevenue.toFixed(2)}</span>
            </div>
          </div>

          <div className="summary-checkout-actions">
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isTicketsDisabled || purchasing || grossTotal <= 0 || !paymentMode}
              className="btn-checkout"
            >
              <ShoppingBag className="icon-btn" />
              {purchasing
                ? 'Recording Order & Saving Benefactor in Supabase...'
                : isTicketsDisabled
                  ? (!currentEvent
                    ? 'Select an Event to Order Tickets'
                    : 'Enter Benefactor Name to Order Tickets')
                  : grossTotal <= 0
                    ? 'Select Tickets to Order'
                    : !paymentMode
                      ? 'Select Payment Method to Submit'
                      : `Submit Ticket Order (${paymentMode} • Net: $${netRevenue.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Stored in Supabase - Last 5 Transactions */}
      {recentOrders.length > 0 && (
        <div className="recent-orders-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <h4 className="recent-orders-title" style={{ margin: 0 }}>
              Recent Ticket Orders (Last {Math.min(5, recentOrders.length)} Transactions)
            </h4>
            {onOpenReport && (
              <button
                type="button"
                onClick={onOpenReport}
                className="btn-tickets-report"
                title="View full event attendance report and download CSV spreadsheet"
              >
                <FileSpreadsheet className="icon-xs" />
                <span>Full Report &amp; CSV</span>
              </button>
            )}
          </div>
          <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Attendee / Benefactor</th>
                  <th>Event</th>
                  <th>Tickets</th>
                  <th>Mode of Payment</th>
                  <th>Gross Total</th>
                  <th>Square Fee</th>
                  <th>Exact Revenue (Net)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map((ord) => (
                  <tr key={ord.id}>
                    <td><code>#{String(ord.id).slice(0, 8)}</code></td>
                    <td className="font-semibold">{ord.member_name}</td>
                    <td>{ord.event_name}</td>
                    <td>
                      {ord.individual_qty > 0 && <span>{ord.individual_qty} Ind </span>}
                      {ord.family_qty > 0 && <span>{ord.family_qty} Family</span>}
                    </td>
                    <td>
                      <span className={`payment-mode-pill mode-${String(ord.payment_status || 'paid').toLowerCase()}`}>
                        {ord.payment_status || 'Paid'}
                      </span>
                    </td>
                    <td>${Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0).toFixed(2)}</td>
                    <td>
                      {Number(ord.square_fee || 0) > 0 ? (
                        <span className="text-amber">-${Number(ord.square_fee).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted">$0.00</span>
                      )}
                    </td>
                    <td className="font-bold text-emerald">${Number(ord.total).toFixed(2)}</td>
                    <td className="text-muted">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
