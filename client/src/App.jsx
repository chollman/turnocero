import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTable from './pages/CreateTable';
import EditTable from './pages/EditTable';
import UserProfile from './pages/UserProfile';
import DatabaseViewer from './pages/DatabaseViewer';
import Navbar from './components/Navbar';

const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--bg-dark)',
    flexDirection: 'column',
    gap: '1rem',
  }}>
    <div style={{ fontSize: '3rem' }}>🎲</div>
    <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
      Loading…
    </p>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return !user ? children : <Navigate to="/" replace />;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><CreateTable /></PrivateRoute>} />
        <Route path="/tables/:id/edit" element={<PrivateRoute><EditTable /></PrivateRoute>} />
        <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
        <Route path="/database" element={<PrivateRoute><DatabaseViewer /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}
