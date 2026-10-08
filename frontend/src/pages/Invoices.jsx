import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { canDecide, canPay, canReleaseHold, inr, STATUS_LABEL } from '../lib/perms';
import { friendlyError } from '../lib/security';
import { listInvoices, decide, markPaid, openFile, startWorkflow, releaseHold, provideInfo } from '../services/invoices';

export default function Invoices({ profile }) {
  const { departments } = useAuth();
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [busyId, setBusyId] = useState('');
  const [open, setOpen] = useState(''); const [po, setPo] = useState(''); const [note, setNote] = useState('');
  const dname = (id) => departments.find((d) => d.id === id)?.name || '—';

  const load = useCallback(() => listInvoices().then(setRows).catch(() => setErr('Could not load invoices')), []);
  useEffect(() => {
    load();
    const ch = supabase.channel('invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const act = async (id, fn) => {
    setBusyId(id); setErr('');
    try { await fn(); await load(); } catch (e) { setErr(friendlyError(e)); } finally { setBusyId(''); }
  };

  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;
  return (
    <div><h1>Invoices</h1>
      <p className="sub">{rows.length} invoices · AI classifies by department (Engineering, Marketing, Sales, HR) · live updates</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="card" style={{ padding: 8 }}><div className="tw"><table>
        <thead><tr><th>File</th><th>Vendor</th><th>Dept</th><th>Amount</th><th>Risk</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
            <tr>
              <td>
                <button className="ghost" style={{ padding: 0, color: 'var(--pri)' }} onClick={() => act(r.id, () => openFile(r.invoice_file_url))}>
                  {r.invoice_number || r.original_filename}</button>
                <div><button className="ghost" style={{ padding: 0, fontSize: 12 }} onClick={() => setOpen(open === r.id ? '' : r.id)}>
                  {open === r.id ? 'Hide workflow' : 'Show workflow'}</button></div>
              </td>
              <td>{r.vendors?.vendor_name || <span className="hint">detecting…</span>}</td>
              <td>{dname(r.department_id)}</td><td>{inr(r.total)}</td>
              <td className={r.risk_score > 60 ? 'warn' : ''}>{r.risk_score ?? '—'}</td>
              <td>
                <span className={`bd b-${r.status}`} title={r.n8n_error || ''}>{STATUS_LABEL[r.status] || r.status}</span>
                {r.exported_at && <div className="hint">Exported to Tally</div>}
                {r.status === 'on_hold' && r.n8n_error && <div className="hint">{r.n8n_error}</div>}
              </td>
              <td>
                {canDecide(profile.role) && r.status === 'pending_approval' && <>
                  <button className="btn sm" disabled={busyId === r.id} onClick={() => act(r.id, () => decide(r.id, 'approved'))}>Approve</button>
                  <button className="btn sm rej" disabled={busyId === r.id} onClick={() => act(r.id, () => decide(r.id, 'rejected'))}>Reject</button>
                  <button className="btn sm" disabled={busyId === r.id} onClick={() => act(r.id, () => decide(r.id, 'returned', 'Need more information'))}>Request info</button></>}
                {canReleaseHold(profile.role) && r.status === 'on_hold' &&
                  <button className="btn sm" disabled={busyId === r.id} onClick={() => act(r.id, () => releaseHold(r.id))}>Release hold</button>}
                {canPay(profile.role) && r.status === 'payment_ready' &&
                  <button className="btn sm" disabled={busyId === r.id} onClick={() => act(r.id, () => markPaid(r.id))}>Pay</button>}
                {r.status === 'queue_failed' &&
                  <button className="btn sm" disabled={busyId === r.id} onClick={() => act(r.id, () => startWorkflow(r.id))}>Retry</button>}
              </td>
            </tr>
            {open === r.id && <tr><td colSpan="7">
              <div className="note" style={{ margin: 8 }}>
                <div><b>Category:</b> {r.classification?.category || '—'} · {r.classification?.reason || ''}</div>
                <div><b>Match:</b> {r.matching_status || 'pending'} · PO {r.extracted?.po_number || 'none'}</div>
                <div><b>Risk:</b> {r.risk_factors?.level || '—'} {r.risk_factors?.summary || ''}</div>
                <div><b>Payment:</b> {r.payment_status || 'not_ready'}{r.exported_at ? ' · Tally exported' : ''}</div>
                {(r.status === 'needs_info' || r.status === 'returned') && (
                  <div className="f" style={{ marginTop: 12 }}>
                    <div><label>Purchase order number</label>
                      <input value={po} onChange={(e) => setPo(e.target.value)} placeholder="PO-…" /></div>
                    <div className="full"><label>Note</label>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></div>
                    <div><button className="btn sm" disabled={busyId === r.id || !po.trim()}
                      onClick={() => act(r.id, () => provideInfo(r.id, po.trim(), note))}>Resume workflow</button></div>
                  </div>
                )}
              </div>
            </td></tr>}
            </Fragment>
          ))}
          {!rows.length && <tr><td colSpan="7" className="hint" style={{ textAlign: 'center' }}>No invoices yet</td></tr>}
        </tbody></table></div></div></div>);
}
