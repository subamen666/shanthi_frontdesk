import { supabase } from '../supabaseClient';

/**
 * Escapes values for safe CSV formatting (handles quotes, commas, newlines)
 */
export function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates and triggers browser download of the Event Attendance & Financial CSV Report
 *
 * @param {Object} options
 * @param {string} options.eventId - ID of event to report on (or 'all')
 * @param {Object} [options.event] - Event object
 * @param {Array} [options.events] - All available events
 * @returns {Promise<{ success: boolean, count: number, totals: Object }>}
 */
export async function generateAndDownloadEventCsv({
  eventId = '',
  event = null,
  events = [],
}) {
  try {
    // 1. Fetch ticket orders from Supabase
    const { data: ordersData, error: ordersErr } = await supabase
      .from('ticket_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) {
      throw new Error('Failed to query ticket orders: ' + ordersErr.message);
    }

    const allOrders = ordersData || [];

    // 2. Fetch members to enrich contact info
    const { data: membersData } = await supabase.from('members').select('*');
    const allMembers = membersData || [];

    const membersById = new Map();
    allMembers.forEach((m) => {
      if (m.id) membersById.set(String(m.id), m);
    });

    const membersByName = new Map();
    allMembers.forEach((m) => {
      if (m.member1) membersByName.set(m.member1.toLowerCase().trim(), m);
    });

    // 3. Resolve active event details
    let currentEvent = event;
    if (!currentEvent && eventId && eventId !== 'all' && events.length > 0) {
      currentEvent = events.find((e) => String(e.id) === String(eventId)) || null;
    }

    // Filter orders by event if an event is specified
    const targetOrders = (eventId && eventId !== 'all')
      ? allOrders.filter((ord) => String(ord.event_id) === String(eventId))
      : allOrders;

    // 4. Compute Financial Totals
    let grossTotal = 0;
    let feesPaid = 0;
    let netTotal = 0;
    let individualTickets = 0;
    let familyTickets = 0;

    const paymentBreakdown = {
      Square: { count: 0, gross: 0, fee: 0, net: 0 },
      Cash: { count: 0, gross: 0, fee: 0, net: 0 },
      Check: { count: 0, gross: 0, fee: 0, net: 0 },
      Zelle: { count: 0, gross: 0, fee: 0, net: 0 },
      Other: { count: 0, gross: 0, fee: 0, net: 0 },
    };

    targetOrders.forEach((ord) => {
      const gross = Number(ord.subtotal !== undefined && ord.subtotal !== null ? ord.subtotal : ord.total || 0);
      const fee = Number(ord.square_fee || 0);
      const net = Number(ord.total !== undefined && ord.total !== null ? ord.total : (gross - fee));

      grossTotal += gross;
      feesPaid += fee;
      netTotal += net;

      const ind = Number(ord.individual_qty || 0);
      const fam = Number(ord.family_qty || 0);
      individualTickets += ind;
      familyTickets += fam;

      const mode = ord.payment_status || 'Other';
      const key = paymentBreakdown[mode] ? mode : 'Other';
      paymentBreakdown[key].count += 1;
      paymentBreakdown[key].gross += gross;
      paymentBreakdown[key].fee += fee;
      paymentBreakdown[key].net += net;
    });

    const headcount = individualTickets + (familyTickets * 4);

    const totals = {
      benefactorsCount: targetOrders.length,
      individualTickets,
      familyTickets,
      headcount,
      grossTotal,
      feesPaid,
      netTotal,
    };

    // 5. Build CSV Lines
    const eventTitle = currentEvent
      ? `${currentEvent.event_name} (${currentEvent.year})`
      : eventId === 'all'
        ? 'All Events Combined'
        : 'Event Benefactor Attendance & Financial Report';

    const now = new Date();
    const dateFormatted = now.toLocaleString();
    const fileDate = now.toISOString().slice(0, 10);

    const csvLines = [
      // Top Header
      `"Event Name:",${escapeCsv(eventTitle)}`,
      `"Event Year:",${escapeCsv(currentEvent ? currentEvent.year : 'All Years')}`,
      `"Report Generated:",${escapeCsv(dateFormatted)}`,
      '""',
      '"------------------------------------------------------------------------------------------"',
      '"EXECUTIVE FINANCIAL SUMMARY"',
      '"------------------------------------------------------------------------------------------"',
      `"Total Benefactors Attended (Orders):",${totals.benefactorsCount}`,
      `"Total Estimated Attendees (Headcount):",${totals.headcount}`,
      `"Total Individual Tickets:",${totals.individualTickets}`,
      `"Total Family of 4 Tickets:",${totals.familyTickets}`,
      `"TOTAL MONEY COLLECTED (GROSS):","$"${totals.grossTotal.toFixed(2)}`,
      `"TOTAL FEES PAID (PROCESSING):","$"${totals.feesPaid.toFixed(2)}`,
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
      '"DETAILED BENEFACTOR ATTENDANCE & FINANCIAL ROSTER"',
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
        '"Family of 4 Tickets"',
        '"Total Attendees"',
        '"Payment Method"',
        '"Money Collected ($)"',
        '"Fees Paid ($)"',
        '"Money After Fees ($)"',
        '"Date Recorded"',
      ].join(','),
    ];

    // Data rows
    targetOrders.forEach((ord) => {
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

    // 6. Trigger Browser File Download
    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanName = currentEvent
      ? currentEvent.event_name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'All_Events';
    const filename = `Shanthi_Event_Report_${cleanName}_${fileDate}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, count: targetOrders.length, totals };
  } catch (err) {
    console.error('CSV Generation Error:', err);
    throw err;
  }
}
