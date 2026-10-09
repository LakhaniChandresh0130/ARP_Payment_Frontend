import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) { setProfile(null); setDepartments([]); setProfileLoaded(false); return; }
    setProfileLoaded(false);
    let alive = true;
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from('profiles').select('id,name,email,role,persona,department_id').eq('id', uid).single(),
        supabase.from('departments').select('id,name,code').order('name'),
      ]);
      if (!alive) return;
      setProfile(p.data); setDepartments(d.data || []); setProfileLoaded(true);
    })();
    return () => { alive = false; };
  }, [uid]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error('Invalid email or password'); // generic: no account enumeration
  }, []);
  const signUp = useCallback(async (name, email, password) => {
    const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password,
      options: { data: { name: name.trim().slice(0, 100) } } }); // role is NEVER taken from the client
    if (error && !/registered|already/i.test(error.message)) throw new Error('Could not create the account');
  }, []);
  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = useMemo(() => ({ session, profile, profileLoaded, departments, signIn, signUp, signOut }),
    [session, profile, profileLoaded, departments, signIn, signUp, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
