import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Procurement from './pages/Procurement';
import Inventory from './pages/Inventory';
import Kitchen from './pages/Kitchen';
import Recipes from './pages/Recipes';
import RnD from './pages/RnD';
import Wastage from './pages/Wastage';
import Masters from './pages/Masters';
import Reports from './pages/Reports';
import Admin from './pages/Admin';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" data-testid="app-loading">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/sales" element={<Protected><Sales /></Protected>} />
          <Route path="/procurement" element={<Protected><Procurement /></Protected>} />
          <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
          <Route path="/kitchen" element={<Protected><Kitchen /></Protected>} />
          <Route path="/recipes" element={<Protected><Recipes /></Protected>} />
          <Route path="/rd" element={<Protected><RnD /></Protected>} />
          <Route path="/wastage" element={<Protected><Wastage /></Protected>} />
          <Route path="/masters" element={<Protected><Masters /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/admin" element={<Protected><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </AuthProvider>
  );
}

export default App;
