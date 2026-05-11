import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/ToastContainer';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTable from './pages/CreateTable';
import EditTable from './pages/EditTable';
import UserProfile from './pages/UserProfile';
import UsersList from './pages/UsersList';
import UserProfilePublic from './pages/UserProfilePublic';
import DatabaseViewer from './pages/DatabaseViewer';
import TableDetail from './pages/TableDetail';
import Notifications from './pages/Notifications';
import Navbar from './components/Navbar';
import BoardGameBackground from './components/BoardGameBackground';

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
        <Route path="/tables/:id" element={<PrivateRoute><TableDetail /></PrivateRoute>} />
        <Route path="/tables/:id/edit" element={<PrivateRoute><EditTable /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersList /></PrivateRoute>} />
        <Route path="/users/:id" element={<PrivateRoute><UserProfilePublic /></PrivateRoute>} />
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
        <NotificationProvider>
          <BoardGameBackground />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <AppRoutes />
          </div>
          <ToastContainer />
        </NotificationProvider>
      </AuthProvider>
    </HashRouter>
  );
}
