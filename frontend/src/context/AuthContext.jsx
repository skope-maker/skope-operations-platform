import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ company_name: 'Kitchen' });

  useEffect(() => {
    const token = localStorage.getItem('kitchen_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('kitchen_token'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) api.get('/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, [user]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('kitchen_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('kitchen_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, settings, setSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
