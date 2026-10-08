import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { canUpload, canExport, canManageVendors, canSeePayments, ROLE_LABEL } from './lib/perms';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Upload from './pages/Upload';
import Tally from './pages/Tally';
import Users from './pages/Users';
import Vendors from './pages/Vendors';
import Payments from './pages/Payments';

export default function App() {
  const { session, profile, profileLoaded, signOut, departments } = useAuth();
  const [tab, setTab] = useState('Dashboard');
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);

  if (session === undefined) return <div className="spin" role="status" aria-label="Loading" />;
  if (!session) return <Auth />;
  if (!profileLoaded) return <div className="spin" role="status" aria-label="Loading profile" />;
  if (!profile) return (
    <div className="center"><div className="card" style={{ maxWidth: 480, textAlign: 'center' }}>
      <h2>Profile not found</h2>
      <p className="d">Your login works, but there is no profile row for this account. In the Supabase SQL editor run step 1 of
        supabase/first_run_roles.sql (creates missing profiles), then refresh this page.</p>
      <button className="btn" onClick={signOut}>Log out</button></div></div>);
  if (profile.role === 'employee') return (
    <div className="center"><div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
      <h2>Almost there, {profile.name}</h2>
      <p className="d">Your account is created. A Finance Admin must assign your role and department before you can see any invoices.</p>
      <button className="btn" onClick={signOut}>Log out</button></div></div>);

  const dept = departments.find((d) => d.id === profile.department_id);
  const items = [['Dashboard', '▦'], ['Invoices', '▤'],
    ...(canUpload(profile.role) ? [['Upload', '⇪']] : []),
    ...(canManageVendors(profile.role) ? [['Vendors', '▣']] : []),
    ...(canSeePayments(profile.role) ? [['Payments', '₹']] : []),
    ...(canExport(profile.role) ? [['Tally', '⇩']] : []),
    ...(profile.role === 'finance_admin' ? [['Users', '☰']] : [])];
  return (
    <div className="app">
      <aside>
        <div className="logo"><div className="gem"><i /><i /></div><span>LedgerFlow</span></div>
        <nav aria-label="Main navigation">
          {items.map(([n, i]) => <button key={n} className={tab === n ? 'on' : ''} onClick={() => setTab(n)}><span>{i}</span>{n}</button>)}
        </nav>
        <div className="user"><div className="av">{profile.name[0]}</div>
          <div><div style={{ fontWeight: 500 }}>{profile.name}</div>
            <div style={{ opacity: .55, fontSize: 12 }}>{ROLE_LABEL[profile.role]}{dept ? ` · ${dept.name}` : ''}</div></div></div>
      </aside>
      <main>
        <div className="top"><div className="crumb">{dept?.name || 'All departments'} / <b>{tab}</b></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="pill"><span className="dot" />AI engine online</span>
            <button className="pill" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? '☀' : '☾'}</button>
            <button className="pill" onClick={signOut}>Log out</button></div></div>
        {tab === 'Dashboard' && <Dashboard profile={profile} dept={dept} />}
        {tab === 'Invoices' && <Invoices profile={profile} />}
        {tab === 'Upload' && canUpload(profile.role) && <Upload onDone={() => setTab('Invoices')} />}
        {tab === 'Vendors' && canManageVendors(profile.role) && <Vendors />}
        {tab === 'Payments' && canSeePayments(profile.role) && <Payments profile={profile} />}
        {tab === 'Users' && profile.role === 'finance_admin' && <Users />}
        {tab === 'Tally' && canExport(profile.role) && <Tally />}
        <p className="foot2">Documents are encrypted in transit and at rest. Access is enforced by the database.</p>
      </main>
    </div>);
}
