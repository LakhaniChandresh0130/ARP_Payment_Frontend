import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../lib/perms';

const ROLES = Object.keys(ROLE_LABEL);
const NEEDS_DEPT = ['poc', 'dept_manager'];

export default function Users() {
  const { profile: me } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [deptErr, setDeptErr] = useState('');
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState('');

  useEffect(() => {
    supabase.from('departments').select('id,name').order('name').then(({ data, error }) => {
      setDepartments(data || []);
      if (error) setDeptErr(error.message);
      else if (!data?.length) setDeptErr('No departments returned (permission or empty table).');
    });
  }, []);

  const load = () => supabase.from('profiles')
    .select('id,name,email,role,department_id').order('created_at', { ascending: false })
    .then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const edit = (id, p) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (u) => {
    setMsg('');
    const needs = NEEDS_DEPT.includes(u.role);
    if (needs && !u.department_id) return setMsg('Choose a department for POC / Department Manager.');
    const dept = needs ? u.department_id : null;
    const d = departments.find((x) => x.id === dept);
    setSaving(u.id);
    const { error } = await supabase.from('profiles')
      .update({ role: u.role, department_id: dept, persona: u.role === 'poc' && d ? `${d.name} POC` : null })
      .eq('id', u.id);
    setSaving('');
    setMsg(error ? 'Could not save: ' + error.message : `Saved ${u.email}. They must log out and log in again.`);
    if (!error) load();
  };

  if (!rows) return <div className="spin" role="status" aria-label="Loading" />;
  return (
    <div>
      <h1>Users & roles</h1>
      <p className="sub">Assign each person a role (and a department for POC / Department Manager).</p>
      {deptErr && <div className="err" role="alert">Departments: {deptErr}</div>}
      {msg && <div className="note" role="status" style={{ marginBottom: 14 }}>{msg}</div>}
      <div className="card" style={{ padding: 8 }}><div className="tw"><table>
        <thead><tr><th>User</th><th>Role</th><th>Department</th><th /></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}>
            <td>{u.name}<div className="hint">{u.email}</div></td>
            <td>
              <select value={u.role} disabled={u.id === me.id} onChange={(e) => edit(u.id, { role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </td>
            <td>
              <select value={u.department_id || ''} disabled={!NEEDS_DEPT.includes(u.role)}
                onChange={(e) => edit(u.id, { department_id: e.target.value || null })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </td>
            <td>
              <button className="btn sm" disabled={u.id === me.id || saving === u.id} onClick={() => save(u)}>
                {saving === u.id ? '…' : 'Save'}
              </button>
            </td>
          </tr>))}
        </tbody></table></div></div>
      <div className="hint" style={{ marginTop: 10 }}>
        Departments loaded: {departments.length}. Your own role is locked to prevent locking yourself out.
      </div>
    </div>
  );
}