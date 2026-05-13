import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
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
import MeFeed from './pages/MeFeed';
import Noticias from './pages/Noticias';
import Compartidas from './pages/Compartidas'
import CompartidaPost from './pages/CompartidaPost';
import Navbar from './components/Navbar';
import GuestNavbar from './components/GuestNavbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import BoardGameBackground from './components/BoardGameBackground';
import SplashScreen from './components/SplashScreen';

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
