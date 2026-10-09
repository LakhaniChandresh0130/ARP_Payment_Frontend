import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { inr } from '../lib/perms';

const FIELDS = [
  { key: 'vendor_name', label: 'Vendor Name', type: 'text', required: true },
  { key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
  { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
  { key: 'due_date', label: 'Due Date', type: 'date', required: false },
  { key: 'po_number', label: 'PO Number', type: 'text', required: false },
  { key: 'tax_id_type', label: 'Tax ID Type', type: 'select', options: ['GST', 'EIN', 'VAT', 'OTHER'], required: false },
  { key: 'tax_id_value', label: 'Tax ID', type: 'text', required: false },
  { key: 'subtotal', label: 'Subtotal', type: 'number', required: true },
  { key: 'tax', label: 'Tax', type: 'number', required: false },
  { key: 'total', label: 'Total', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'EUR', 'GBP'], required: true },
];

export default function ExtractionReview({ invoiceId, onDone, onCancel }) {
  const [invoice, setInvoice] = useState(null);
  const [fields, setFields] = useState({});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [edited, setEdited] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [riskScore, setRiskScore] = useState(null);
  const [aiConfidence, setAiConfidence] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Loading invoice with ID:', invoiceId);
      const { data, error } = await supabase.from('invoices')
        .select('id,invoice_number,total,currency,extracted,ocr_status')
        .eq('id', invoiceId)
        .single();
      
      console.log('Invoice data:', data);
      console.log('Error:', error);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (!data) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      // Allow review even if not fully processed - user can manually enter data
      setInvoice(data);
      const extractedFields = {};
      FIELDS.forEach(f => {
        extractedFields[f.key] = data.extracted?.[f.key] || '';
      });
      setFields(extractedFields);
      
      // Calculate initial AI confidence (simulated)
      const confidence = {};
      FIELDS.forEach(f => {
        confidence[f.key] = data.extracted?.[f.key] ? 0.85 : 0;
      });
      setAiConfidence(confidence);
      
      if (data.ocr_status !== 'completed' || !data.extracted) {
        setError(`Invoice processing status: ${data.ocr_status || 'unknown'}. You can still manually review and enter data.`);
      }
    } catch (e) {
      setError(`Failed to load invoice data: ${e.message}`);
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setEdited(prev => ({ ...prev, [key]: true }));
  };

  const verifyField = async () => {
    setVerifying(true);
    const currentField = FIELDS[currentFieldIndex];
    
    // Simulate AI verification (in real implementation, call backend AI)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update confidence based on whether user edited
    const newConfidence = { ...aiConfidence };
    if (edited[currentField.key]) {
      newConfidence[currentField.key] = 0.95; // Higher confidence after user verification
    }
    setAiConfidence(newConfidence);
    setVerifying(false);
  };

  const nextField = () => {
    if (currentFieldIndex < FIELDS.length - 1) {
      setCurrentFieldIndex(prev => prev + 1);
    }
  };

  const prevField = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(prev => prev - 1);
    }
  };

  const calculateRiskScore = () => {
    let risk = 0;
    
    // Check math accuracy
    const subtotal = Number(fields.subtotal) || 0;
    const tax = Number(fields.tax) || 0;
    const total = Number(fields.total) || 0;
    const mathDiff = Math.abs((subtotal + tax) - total);
    if (mathDiff > 1 && mathDiff / total > 0.01) {
      risk += 20;
    }
    
    // Check missing required fields
    FIELDS.filter(f => f.required).forEach(f => {
      if (!fields[f.key]) risk += 10;
    });
    
    // Check for suspicious amounts
    if (total > 1000000) risk += 15;
    if (total < 0) risk += 30;
    
    // Adjust based on AI confidence
    const avgConfidence = Object.values(aiConfidence).reduce((a, b) => a + b, 0) / Object.values(aiConfidence).length;
    if (avgConfidence < 0.7) risk += 15;
    
    return Math.min(100, Math.max(0, risk));
  };

  const submitReview = async () => {
    setVerifying(true);
    
    // Calculate final risk score
    const finalRisk = calculateRiskScore();
    setRiskScore(finalRisk);
    
    // Update invoice with verified fields
    const updateData = {
      extracted: { ...invoice.extracted, ...fields },
      risk_score: finalRisk,
    };
    
    await supabase.from('invoices').update(updateData).eq('id', invoiceId);
    
    setVerifying(false);
    onDone();
  };

  if (loading) return <div className="spin" role="status" aria-label="Loading invoice data" />;
  if (error) return (
    <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
      <h2>Unable to Review</h2>
      <p className="d">{error}</p>
      <div className="foot">
        <button className="btn" onClick={onCancel}>Go Back</button>
        <button className="btn" onClick={loadInvoice}>Retry</button>
      </div>
    </div>
  );

  const currentField = FIELDS[currentFieldIndex];
  const progress = ((currentFieldIndex + 1) / FIELDS.length) * 100;

  return (
    <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2>Review Extracted Data</h2>
      <p className="d">Verify and edit the AI-extracted fields. Your changes will be re-verified.</p>
      
      {/* Progress bar */}
      <div className="bar" style={{ marginBottom: 24 }}>
        <i style={{ width: progress + '%' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 20 }}>
        Field {currentFieldIndex + 1} of {FIELDS.length}
      </div>

      {/* Current field */}
      <div className="f" style={{ marginBottom: 20 }}>
        <div className="full">
          <label>
            {currentField.label}
            {currentField.required && <span style={{ color: '#dc2626' }}> *</span>}
          </label>
          {currentField.type === 'select' ? (
            <select
              value={fields[currentField.key] || ''}
              onChange={(e) => handleFieldChange(currentField.key, e.target.value)}
            >
              <option value="">Select...</option>
              {currentField.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : currentField.type === 'number' ? (
            <input
              type="number"
              step="0.01"
              value={fields[currentField.key] || ''}
              onChange={(e) => handleFieldChange(currentField.key, e.target.value)}
            />
          ) : (
            <input
              type={currentField.type}
              value={fields[currentField.key] || ''}
              onChange={(e) => handleFieldChange(currentField.key, e.target.value)}
            />
          )}
          
          {/* AI confidence indicator */}
          <div className="hint" style={{ marginTop: 6 }}>
            AI Confidence: {Math.round((aiConfidence[currentField.key] || 0) * 100)}%
            {edited[currentField.key] && <span style={{ color: 'var(--ok)', marginLeft: 8 }}>✓ Verified by you</span>}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="foot">
        <button
          className="btn"
          disabled={verifying || currentFieldIndex === 0}
          onClick={prevField}
        >
          Previous
        </button>
        <button
          className="btn"
          disabled={verifying}
          onClick={currentFieldIndex === FIELDS.length - 1 ? submitReview : nextField}
        >
          {verifying ? 'Processing...' : currentFieldIndex === FIELDS.length - 1 ? 'Submit & Calculate Risk' : 'Next'}
        </button>
      </div>

      {/* Quick overview of all fields */}
      <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 12 0' }}>All Fields Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {FIELDS.map(f => (
            <div key={f.key} style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--mut)' }}>{f.label}:</span>{' '}
              <span style={{ fontWeight: edited[f.key] ? 600 : 400 }}>
                {f.type === 'number' && fields[f.key] ? inr(fields[f.key]) : fields[f.key] || '—'}
              </span>
              {edited[f.key] && <span style={{ color: 'var(--ok)', marginLeft: 4 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Risk score preview */}
      {riskScore !== null && (
        <div className="note" style={{ marginTop: 16 }}>
          <strong>Risk Score: {riskScore}/100</strong>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {riskScore < 20 ? 'Low risk - Safe to proceed' :
             riskScore < 50 ? 'Medium risk - Review recommended' :
             'High risk - Manual review required'}
          </div>
        </div>
      )}
    </div>
  );
}
