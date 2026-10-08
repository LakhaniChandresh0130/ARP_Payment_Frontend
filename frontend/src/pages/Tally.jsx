import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { inr, STATUS_LABEL } from '../lib/perms';
import { friendlyError } from '../lib/security';

const STEPS = ['Validated invoices', 'Validated vendors', 'Validated GST', 'Validated ledger mappings', 'Generated entries'];

export default function Tally() {
  const [rows, setRows] = useState(null); const [sel, setSel] = useState(new Set());
  const [exp, setExp] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = () => supabase.from('invoices')
    .select('id,invoice_number,original_filename,total,status,vendors(vendor_name)')
    .in('status', ['payment_ready', 'paid']).is('exported_at', null)
    .order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(t); }, [busy]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const all = rows && rows.length > 0 && sel.size === rows.length;

  const start = async () => {
    setBusy(true); setErr(''); setExp(null); setTick(0);
    const { data: id, error } = await supabase.rpc('request_tally_export', { p_invoice_ids: [...sel] });
    if (error) { setErr(friendlyError(error, 'Export could not be started')); setBusy(false); return; }
    for (let i = 0; i < 40; i++) {
      const { data: row } = await supabase.from('tally_exports').select('*').eq('id', id).single();
      setExp(row);
      if (row && ['ready', 'failed', 'completed'].includes(row.status)) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    setBusy(false); setSel(new Set()); load();
  };
  const download = async () => {
    const { data, error } = await supabase.storage.from('exports').createSignedUrl(exp.file_path, 60, { download: 'tally-export.xlsx' });
    if (error) setErr('Could not create the download link'); else window.location.assign(data.signedUrl);
  };
  const done = exp?.status === 'ready' || exp?.status === 'completed';
  const issues = exp?.validation?.issues || [];
  const shown = done ? STEPS.length : busy ? Math.min(tick, STEPS.length - 1) : 0;

  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;
  return (
    <div><h1>Export to Tally</h1>
      <p className="sub">Select payment-ready invoices. LedgerFlow maps each expense category to a Tally purchase ledger, checks GST, then builds an Excel file you import in Tally (Gateway of Tally → Import Data → Vouchers).</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="grid">
        <div className="card" style={{ padding: 8 }}><div className="tw"><table>
          <thead><tr><th><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
            <th>Invoice</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td><input type="checkbox" aria-label="Select invoice" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td>{r.invoice_number || r.original_filename}</td><td>{r.vendors?.vendor_name || '—'}</td><td>{inr(r.total)}</td>
              <td><span className={`bd b-${r.status}`}>{STATUS_LABEL[r.status]}</span></td></tr>))}
            {!rows.length && <tr><td colSpan="5" className="hint" style={{ textAlign: 'center' }}>Nothing to export. On Invoices, approve then Pay — only Payment ready / Paid invoices appear here.</td></tr>}
          </tbody></table></div></div>
        <div className="card"><h2>Tally export</h2>
          <p className="d">{sel.size} invoice(s) selected</p>
          <div className="steps">{STEPS.map((s, i) => (
            <div key={s} className={`st ${i < shown ? 'done' : i === shown && busy ? 'act' : ''}`}><span className="c">{i < shown ? '✓' : ''}</span>{s}</div>))}</div>
          {exp?.status === 'failed' && <div className="err">Export failed. Fix the issues below, then export again.</div>}
          {issues.length > 0 && <div className="note">{issues.slice(0, 8).map((x, i) => (
            <div key={i}>⚠ {typeof x === 'string' ? x : `${x.invoice || 'Invoice'}: ${x.issue}`}</div>
          ))}</div>}
          {done ? <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={download}>⬇ Download Tally Excel ({exp.entry_count})</button>
            : <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={busy || !sel.size} onClick={start}>{busy ? 'Preparing Tally export…' : 'EXPORT TO TALLY'}</button>}
        </div>
      </div></div>);
}
