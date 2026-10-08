import { supabase } from '../lib/supabase';
import { inspectFile, sanitizeFilename, sha256 } from '../lib/security';

/**
 * 1. validate  2. create DB record (server builds the folder path)  3. upload to Storage
 * 4. Edge Function triggers the n8n webhook (secret stays server-side).
 * Folder: invoices/<year>/<month>/<department>/<invoice-id>/invoice.<ext>
 */
export async function uploadInvoice({ file, departmentId, month, year, vendorId, onStage = () => {} }) {
  const check = await inspectFile(file);
  if (!check.ok) throw new Error(check.error);

  onStage('Fingerprinting file');
  const file_hash = await sha256(file);

  onStage('Creating invoice record');
  const { data: inv, error } = await supabase.from('invoices').insert({
    department_id: departmentId, period_month: Number(month), period_year: Number(year),
    vendor_id: vendorId || null, original_filename: sanitizeFilename(file.name),
    mime_type: check.mime, file_size: file.size, file_hash,
  }).select('id, invoice_file_url').single();
  if (error) throw new Error('You are not allowed to upload to this department.');

  onStage('Uploading securely');
  const up = await supabase.storage.from('invoices')
    .upload(inv.invoice_file_url, file, { contentType: check.mime, upsert: false, cacheControl: '0' });
  if (up.error) {
    await supabase.rpc('fail_invoice_upload', { p_invoice_id: inv.id });
    throw new Error('Upload failed. Please try again.');
  }

  onStage('Starting AI workflow');
  await startWorkflow(inv.id);
  return inv.id;
}

export async function startWorkflow(invoiceId) {
  const { error } = await supabase.functions.invoke('trigger-n8n', { body: { invoice_id: invoiceId } });
  if (error) throw new Error('File saved, but the AI workflow could not start. Use Retry on the Invoices page.');
}

export async function listInvoices(limit = 100) {
  const { data, error } = await supabase.from('invoices')
    .select('id,invoice_number,total,risk_score,status,department_id,original_filename,invoice_file_url,created_at,n8n_error,payment_status,matching_status,exported_at,submitted_by,classification,match_result,risk_factors,extracted,vendors(vendor_name)')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
export const decide = (id, decision, comment) =>
  supabase.rpc('decide_invoice', { p_invoice_id: id, p_decision: decision, p_comment: comment ?? null }).then(({ error }) => { if (error) throw error; });
export const markPaid = (id) =>
  supabase.rpc('mark_invoice_paid', { p_invoice_id: id }).then(({ error }) => { if (error) throw error; });
export const releaseHold = (id) =>
  supabase.rpc('release_invoice_hold', { p_invoice_id: id }).then(({ error }) => { if (error) throw error; });
export const provideInfo = (id, poNumber, note) =>
  supabase.rpc('provide_invoice_info', { p_invoice_id: id, p_po_number: poNumber, p_note: note ?? null })
    .then(({ error }) => { if (error) throw error; });

export async function listPayments() {
  const { data, error } = await supabase.from('payments')
    .select('id,amount,status,payment_date,payment_method,reference_number,bank_account,created_at,invoice_id,vendors(vendor_name),invoices(invoice_number,status)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function openFile(path) {
  const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60); // 60s link
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
export async function listVendors() {
  const { data } = await supabase.from('vendors').select('id,vendor_name').eq('status', 'active').order('vendor_name');
  return data || [];
}

export async function listAllVendors() {
  const { data, error } = await supabase.from('vendors')
    .select('id,vendor_name,gstin,bank_account,ifsc,status')
    .order('vendor_name');
  if (error) throw error;
  return data || [];
}

export async function saveVendor(id, patch) {
  const { error } = await supabase.from('vendors').update(patch).eq('id', id);
  if (error) throw error;
}
export async function invoiceStats() {
  const { data, error } = await supabase.from('v_invoice_stats').select('*');
  if (error) throw error;
  return data;
}
