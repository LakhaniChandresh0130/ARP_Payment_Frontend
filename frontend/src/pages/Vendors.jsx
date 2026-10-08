import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/security';
import { listAllVendors, saveVendor } from '../services/invoices';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function Vendors() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState('');

  const load = useCallback(() => listAllVendors().then(setRows).catch((e) => setErr(friendlyError(e))), []);
  useEffect(() => {
    load();
    const ch = supabase.channel('vendors-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const edit = (id, p) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (v) => {
    setErr(''); setMsg('');
    const gstin = (v.gstin || '').replace(/\s/g, '').toUpperCase();
    const bank = (v.bank_account || '').replace(/\s/g, '');
    const ifsc = (v.ifsc || '').replace(/\s/g, '').toUpperCase();
    if (v.status === 'active') {
      if (!bank) return setErr('Active vendors need a bank account number.');
      if (!IFSC.test(ifsc)) return setErr('Active vendors need a valid 11-character IFSC (e.g. HDFC0001234).');
    }
    setSaving(v.id);
    try {
      await saveVendor(v.id, {
        vendor_name: (v.vendor_name || '').trim().slice(0, 200),
        gstin: gstin || null,
        bank_account: bank || null,
        ifsc: ifsc || null,
        status: v.status === 'active' ? 'active' : 'inactive',
      });
      setMsg(`Saved ${v.vendor_name}. On Invoices, click Release hold for INV-88291 (and any other held bills for this vendor).`);
      await load();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setSaving('');
    }
  };

  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;
  return (
    <div>
      <h1>Vendors</h1>
      <p className="sub">New vendors from invoices start as inactive. Activate them and add bank + IFSC before payment can proceed.</p>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="note" role="status" style={{ marginBottom: 14 }}>{msg}</div>}
      <div className="card" style={{ padding: 8 }}><div className="tw"><table>
        <thead><tr><th>Vendor</th><th>GSTIN</th><th>Bank account</th><th>IFSC</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td><input value={v.vendor_name || ''} onChange={(e) => edit(v.id, { vendor_name: e.target.value })} /></td>
              <td><input value={v.gstin || ''} onChange={(e) => edit(v.id, { gstin: e.target.value })} placeholder="Optional" /></td>
              <td><input value={v.bank_account || ''} onChange={(e) => edit(v.id, { bank_account: e.target.value })} placeholder="Account number" /></td>
              <td><input value={v.ifsc || ''} onChange={(e) => edit(v.id, { ifsc: e.target.value })} placeholder="HDFC0001234" /></td>
              <td>
                <select value={v.status || 'inactive'} onChange={(e) => edit(v.id, { status: e.target.value })}>
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                </select>
              </td>
              <td>
                <button className="btn sm" disabled={saving === v.id} onClick={() => save(v)}>
                  {saving === v.id ? '…' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="hint" style={{ textAlign: 'center' }}>No vendors yet. Upload an invoice first.</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  );
}
