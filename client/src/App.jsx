import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import ToastContainer from './components/layout/ToastContainer';
import ChatWindowManager from './components/chat/ChatWindowManager';
import ChatLauncher from './components/chat/ChatLauncher';
import AdminViewToggle from './components/admin/AdminViewToggle';
import ViewAsUserBanner from './components/admin/ViewAsUserBanner';
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
import Torneos from './pages/torneos/Torneos';
import TorneoDetail from './pages/torneos/TorneoDetail';
import CreateTorneo from './pages/torneos/CreateTorneo';
import EditTorneo from './pages/torneos/EditTorneo';
import Eventos from './pages/eventos/Eventos';
import EventoDetail from './pages/eventos/EventoDetail';
import EventoInscripciones from './pages/eventos/EventoInscripciones';
import Compartidas from './pages/compartidas/Compartidas';
import CompartidaPost from './pages/compartidas/CompartidaPost';
import BgWatchProfile from './pages/bg-watch/BgWatchProfile';
import BgWatchPerGameView from './pages/bg-watch/BgWatchPerGameView';
import BgWatchLanding from './pages/bg-watch/BgWatchLanding';
import Messages from './pages/messages/Messages';
import DirectChat from './pages/messages/DirectChat';
import AdminChat from './pages/messages/AdminChat';
import Utilidades from './pages/utilidades/Utilidades';
import FingerSelector from './pages/utilidades/FingerSelector';
import Temporizador from './pages/utilidades/Temporizador';
import Dado from './pages/utilidades/Dado';
import Navbar from './components/layout/Navbar';
import GuestSidebar from './components/layout/GuestSidebar'
import GuestNavbar from './components/layout/GuestNavbar'
import GuestBottomNav from './components/layout/GuestBottomNav';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import BoardGameBackground from './components/layout/BoardGameBackground';
import SplashScreen from './components/layout/SplashScreen';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // If the URL has a hash, let the browser scroll to that element instead of jumping to top.
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        // Defer to next tick so the target element is mounted.
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
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

function LegacyBggRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/perfil-bgg/, '/bg-watch');
  return <Navigate to={newPath + location.search + location.hash} replace />;
}

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return user.isAdmin ? children : <Navigate to="/" replace />;
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
      {user ? <Sidebar /> : !isAuthPage && <GuestSidebar />}
      <div className={`appContent${!user ? ' guestMode' : ''}`}>
        {user && <Navbar />}
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/" element={<Compartidas />} />
          <Route path="/mesas" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/mesas/crear" element={<AdminRoute><CreateTable /></AdminRoute>} />
          <Route path="/mesas/:id" element={<AdminRoute><TableDetail /></AdminRoute>} />
          <Route path="/mesas/:id/editar" element={<AdminRoute><EditTable /></AdminRoute>} />
          <Route path="/notificaciones" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><UsersList /></PrivateRoute>} />
          <Route path="/usuarios/:id" element={<PrivateRoute><UserProfilePublic /></PrivateRoute>} />
          <Route path="/base-de-datos" element={<PrivateRoute><DatabaseViewer /></PrivateRoute>} />
          <Route path="/mi" element={<AdminRoute><MeFeed /></AdminRoute>} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetail />} />
          <Route path="/torneos" element={<AdminRoute><Torneos /></AdminRoute>} />
          <Route path="/torneos/crear" element={<AdminRoute><CreateTorneo /></AdminRoute>} />
          <Route path="/torneos/:id" element={<AdminRoute><TorneoDetail /></AdminRoute>} />
          <Route path="/torneos/:id/editar" element={<AdminRoute><EditTorneo /></AdminRoute>} />
          <Route path="/eventos" element={<PrivateRoute><Eventos /></PrivateRoute>} />
          <Route path="/eventos/:id" element={<PrivateRoute><EventoDetail /></PrivateRoute>} />
          <Route path="/eventos/:id/inscripciones" element={<PrivateRoute><EventoInscripciones /></PrivateRoute>} />
          <Route path="/compartidas" element={<Compartidas />} />
          <Route path="/compartidas/:id" element={<CompartidaPost />} />
          <Route path="/bg-watch" element={<BgWatchLanding />} />
          <Route path="/bg-watch/:bggUsername" element={<PrivateRoute><BgWatchProfile /></PrivateRoute>} />
          <Route path="/bg-watch/:bggUsername/juego/:gameId" element={<PrivateRoute><BgWatchPerGameView /></PrivateRoute>} />
          <Route path="/perfil-bgg/*" element={<LegacyBggRedirect />} />
          <Route path="/mensajes" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/mensajes/:userId" element={<PrivateRoute><DirectChat /></PrivateRoute>} />
          <Route path="/mensajes-admin" element={<PrivateRoute><AdminChat /></PrivateRoute>} />
          <Route path="/utilidades" element={<Utilidades />} />
          <Route path="/utilidades/selector-de-dedos" element={<FingerSelector />} />
          <Route path="/utilidades/temporizador" element={<Temporizador />} />
          <Route path="/utilidades/dado" element={<Dado />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user ? <BottomNav /> : !isAuthPage && <GuestBottomNav />}
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
      <AdminViewToggle />
      <ViewAsUserBanner />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <ChatProvider>
              <AppShell />
            </ChatProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
