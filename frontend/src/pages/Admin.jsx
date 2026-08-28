import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';
import { DataTable, PageHeader } from '../components/DataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Plus } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin', procurement_manager: 'Procurement Manager', store_keeper: 'Store Keeper',
  store_manager: 'Store Manager', chef: 'Chef / Kitchen Manager', management: 'Management',
};

export default function Admin() {
  const { settings, setSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [uform, setUform] = useState({ name: '', email: '', password: '', role: 'chef' });
  const [sform, setSform] = useState({ company_name: '', variance_tolerance_pct: 2 });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const load = () => {
    api.get('/users').then((r) => setUsers(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get('/audit-logs').then((r) => setLogs(r.data)).catch(() => {});
    api.get('/settings').then((r) => { setSform(r.data); setSettingsLoaded(true); }).catch(() => {});
  };
  useEffect(load, []);

  const saveUser = async () => {
    try {
      if (editUser) {
        const payload = { name: uform.name, role: uform.role, active: uform.active };
        if (uform.password) payload.password = uform.password;
        await api.put(`/users/${editUser.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', uform);
        toast.success('User created');
      }
      setUserDialog(false);
      setEditUser(null);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const saveSettings = async () => {
    try {
      const res = await api.put('/settings', { ...sform, variance_tolerance_pct: +sform.variance_tolerance_pct });
      setSettings(res.data);
      toast.success('Settings saved');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="admin-page">
      <PageHeader title="Administration" subtitle="Users, roles, audit trail and system settings" testid="admin-title" />
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" data-testid="tab-a-users">Users & Roles</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-a-audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-a-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="mb-4"><Button className="h-12" onClick={() => { setEditUser(null); setUform({ name: '', email: '', password: '', role: 'chef' }); setUserDialog(true); }} data-testid="new-user-btn"><Plus className="mr-2 h-5 w-5" /> New User</Button></div>
          <DataTable testid="users-table" searchKeys={['name', 'email', 'role']}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role', render: (r) => ROLE_LABELS[r.role] || r.role },
              { key: 'active', label: 'Status', render: (r) => (r.active ? <span className="font-semibold text-[#166534]">Active</span> : <span className="text-muted-foreground">Inactive</span>) },
              {
                key: 'actions', label: '', render: (r) => (
                  <Button size="sm" variant="outline" onClick={() => { setEditUser(r); setUform({ name: r.name, email: r.email, password: '', role: r.role, active: r.active }); setUserDialog(true); }} data-testid={`edit-user-${r.email}`}>Edit</Button>
                ),
              },
            ]}
            rows={users} />
        </TabsContent>

        <TabsContent value="audit">
          <DataTable testid="audit-table" exportName="audit-logs.csv" searchKeys={['action', 'user_name', 'details', 'reference']}
            columns={[
              { key: 'date', label: 'Date/Time', render: (r) => new Date(r.date).toLocaleString('en-IN') },
              { key: 'user_name', label: 'User' },
              { key: 'user_role', label: 'Role', render: (r) => ROLE_LABELS[r.user_role] || r.user_role },
              { key: 'action', label: 'Action' },
              { key: 'details', label: 'Details' },
              { key: 'reference', label: 'Reference' },
            ]}
            rows={logs} />
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-xl rounded-xl border bg-card p-6 space-y-4" data-testid="settings-form">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input className="h-12" disabled={!settingsLoaded} value={sform.company_name} onChange={(e) => setSform({ ...sform, company_name: e.target.value })} data-testid="settings-company" />
            </div>
            <div className="space-y-2">
              <Label>Acceptable Variance Tolerance (%)</Label>
              <Input type="number" min="0" className="h-12" value={sform.variance_tolerance_pct} onChange={(e) => setSform({ ...sform, variance_tolerance_pct: e.target.value })} data-testid="settings-tolerance" />
              <p className="text-xs text-muted-foreground">Closing variance beyond this % is flagged red across dashboard and reports.</p>
            </div>
            <Button className="h-12 px-8" disabled={!settingsLoaded} onClick={saveSettings} data-testid="settings-save-btn">Save Settings</Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'New User'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input className="h-12" value={uform.name} onChange={(e) => setUform({ ...uform, name: e.target.value })} data-testid="user-name" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" className="h-12" disabled={!!editUser} value={uform.email} onChange={(e) => setUform({ ...uform, email: e.target.value })} data-testid="user-email" /></div>
            <div className="space-y-2"><Label>{editUser ? 'New Password (leave blank to keep)' : 'Password'}</Label><Input type="password" className="h-12" value={uform.password} onChange={(e) => setUform({ ...uform, password: e.target.value })} data-testid="user-password" /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={uform.role} onValueChange={(v) => setUform({ ...uform, role: v })}>
                <SelectTrigger className="h-12" data-testid="user-role"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editUser && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!uform.active} onCheckedChange={(v) => setUform({ ...uform, active: v })} data-testid="user-active" /> Active
              </label>
            )}
            <Button className="h-12 w-full" onClick={saveUser} data-testid="user-save-btn">Save User</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
