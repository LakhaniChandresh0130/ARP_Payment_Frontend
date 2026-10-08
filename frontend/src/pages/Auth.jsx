import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTilt, Cube } from '../lib/ui';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false);
  const tilt = useTilt(6);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email');
    if (mode === 'signup' && (f.name.trim().length < 2 || f.password.length < 8)) return setErr('Enter your name and a password of 8+ characters');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(f.email, f.password);
      else { await signUp(f.name, f.email, f.password); setInfo('Account created. Check your email to confirm, then log in. A Finance Admin will assign your role.'); setMode('login'); }
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="hero"><div className="logo"><div className="gem"><i /><i /></div><span>LedgerFlow</span></div>
        <Cube /><h1>AI-powered accounts payable</h1>
        <p>Classify, match and route every invoice automatically. Each person sees only what their role allows.</p></div>
      <div className="scene"><form className="card" onSubmit={submit} {...tilt} style={{ transition: 'transform .15s ease-out' }}>
        <div className="tabs" role="tablist">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>Sign up</button></div>
        {mode === 'signup' && <div className="fld"><label htmlFor="n">Full name</label><input id="n" autoComplete="name" maxLength={100} value={f.name} onChange={set('name')} /></div>}
        <div className="fld"><label htmlFor="e">Work email</label><input id="e" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div>
        <div className="fld"><label htmlFor="p">Password</label><input id="p" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></div>
        {err && <div className="err" role="alert">{err}</div>}
        {info && <div className="note" role="status">{info}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 10 }} disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        {mode === 'signup' && <div className="hint" style={{ marginTop: 12 }}>New accounts have no access until a Finance Admin assigns a role.</div>}
      </form></div>
    </div>);
}
