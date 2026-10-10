import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { PlusCircle, Calendar, DollarSign, X, Check, AlertCircle, Sparkles } from 'lucide-react';

// Parse Square fee rate of the format "x% + y cents" (charged per transaction)
export function parseSquareFeeRate(input) {
  if (!input) {
    return { percentage: 2.9, cents: 30, dollars: 0.3, isValid: true };
  }
  const str = String(input).trim();

  // Pattern 1: "x% + y cents" (or ¢, or just number for cents)
  const comboMatch = str.match(/^([0-9.]+)\s*%\s*\+\s*([0-9.]+)\s*(?:cents?|¢)?$/i);
  if (comboMatch) {
    const percentage = parseFloat(comboMatch[1]);
    const cents = parseFloat(comboMatch[2]);
    if (!isNaN(percentage) && !isNaN(cents)) {
      return {
        percentage,
        cents,
        dollars: Number((cents / 100).toFixed(4)),
        isValid: true,
      };
    }
  }

  // Pattern 2: "x%" only
  const percentOnly = str.match(/^([0-9.]+)\s*%$/);
  if (percentOnly) {
    const percentage = parseFloat(percentOnly[1]);
    if (!isNaN(percentage)) {
      return { percentage, cents: 0, dollars: 0, isValid: true };
    }
  }

  // Pattern 3: "y cents" or "y¢" only
  const centsOnly = str.match(/^([0-9.]+)\s*(?:cents?|¢)$/i);
  if (centsOnly) {
    const cents = parseFloat(centsOnly[1]);
    if (!isNaN(cents)) {
      return { percentage: 0, cents, dollars: Number((cents / 100).toFixed(4)), isValid: true };
    }
  }

  return { percentage: 0, cents: 0, dollars: 0, isValid: false };
}

export default function CreateEvent({ onEventCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    eventName: '',
    year: currentYear,
    individualTicketPrice: '',
    familyTicketPrice: '',
    squareFee: '2.6% + 15 cents',
  });

  const handleOpen = () => {
    setError(null);
    setSuccess(null);
    setFormData({
      eventName: '',
      year: currentYear,
      individualTicketPrice: '45.00',
      familyTicketPrice: '150.00',
      squareFee: '2.6% + 15 cents',
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
      setError(null);
      setSuccess(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Form validation
    if (!formData.eventName.trim()) {
      setError('Please provide an Event Name.');
      return;
    }

    const yearNum = parseInt(formData.year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      setError('Please enter a valid 4-digit Year (e.g. 2026).');
      return;
    }

    const indPrice = parseFloat(formData.individualTicketPrice);
    if (isNaN(indPrice) || indPrice < 0) {
      setError('Please enter a valid price for the Individual Ticket.');
      return;
    }

    const famPrice = parseFloat(formData.familyTicketPrice);
    if (isNaN(famPrice) || famPrice < 0) {
      setError('Please enter a valid price for the Family of Four Ticket.');
      return;
    }

    const parsedFee = parseSquareFeeRate(formData.squareFee);
    if (!parsedFee.isValid) {
      setError('Please enter Square Fees in the format: x% + y cents (e.g. 2.6% + 15 cents).');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        event_name: formData.eventName.trim(),
        year: yearNum,
        individual_ticket_price: indPrice,
        family_ticket_price: famPrice,
        square_fee: Number(parsedFee.dollars.toFixed(2)), // fixed cents portion in dollars e.g. 0.30
        square_fee_percentage: Number(parsedFee.percentage.toFixed(2)), // percentage rate e.g. 2.9
        is_active: true,
      };

      const { data, error: insertError } = await supabase
        .from('events')
        .insert([payload])
        .select();

      if (insertError) {
        throw insertError;
      }

      const createdEvent = (data && data[0]) ? data[0] : { ...payload, id: `evt-${Date.now()}` };

      setSuccess(`Event "${formData.eventName}" successfully created!`);

      // Notify parent app
      if (onEventCreated) {
        onEventCreated(createdEvent);
      }

      // Automatically close modal after brief delay
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to create event in Supabase:', err);
      setError(err.message || 'Failed to save event to Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-event-wrapper">
      {/* Button to open the Create Event box */}
      <button
        type="button"
        onClick={handleOpen}
        className="btn-create-event"
        id="btn-open-create-event"
      >
        <PlusCircle className="icon-btn" />
        <span>Create Event</span>
      </button>

      {/* Box / Modal Dialog */}
      {isOpen && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Calendar className="icon-title text-indigo" />
                <div>
                  <h3 id="modal-title" className="modal-title">Create New Event</h3>
                  <p className="modal-desc">
                    Configure event parameters & ticket pricing stored in Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="btn-close"
                aria-label="Close dialog"
                disabled={loading}
              >
                <X className="icon-sm" />
              </button>
            </div>

            {error && (
              <div className="alert-box alert-error">
                <AlertCircle className="icon-alert" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert-box alert-success">
                <Check className="icon-alert" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="modal-form">
              {/* Event Name */}
              <div className="form-group">
                <label htmlFor="eventName" className="form-label">
                  Event Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="eventName"
                  name="eventName"
                  value={formData.eventName}
                  onChange={handleChange}
                  placeholder="e.g. 2026 Annual Spring Gala"
                  required
                  autoFocus
                  className="form-input"
                />
              </div>

              {/* Year */}
              <div className="form-group">
                <label htmlFor="year" className="form-label">
                  Year <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  min="2000"
                  max="2100"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              {/* Individual Ticket Price */}
              <div className="form-group">
                <label htmlFor="individualTicketPrice" className="form-label">
                  Individual Ticket Price ($) <span className="required">*</span>
                </label>
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="individualTicketPrice"
                    name="individualTicketPrice"
                    value={formData.individualTicketPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    required
                    className="form-input with-prefix"
                  />
                </div>
                <span className="field-hint">Base admission price for a single attendee</span>
              </div>

              {/* Family of Four Ticket Price */}
              <div className="form-group">
                <label htmlFor="familyTicketPrice" className="form-label">
                  Family of Four Ticket Price ($) <span className="required">*</span>
                </label>
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="familyTicketPrice"
                    name="familyTicketPrice"
                    value={formData.familyTicketPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    required
                    className="form-input with-prefix"
                  />
                </div>
                <span className="field-hint">Discounted admission package for 4 family members</span>
              </div>

              {/* Square Fees (Format: x% + y cents, NO $ sign) */}
              <div className="form-group">
                <label htmlFor="squareFee" className="form-label">
                  Square Fees <span className="fee-per-tx-hint">(charged per transaction)</span>
                </label>
                <input
                  type="text"
                  id="squareFee"
                  name="squareFee"
                  value={formData.squareFee}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
                <div className="square-fee-helper">
                  <span className="field-hint">
                    Format: <code>2.6% + 15 cents</code> (charged once per transaction checkout)
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating Event...' : 'Save & Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
