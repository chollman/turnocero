import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import ToastContainer from './components/layout/ToastContainer';
import ChatWindowManager from './components/chat/ChatWindowManager';
import ChatLauncher from './components/chat/ChatLauncher';
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
import BggProfile from './pages/bgg/BggProfile';
import Messages from './pages/messages/Messages';
import DirectChat from './pages/messages/DirectChat';
import AdminChat from './pages/messages/AdminChat';
import Utilidades from './pages/utilidades/Utilidades';
import FingerSelector from './pages/utilidades/FingerSelector';
import Temporizador from './pages/utilidades/Temporizador';
import Dado from './pages/utilidades/Dado';
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
          <Route path="/" element={<Compartidas />} />
          <Route path="/mesas" element={<Dashboard />} />
          <Route path="/mesas/crear" element={<PrivateRoute><CreateTable /></PrivateRoute>} />
          <Route path="/mesas/:id" element={<TableDetail />} />
          <Route path="/mesas/:id/editar" element={<PrivateRoute><EditTable /></PrivateRoute>} />
          <Route path="/notificaciones" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="/usuarios" element={<UsersList />} />
          <Route path="/usuarios/:id" element={<UserProfilePublic />} />
          <Route path="/base-de-datos" element={<PrivateRoute><DatabaseViewer /></PrivateRoute>} />
          <Route path="/mi" element={<PrivateRoute><MeFeed /></PrivateRoute>} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetail />} />
          <Route path="/compartidas" element={<Compartidas />} />
          <Route path="/compartidas/:id" element={<CompartidaPost />} />
          <Route path="/perfil-bgg/:bggUsername" element={<BggProfile />} />
          <Route path="/mensajes" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/mensajes/:userId" element={<PrivateRoute><DirectChat /></PrivateRoute>} />
          <Route path="/mensajes-admin" element={<PrivateRoute><AdminChat /></PrivateRoute>} />
          <Route path="/utilidades" element={<Utilidades />} />
          <Route path="/utilidades/selector-de-dedos" element={<FingerSelector />} />
          <Route path="/utilidades/temporizador" element={<Temporizador />} />
          <Route path="/utilidades/dado" element={<Dado />} />
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
      <div className="appFrame" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppRoutes />
      </div>
      <ToastContainer />
      <ChatWindowManager />
      <ChatLauncher />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ChatProvider>
            <AppShell />
          </ChatProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
