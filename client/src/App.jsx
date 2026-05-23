import { BrowserRouter, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import ToastContainer from './components/layout/ToastContainer';
import ChatWindowManager from './components/chat/ChatWindowManager';
import ChatLauncher from './components/chat/ChatLauncher';
import AdminViewToggle from './components/admin/AdminViewToggle';
import ViewAsUserBanner from './components/admin/ViewAsUserBanner';
import SectionGate from './components/shared/SectionGate';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import CreateTable from './pages/tables/CreateTable';
import EditTable from './pages/tables/EditTable';
import UserProfile from './pages/users/UserProfile';
import UsersList from './pages/users/UsersList';
import UserProfilePublic from './pages/users/UserProfilePublic';
import DatabaseViewer from './pages/admin/DatabaseViewer';
import PanelAdmin from './pages/admin/PanelAdmin';
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
import PageTransition from './components/layout/PageTransition';
import useVisualViewportVars from './utils/useVisualViewportVars';

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

// AdminRoute uses the *real* admin status (ignores viewAsUser), so admin-only
// structural pages (Panel admin, Base de datos, Chat admin) stay accessible even
// when an admin previews the site as a regular user.
const AdminRoute = ({ children }) => {
  const { user, isActuallyAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return isActuallyAdmin ? children : <Navigate to="/" replace />;
};

function AppRoutes() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verificar-email' ||
    pathname === '/recuperar-contrasenia' ||
    pathname === '/restablecer-contrasenia';
  return (
    <>
      {!user && !isAuthPage && <GuestNavbar />}
      <div className="appShell">
      <ScrollToTop />
      {user ? <Sidebar /> : !isAuthPage && <GuestSidebar />}
      <div className={`appContent${!user ? ' guestMode' : ''}`}>
        {user && <Navbar />}
        <PageTransition>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/verificar-email" element={<PublicRoute><VerifyEmail /></PublicRoute>} />
          <Route path="/recuperar-contrasenia" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/restablecer-contrasenia" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          <Route path="/" element={<SectionGate section="compartidas"><Compartidas /></SectionGate>} />
          <Route path="/mesas" element={<SectionGate section="mesas"><Dashboard /></SectionGate>} />
          <Route path="/mesas/crear" element={<PrivateRoute><SectionGate section="mesas"><CreateTable /></SectionGate></PrivateRoute>} />
          <Route path="/mesas/:id" element={<SectionGate section="mesas"><TableDetail /></SectionGate>} />
          <Route path="/mesas/:id/editar" element={<PrivateRoute><SectionGate section="mesas"><EditTable /></SectionGate></PrivateRoute>} />
          <Route path="/notificaciones" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><SectionGate section="comunidad"><UsersList /></SectionGate></PrivateRoute>} />
          <Route path="/usuarios/:id" element={<PrivateRoute><SectionGate section="comunidad"><UserProfilePublic /></SectionGate></PrivateRoute>} />
          <Route path="/base-de-datos" element={<AdminRoute><DatabaseViewer /></AdminRoute>} />
          <Route path="/panel-admin" element={<AdminRoute><PanelAdmin /></AdminRoute>} />
          <Route path="/mi" element={<PrivateRoute><SectionGate section="miFeed"><MeFeed /></SectionGate></PrivateRoute>} />
          <Route path="/noticias" element={<SectionGate section="noticias"><Noticias /></SectionGate>} />
          <Route path="/noticias/:id" element={<SectionGate section="noticias"><NoticiaDetail /></SectionGate>} />
          <Route path="/torneos" element={<SectionGate section="torneos"><Torneos /></SectionGate>} />
          <Route path="/torneos/crear" element={<AdminRoute><SectionGate section="torneos"><CreateTorneo /></SectionGate></AdminRoute>} />
          <Route path="/torneos/:id" element={<SectionGate section="torneos"><TorneoDetail /></SectionGate>} />
          <Route path="/torneos/:id/editar" element={<AdminRoute><SectionGate section="torneos"><EditTorneo /></SectionGate></AdminRoute>} />
          <Route path="/eventos" element={<PrivateRoute><SectionGate section="eventos"><Eventos /></SectionGate></PrivateRoute>} />
          <Route path="/eventos/:id" element={<PrivateRoute><SectionGate section="eventos"><EventoDetail /></SectionGate></PrivateRoute>} />
          <Route path="/eventos/:id/inscripciones" element={<AdminRoute><SectionGate section="eventos"><EventoInscripciones /></SectionGate></AdminRoute>} />
          <Route path="/compartidas" element={<SectionGate section="compartidas"><Compartidas /></SectionGate>} />
          <Route path="/compartidas/:id" element={<SectionGate section="compartidas"><CompartidaPost /></SectionGate>} />
          <Route path="/bg-watch" element={<SectionGate section="bgwatch"><BgWatchLanding /></SectionGate>} />
          <Route path="/bg-watch/:bggUsername" element={<SectionGate section="bgwatch"><BgWatchProfile /></SectionGate>} />
          <Route path="/bg-watch/:bggUsername/juego/:gameId" element={<SectionGate section="bgwatch"><BgWatchPerGameView /></SectionGate>} />
          <Route path="/perfil-bgg/*" element={<LegacyBggRedirect />} />
          <Route path="/mensajes" element={<PrivateRoute><SectionGate section="dms"><Messages /></SectionGate></PrivateRoute>} />
          <Route path="/mensajes/:userId" element={<PrivateRoute><SectionGate section="dms"><DirectChat /></SectionGate></PrivateRoute>} />
          <Route path="/mensajes-admin" element={<AdminRoute><AdminChat /></AdminRoute>} />
          <Route path="/utilidades" element={<SectionGate section="utilidades"><Utilidades /></SectionGate>} />
          <Route path="/utilidades/selector-de-dedos" element={<SectionGate section="utilidades"><FingerSelector /></SectionGate>} />
          <Route path="/utilidades/temporizador" element={<SectionGate section="utilidades"><Temporizador /></SectionGate>} />
          <Route path="/utilidades/dado" element={<SectionGate section="utilidades"><Dado /></SectionGate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </PageTransition>
        {user ? <BottomNav /> : !isAuthPage && <GuestBottomNav />}
      </div>
    </div>
    </>
  );
}

function AppShell() {
  const { loading } = useAuth();
  useVisualViewportVars();
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
          <SiteConfigProvider>
            <NotificationProvider>
              <ChatProvider>
                <AppShell />
              </ChatProvider>
            </NotificationProvider>
          </SiteConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
