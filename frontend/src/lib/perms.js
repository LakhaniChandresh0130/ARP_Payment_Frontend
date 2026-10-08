// UI hints only. The database (RLS + RPC checks) is the source of truth.
export const ROLE_LABEL = { employee: 'Awaiting role', poc: 'Department POC', dept_manager: 'Department Manager',
  ap_manager: 'AP Manager', finance_admin: 'Finance Admin', cfo: 'CFO', auditor: 'Auditor' };
export const GLOBAL = ['finance_admin', 'ap_manager', 'cfo', 'auditor'];
export const canUpload = (r) => ['finance_admin', 'ap_manager', 'poc', 'dept_manager'].includes(r);
export const canDecide = (r) => ['finance_admin', 'cfo', 'ap_manager', 'dept_manager', 'poc'].includes(r);
export const canExport = (r) => ['finance_admin', 'ap_manager'].includes(r);
export const canPay = (r) => ['finance_admin', 'cfo'].includes(r);
export const canManageVendors = (r) => ['finance_admin', 'ap_manager'].includes(r);
export const canReleaseHold = (r) => ['finance_admin', 'ap_manager', 'cfo'].includes(r);
export const canSeePayments = (r) => ['finance_admin', 'ap_manager', 'cfo', 'auditor'].includes(r);
export const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const STATUS_LABEL = { uploading: 'Uploading', upload_failed: 'Upload failed', queue_failed: 'Queue failed',
  received: 'Received', processing: 'AI processing', needs_info: 'Needs info', pending_approval: 'Pending approval',
  returned: 'Returned', approved: 'Approved', on_hold: 'On hold', rejected: 'Rejected', payment_ready: 'Payment ready', paid: 'Paid' };
