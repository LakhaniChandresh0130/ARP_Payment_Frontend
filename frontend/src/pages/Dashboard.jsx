import { useEffect, useState } from 'react';
import { invoiceStats } from '../services/invoices';
import { inr, STATUS_LABEL } from '../lib/perms';
import { Count, useTilt } from '../lib/ui';

function Kpi({ l, v, pre = '', suf = '', dec = 0, i }) {
  const t = useTilt(14);
  return <div className="card kpi" {...t} style={{ animationDelay: i * .08 + 's' }}><small>{l}</small><strong><Count to={v} pre={pre} suf={suf} dec={dec} /></strong></div>;
}
export default function Dashboard({ dept }) {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { invoiceStats().then(setRows).catch(() => setErr('Could not load stats')); }, []);
  if (err) return <div className="err">{err}</div>;
  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;

  const sum = (f, k) => rows.filter(f).reduce((a, r) => a + Number(r[k]), 0);
  const by = (s) => sum((r) => r.status === s, 'invoice_count');
  const pipe = ['processing', 'pending_approval', 'payment_ready', 'paid', 'rejected'].map((s) => [STATUS_LABEL[s], by(s)]);
  const mx = Math.max(1, ...pipe.map((p) => p[1]));
  const depMap = {}; rows.forEach((r) => { const k = r.department || 'Unassigned'; depMap[k] = (depMap[k] || 0) + Number(r.total_amount); });
  const dep = Object.entries(depMap); const dm = Math.max(1, ...dep.map((d) => d[1]));
  const kpis = [['Total spend', sum(() => true, 'total_amount') / 100000, '₹', 'L', 1], ['Pending approval', by('pending_approval')],
    ['Payment ready', by('payment_ready')], ['High risk', sum(() => true, 'high_risk')]];
  return (
    <div><h1>{dept ? `${dept.name} Finance` : 'Finance Command Center'}</h1>
      <p className="sub">{dept ? 'Your department only' : 'All departments'} · computed by the database under your permissions</p>
      <div className="kpis">{kpis.map(([l, v, pre, suf, dec], i) => <Kpi key={l + v} l={l} v={v} pre={pre} suf={suf} dec={dec} i={i} />)}</div>
      <div className="grid">
        <div className="card"><h2>Invoice pipeline</h2>
          <div className="pipe">{pipe.map(([l, v], i) => <div key={l} style={{ height: (v / mx * 100) + '%', minHeight: 34, animationDelay: i * .12 + 's' }}>{v}</div>)}</div>
          <div className="lbl">{pipe.map(([l]) => <span key={l}>{l}</span>)}</div></div>
        <div className="card"><h2>Department spend</h2><p className="d">Invoices you can access</p>
          {dep.map(([n, v]) => <div className="dep" key={n}><div className="row" style={{ padding: 0 }}><span>{n}</span><span>{inr(v)}</span></div>
            <div className="bar"><i style={{ width: v / dm * 100 + '%' }} /></div></div>)}
          {!dep.length && <div className="hint">No data yet</div>}</div>
      </div></div>);
}
