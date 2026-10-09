// UI hints only. The database (RLS + RPC checks) is the source of truth.
export const ROLE_LABEL = { employee: 'Awaiting role', poc: 'Department POC', dept_manager: 'Department Manager',
  ap_manager: 'AP Manager', finance_admin: 'Finance Admin', cfo: 'CFO', auditor: 'Auditor' };
export const GLOBAL = ['finance_admin', 'ap_manager', 'cfo', 'auditor'];
export const canUpload = (r) => ['finance_admin', 'ap_manager', 'poc', 'dept_manager'].includes(r);
export const canDecide = (r) => ['finance_admin', 'cfo', 'ap_manager', 'dept_manager', 'poc'].includes(r);
export const canDecideInvoice = (role, userDeptId, invoiceDeptId) => {
  // Only global roles and AP Manager can decide on invoices
  // Department-specific roles (poc, dept_manager) do NOT have approval permissions in the database
  if (['finance_admin', 'cfo', 'ap_manager'].includes(role)) return true;
  // Department roles (poc, dept_manager) cannot approve - they can only view
  return false;
};
export const canExport = (r) => ['finance_admin', 'ap_manager'].includes(r);
export const canPay = (r) => ['finance_admin', 'cfo'].includes(r);
export const canManageVendors = (r) => ['finance_admin', 'ap_manager'].includes(r);
export const canReleaseHold = (r) => ['finance_admin', 'ap_manager', 'cfo'].includes(r);
export const canSeePayments = (r) => ['finance_admin', 'ap_manager', 'cfo', 'auditor'].includes(r);
export const INR_TO_USD_RATE = 0.012; // Approximate conversion rate (1 INR = 0.012 USD)
export const formatCurrency = (n, invoiceCurrency = 'INR') => {
  try {
    const amount = n || 0;
    const currency = (invoiceCurrency || 'INR').toUpperCase();
    
    if (currency === 'INR') {
      // Convert INR to USD
      const usdAmount = amount * INR_TO_USD_RATE;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdAmount);
    }
    // If already USD or any other currency, keep as is with 2 decimal precision (display as USD for consistency)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch (e) {
    console.error('Currency formatting error:', e);
    return '$0.00';
  }
};
export const inr = (n, currency = 'INR') => formatCurrency(n, currency);
export const STATUS_LABEL = { uploading: 'Uploading', upload_failed: 'Upload failed', queue_failed: 'Queue failed',
  received: 'Received', processing: 'AI processing', needs_info: 'Needs info', pending_approval: 'Pending approval',
  returned: 'Returned', approved: 'Approved', on_hold: 'On hold', rejected: 'Rejected', payment_ready: 'Payment ready', paid: 'Paid' };
