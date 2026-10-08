import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { canPay, inr } from '../lib/perms';
import { friendlyError } from '../lib/security';
import { listPayments, markPaid } from '../services/invoices';

const PAY = { queued: 'Queued', scheduled: 'Scheduled', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled' };

export default function Payments({ profile }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => listPayments().then(setRows).catch((e) => setErr(friendlyError(e))), []);
  useEffect(() => {
    load();
    const ch = supabase.channel('payments-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;
  return (
    <div>
      <h1>Payments</h1>
      <p className="sub">{rows.length} payment records · queued after approval, marked paid by Finance Admin / CFO</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="card" style={{ padding: 8 }}><div className="tw"><table>
        <thead><tr><th>Invoice</th><th>Vendor</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th><th>Reference</th><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.invoices?.invoice_number || p.invoice_id}</td>
              <td>{p.vendors?.vendor_name || '—'}</td>
              <td>{inr(p.amount)}</td>
              <td>{(p.payment_method || 'neft').toUpperCase()}</td>
              <td>{p.payment_date || '—'}</td>
              <td><span className={`bd b-${p.status}`}>{PAY[p.status] || p.status}</span></td>
              <td>{p.reference_number || '—'}</td>
              <td>
                {canPay(profile.role) && p.status === 'queued' && p.invoices?.status === 'payment_ready' && (
                  <button className="btn sm" disabled={busyId === p.id} onClick={async () => {
                    setBusyId(p.id); setErr('');
                    try { await markPaid(p.invoice_id); await load(); } catch (e) { setErr(friendlyError(e)); }
                    setBusyId('');
                  }}>Mark paid</button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="8" className="hint" style={{ textAlign: 'center' }}>No payments yet. Approve an invoice so payment prep can queue it.</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  );
}
