import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/layout/ToastContainer';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import CreateTable from './pages/tables/CreateTable';
import EditTable from './pages/tables/EditTable';
import UserProfile from './pages/users/UserProfile';
import UsersList from './pages/users/UsersList';
import UserProfilePublic from './pages/users/UserProfilePublic';
import DatabaseViewer from './pages/admin/DatabaseViewer';
import TableDetail from './pages/tables/TableDetail';
import Notifications from './pages/notifications/Notifications';
import MeFeed from './pages/me/MeFeed';
import Noticias from './pages/noticias/Noticias';
import NoticiaDetail from './pages/noticias/NoticiaDetail';
import Compartidas from './pages/compartidas/Compartidas';
import CompartidaPost from './pages/compartidas/CompartidaPost';
import Navbar from './components/layout/Navbar';
import GuestNavbar from './components/layout/GuestNavbar';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import BoardGameBackground from './components/layout/BoardGameBackground';
import SplashScreen from './components/layout/SplashScreen';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/" replace />;
};

function AppRoutes() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAuthPage = pathname === '/login' || pathname === '/register';
  return (
    <>
      {!user && !isAuthPage && <GuestNavbar />}
      <div className="appShell">
      <ScrollToTop />
      {user && <Sidebar />}
      <div className={`appContent${!user ? ' guestMode' : ''}`}>
        {user && <Navbar />}
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<PrivateRoute><CreateTable /></PrivateRoute>} />
          <Route path="/tables/:id" element={<TableDetail />} />
          <Route path="/tables/:id/edit" element={<PrivateRoute><EditTable /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="/users" element={<UsersList />} />
          <Route path="/users/:id" element={<UserProfilePublic />} />
          <Route path="/database" element={<PrivateRoute><DatabaseViewer /></PrivateRoute>} />
          <Route path="/me" element={<PrivateRoute><MeFeed /></PrivateRoute>} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetail />} />
          <Route path="/compartidas" element={<Compartidas />} />
          <Route path="/compartidas/:id" element={<CompartidaPost />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user && <BottomNav />}
      </div>
    </div>
    </>
  );
}

function AppShell() {
  const { loading } = useAuth();
  return (
    <>
      <SplashScreen visible={loading} />
      <BoardGameBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppRoutes />
      </div>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppShell />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
