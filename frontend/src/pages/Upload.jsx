import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GLOBAL } from '../lib/perms';
import { inspectFile, MAX_BATCH, friendlyError } from '../lib/security';
import { useTilt, Cube } from '../lib/ui';
import { uploadInvoice, listVendors } from '../services/invoices';
import ExtractionReview from './ExtractionReview';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STAGES = ['OCR & text extraction', 'Structured JSON output', 'AI department classification', 'Vendor & PO identification',
  'Duplicate detection', 'PO + GRN 3-way match', 'Risk analysis', 'Approval routing'];
const kb = (n) => (n / 1048576).toFixed(1) + ' MB';

export default function Upload({ onDone }) {
  const { profile, departments } = useAuth();
  const depts = GLOBAL.includes(profile.role) ? departments : departments.filter((d) => d.id === profile.department_id);
  const now = new Date();
  const [deptId, setDeptId] = useState(depts[0]?.id || '');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [vendors, setVendors] = useState([]); const [vendorId, setVendorId] = useState('');
  const [items, setItems] = useState([]); const [busy, setBusy] = useState(false); const [over, setOver] = useState(false);
  const [reviewInvoiceId, setReviewInvoiceId] = useState(null);
  const inp = useRef(null); const tilt = useTilt(7);
  useEffect(() => { listVendors().then(setVendors); }, []);

  const patch = (key, p) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const add = async (list) => {
    const room = MAX_BATCH - items.length;
    const files = [...list].slice(0, Math.max(room, 0));
    const next = [];
    for (const file of files) {
      const r = await inspectFile(file);
      next.push({ key: crypto.randomUUID(), file, state: r.ok ? 'ready' : 'invalid', msg: r.ok ? 'Ready to process' : r.error });
    }
    setItems((a) => [...a, ...next]);
  };

  const run = async () => {
    setBusy(true);
    for (const it of items.filter((i) => i.state === 'ready' || i.state === 'error')) {
      patch(it.key, { state: 'working', msg: 'Starting…' });
      try {
        const invoiceId = await uploadInvoice({ file: it.file, departmentId: deptId, month, year, vendorId,
          onStage: (m) => patch(it.key, { msg: m }) });
        patch(it.key, { state: 'done', msg: 'Processing completed', invoiceId });
        // Don't automatically open review - let user click the Review button
      } catch (e) { patch(it.key, { state: 'error', msg: friendlyError(e, e.message) }); }
    }
    setBusy(false);
  };
  const allDone = items.length > 0 && items.every((i) => i.state === 'done');
  const pending = items.filter((i) => ['ready', 'error'].includes(i.state)).length;

  return (
    <div>
      {reviewInvoiceId ? (
        <ExtractionReview
          invoiceId={reviewInvoiceId}
          onDone={() => {
            setReviewInvoiceId(null);
            onDone();
          }}
          onCancel={() => setReviewInvoiceId(null)}
        />
      ) : (
        <>
          <h1>Upload Invoice</h1><p className="sub">Let AI classify, match, and route your invoice automatically.</p>
          <div className="grid">
            <div className="card"><h2>Invoice details</h2>
              <p className="d">Department is only a hint — AI independently verifies the correct classification.</p>
              <div className="f">
                <div><label htmlFor="d">Department</label>
                  <select id="d" value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={depts.length < 2}>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label htmlFor="m">Month</label>
                  <select id="m" value={month} onChange={(e) => setMonth(e.target.value)}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
                <div><label htmlFor="y">Year</label>
                  <select id="y" value={year} onChange={(e) => setYear(e.target.value)}>
                    {[0, 1, 2].map((o) => <option key={o}>{now.getFullYear() - o}</option>)}</select></div>
                <div><label htmlFor="v">Vendor</label>
                  <select id="v" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                    <option value="">✦ Auto detect</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}</select></div>
                <div className="full hint" style={{ marginTop: 0 }}>AI will identify the vendor from the document.</div>
              </div>
              <label style={{ marginTop: 20, marginBottom: 0 }}>Invoice files</label>
              <div className="scene">
                <div className={`drop ${over ? 'over' : ''}`} {...tilt} role="button" tabIndex={0}
                  onClick={() => inp.current.click()} onKeyDown={(e) => e.key === 'Enter' && inp.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
                  <div className="orb"><div className="ring" /><div className="ring b" /><div className="doc"><s /><s /></div></div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Drop invoices here</div>
                  <div style={{ color: 'var(--pri)', fontSize: 14 }}>or click to browse</div>
                  <div className="hint">PDF / JPG / PNG / Excel · Up to 25 MB per file · {MAX_BATCH} files max</div>
                  <input ref={inp} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                    onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
                </div>
              </div>
              {items.map((i) => (
                <div className="file" key={i.key}>
                  <div className="ic">{i.file.name.split('.').pop().slice(0, 4).toUpperCase()}</div>
                  <div className="t">{i.file.name}<small className={i.state === 'invalid' || i.state === 'error' ? 'warn' : ''}>{kb(i.file.size)} · {i.msg}</small></div>
                  {i.state === 'done' ? (
                    <button className="btn sm" onClick={() => setReviewInvoiceId(i.invoiceId)}>Review</button>
                  ) : (
                    <button className="ghost" disabled={busy} aria-label="Remove" onClick={() => setItems((a) => a.filter((x) => x.key !== i.key))}>✕</button>
                  )}
                </div>))}
              <div className="foot">
                {allDone ? <button className="btn" onClick={onDone}>View invoices →</button> :
                  <button className="btn" disabled={busy || !pending || !deptId} onClick={run}>{busy ? 'Processing…' : '✦ Upload & Process'}</button>}
                <button className="ghost" disabled={busy} onClick={() => setItems([])}>Clear</button>
              </div>
            </div>
            <div className="card"><Cube /><h2>Automatic classification</h2>
              <p className="d">No manual coding required. LedgerFlow extracts, classifies, matches, and routes the invoice.</p>
              <div className="steps">{STAGES.map((s) => <div key={s} className="st"><span className="c" />{s}</div>)}</div>
              <div className="note">ℹ The selected department is a hint. AI verifies it using vendor, PO, expense category, description, historical invoices and submitting user.</div>
            </div>
          </div>
        </>
      )}
    </div>);
}
