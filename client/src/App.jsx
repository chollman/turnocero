import { BrowserRouter, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SiteConfigProvider, useSiteConfig } from "./context/SiteConfigContext";
import { CommunityProvider, useCommunity } from "./context/CommunityContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ChatProvider } from "./context/ChatContext";
import { ThemeProvider } from "./context/ThemeContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Client ID de Google Identity Services. Si no está configurado, el provider
// igual monta (los botones de Google simplemente no funcionarán hasta setearlo).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
import ToastContainer from "./components/layout/ToastContainer";
import ChatWindowManager from "./components/chat/ChatWindowManager";
import ChatLauncher from "./components/chat/ChatLauncher";
import AdminViewToggle from "./components/admin/AdminViewToggle";
import ViewAsUserBanner from "./components/admin/ViewAsUserBanner";
import SectionGate from "./components/shared/SectionGate";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/dashboard/Dashboard";
import CreateTable from "./pages/tables/CreateTable";
import EditTable from "./pages/tables/EditTable";
import UserProfile from "./pages/users/UserProfile";
import UserProfilePublic from "./pages/users/UserProfilePublic";
import DatabaseViewer from "./pages/admin/DatabaseViewer";
import PanelAdmin from "./pages/admin/PanelAdmin";
import TableDetail from "./pages/tables/TableDetail";
import Notifications from "./pages/notifications/Notifications";
import MeFeed from "./pages/me/MeFeed";
import Noticias from "./pages/noticias/Noticias";
import NoticiaDetail from "./pages/noticias/NoticiaDetail";
import CreateNoticia from "./pages/noticias/CreateNoticia";
import EditNoticia from "./pages/noticias/EditNoticia";
import Torneos from "./pages/torneos/Torneos";
import TorneoDetail from "./pages/torneos/TorneoDetail";
import CreateTorneo from "./pages/torneos/CreateTorneo";
import EditTorneo from "./pages/torneos/EditTorneo";
import MathTrades from "./pages/mathtrade/MathTrades";
import MathTradeDetail from "./pages/mathtrade/MathTradeDetail";
import CreateMathTrade from "./pages/mathtrade/CreateMathTrade";
import EditMathTrade from "./pages/mathtrade/EditMathTrade";
import Eventos from "./pages/eventos/Eventos";
import EventoDetail from "./pages/eventos/EventoDetail";
import EventoInscripciones from "./pages/eventos/EventoInscripciones";
import Calendario from "./pages/calendario/Calendario";
import Comunidades from "./pages/comunidades/Comunidades";
import ComunidadDetail from "./pages/comunidades/ComunidadDetail";
import ComunidadGestion from "./pages/comunidades/ComunidadGestion";
import Compartidas from "./pages/compartidas/Compartidas";
import CompartidaPost from "./pages/compartidas/CompartidaPost";
import BgWatchProfile from "./pages/bg-watch/BgWatchProfile";
import BgWatchPerGameView from "./pages/bg-watch/BgWatchPerGameView";
import BgWatchLanding from "./pages/bg-watch/BgWatchLanding";
import BgWatchComunidad from "./pages/bg-watch/BgWatchComunidad";
import ComunidadJuegoDetail from "./pages/bg-watch/ComunidadJuegoDetail";
import BgWatchH2H from "./pages/bg-watch/BgWatchH2H";
import JugadorDetail from "./pages/bg-watch/JugadorDetail";
import UbicacionDetail from "./pages/bg-watch/UbicacionDetail";
import CreatePlay from "./pages/bg-watch/CreatePlay";
import CreatePlayRedirect from "./pages/bg-watch/CreatePlayRedirect";
import EditPlay from "./pages/bg-watch/EditPlay";
import PlayDetail from "./pages/bg-watch/PlayDetail";
import Messages from "./pages/messages/Messages";
import DirectChat from "./pages/messages/DirectChat";
import AdminChat from "./pages/messages/AdminChat";
import Utilidades from "./pages/utilidades/Utilidades";
import FingerSelector from "./pages/utilidades/FingerSelector";
import Temporizador from "./pages/utilidades/Temporizador";
import Dado from "./pages/utilidades/Dado";
import Colaborar from "./pages/colabora/Colaborar";
import Terminos from "./pages/legal/Terminos";
import Privacidad from "./pages/legal/Privacidad";
import NotFound from "./pages/error/NotFound";
import ServerError from "./pages/error/ServerError";
import ShortLinkRedirect from "./pages/shortlink/ShortLinkRedirect";
import ErrorBoundary from "./components/ErrorBoundary";
import ColaborarFab from "./components/colabora/ColaborarFab";
import Navbar from "./components/layout/Navbar";
import GuestSidebar from "./components/layout/GuestSidebar";
import GuestNavbar from "./components/layout/GuestNavbar";
import Sidebar from "./components/layout/Sidebar";
import BoardGameBackground from "./components/layout/BoardGameBackground";
import SplashScreen from "./components/layout/SplashScreen";
import PageTransition from "./components/layout/PageTransition";
import usePageTransition from "./components/layout/usePageTransition";
import useVisualViewportVars from "./utils/useVisualViewportVars";
import usePwaRouteRestore from "./hooks/usePwaRouteRestore";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // If the URL has a hash, let the browser scroll to that element instead of jumping to top.
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        // Defer to next tick so the target element is mounted.
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
          0,
        );
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
  const newPath = location.pathname.replace(/^\/perfil-bgg/, "/bg-watch");
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

// Rutas de autenticación: no tienen sidebar/navbar y rinden la pantalla split
// dentro del appframe. Compartido entre AppRoutes (gating del shell) y AppShell
// (variante del frame con borde izquierdo, ya que no hay sidebar que lo cubra).
const AUTH_PATHS = [
  "/login",
  "/register",
  "/verificar-email",
  "/recuperar-contrasenia",
  "/restablecer-contrasenia",
];
const isAuthPath = (pathname) => AUTH_PATHS.includes(pathname);

export function AppRoutes({ transition }) {
  const { user } = useAuth();
  // Cambia cuando el usuario edita su `viewing` de comunidades → se usa como
  // `key` de las rutas para remontar la página visible y re-fetchear con el
  // scope nuevo en tiempo real.
  const { viewingVersion } = useCommunity();
  const [menuOpen, setMenuOpen] = useState(false);
  // El chrome (sidebars/navbar/frame) deriva de la location que PageTransition
  // está MOSTRANDO, no del pathname vivo, así swapea en lockstep con el
  // contenido durante el slide (sin el salto del sidebar desapareciendo antes).
  const isAuthPage = isAuthPath(transition.displayLocation.pathname);
  const toggleMenu = () => setMenuOpen((o) => !o);
  const closeMenu = () => setMenuOpen(false);
  return (
    <>
      {!user && !isAuthPage && (
        <GuestNavbar menuOpen={menuOpen} onToggleMenu={toggleMenu} />
      )}
      <div className="appShell">
        <ScrollToTop />
        {!isAuthPage &&
          (user ? (
            <Sidebar open={menuOpen} onClose={closeMenu} />
          ) : (
            <GuestSidebar open={menuOpen} onClose={closeMenu} />
          ))}
        <div className={`appContent${!user ? " guestMode" : ""}`}>
          {user && !isAuthPage && (
            <Navbar menuOpen={menuOpen} onToggleMenu={toggleMenu} />
          )}
          <PageTransition
            transition={transition}
            routesKey={`v${viewingVersion}`}
          >
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/verificar-email"
              element={
                <PublicRoute>
                  <VerifyEmail />
                </PublicRoute>
              }
            />
            <Route
              path="/recuperar-contrasenia"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/restablecer-contrasenia"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <SectionGate section="compartidas">
                  <Compartidas />
                </SectionGate>
              }
            />
            <Route
              path="/mesas"
              element={
                <SectionGate section="mesas">
                  <Dashboard />
                </SectionGate>
              }
            />
            <Route
              path="/mesas/crear"
              element={
                <PrivateRoute>
                  <SectionGate section="mesas">
                    <CreateTable />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/mesas/:id"
              element={
                <SectionGate section="mesas">
                  <TableDetail />
                </SectionGate>
              }
            />
            <Route
              path="/mesas/:id/editar"
              element={
                <PrivateRoute>
                  <SectionGate section="mesas">
                    <EditTable />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/notificaciones"
              element={
                <PrivateRoute>
                  <Notifications />
                </PrivateRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <PrivateRoute>
                  <UserProfile />
                </PrivateRoute>
              }
            />
            {/* La lista global de usuarios se movió a la vista por comunidad
                (`/comunidades/:slug`). Mantener el redirect para bookmarks. */}
            <Route
              path="/usuarios"
              element={<Navigate to="/comunidades" replace />}
            />
            {/* Perfil público: infra compartida (linkeado desde notifs/DMs).
                NO se gatea por `comunidad`. */}
            <Route
              path="/usuarios/:id"
              element={
                <PrivateRoute>
                  <UserProfilePublic />
                </PrivateRoute>
              }
            />
            <Route
              path="/base-de-datos"
              element={
                <AdminRoute>
                  <DatabaseViewer />
                </AdminRoute>
              }
            />
            <Route
              path="/panel-admin"
              element={
                <AdminRoute>
                  <PanelAdmin />
                </AdminRoute>
              }
            />
            <Route
              path="/mi"
              element={
                <PrivateRoute>
                  <SectionGate section="miFeed">
                    <MeFeed />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/noticias"
              element={
                <SectionGate section="noticias">
                  <Noticias />
                </SectionGate>
              }
            />
            <Route
              path="/noticias/crear"
              element={
                <AdminRoute>
                  <SectionGate section="noticias">
                    <CreateNoticia />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/noticias/:id/editar"
              element={
                <AdminRoute>
                  <SectionGate section="noticias">
                    <EditNoticia />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/noticias/:id"
              element={
                <SectionGate section="noticias">
                  <NoticiaDetail />
                </SectionGate>
              }
            />
            <Route
              path="/torneos"
              element={
                <SectionGate section="torneos">
                  <Torneos />
                </SectionGate>
              }
            />
            <Route
              path="/torneos/crear"
              element={
                <AdminRoute>
                  <SectionGate section="torneos">
                    <CreateTorneo />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/torneos/:id"
              element={
                <SectionGate section="torneos">
                  <TorneoDetail />
                </SectionGate>
              }
            />
            <Route
              path="/torneos/:id/editar"
              element={
                <AdminRoute>
                  <SectionGate section="torneos">
                    <EditTorneo />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/math-trade"
              element={
                <SectionGate section="mathtrade">
                  <MathTrades />
                </SectionGate>
              }
            />
            <Route
              path="/math-trade/crear"
              element={
                <AdminRoute>
                  <SectionGate section="mathtrade">
                    <CreateMathTrade />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/math-trade/:id"
              element={
                <SectionGate section="mathtrade">
                  <MathTradeDetail />
                </SectionGate>
              }
            />
            <Route
              path="/math-trade/:id/editar"
              element={
                <AdminRoute>
                  <SectionGate section="mathtrade">
                    <EditMathTrade />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/eventos"
              element={
                <PrivateRoute>
                  <SectionGate section="eventos">
                    <Eventos />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/eventos/:id"
              element={
                <PrivateRoute>
                  <SectionGate section="eventos">
                    <EventoDetail />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/calendario"
              element={
                <SectionGate section="calendario">
                  <Calendario />
                </SectionGate>
              }
            />
            <Route
              path="/comunidades"
              element={
                <SectionGate section="comunidades">
                  <Comunidades />
                </SectionGate>
              }
            />
            <Route
              path="/comunidades/:slug"
              element={
                <PrivateRoute>
                  <SectionGate section="comunidades">
                    <ComunidadDetail />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/comunidades/:slug/gestion"
              element={
                <PrivateRoute>
                  <SectionGate section="comunidades">
                    <ComunidadGestion />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/eventos/:id/inscripciones"
              element={
                <AdminRoute>
                  <SectionGate section="eventos">
                    <EventoInscripciones />
                  </SectionGate>
                </AdminRoute>
              }
            />
            <Route
              path="/compartidas"
              element={
                <SectionGate section="compartidas">
                  <Compartidas />
                </SectionGate>
              }
            />
            <Route
              path="/compartidas/:id"
              element={
                <SectionGate section="compartidas">
                  <CompartidaPost />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchLanding />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/comunidad"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchComunidad />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/comunidad/juego/:gameId"
              element={
                <SectionGate section="bgwatch">
                  <ComunidadJuegoDetail />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/comunidad/h2h/:userA/:userB"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchH2H />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchProfile />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/partidas"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchProfile />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/coleccion"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchProfile />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/jugadores"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchProfile />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/jugador/:playerKey"
              element={
                <SectionGate section="bgwatch">
                  <JugadorDetail />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/ubicaciones"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchProfile />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/ubicacion/:locationKey"
              element={
                <SectionGate section="bgwatch">
                  <UbicacionDetail />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/juego/:gameId"
              element={
                <SectionGate section="bgwatch">
                  <BgWatchPerGameView />
                </SectionGate>
              }
            />
            {/* Entrada SIN username: resuelve al usuario logueado y redirige a
                su propia carga. Link compartible — sirve para quien lo reciba.
                Ruta estática: gana en specificity a /bg-watch/:bggUsername/... */}
            <Route
              path="/bg-watch/partidas/nueva"
              element={
                <PrivateRoute>
                  <SectionGate section="bgwatch">
                    <CreatePlayRedirect />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/partidas/nueva"
              element={
                <PrivateRoute>
                  <SectionGate section="bgwatch">
                    <CreatePlay />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            {/* Detalle público de una partida (compartible por short link).
                "nueva" gana por specificity (segmento estático > :playId). */}
            <Route
              path="/bg-watch/:bggUsername/partidas/:playId"
              element={
                <SectionGate section="bgwatch">
                  <PlayDetail />
                </SectionGate>
              }
            />
            <Route
              path="/bg-watch/:bggUsername/partidas/:playId/editar"
              element={
                <PrivateRoute>
                  <SectionGate section="bgwatch">
                    <EditPlay />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route path="/perfil-bgg/*" element={<LegacyBggRedirect />} />
            <Route
              path="/mensajes"
              element={
                <PrivateRoute>
                  <SectionGate section="dms">
                    <Messages />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/mensajes/:userId"
              element={
                <PrivateRoute>
                  <SectionGate section="dms">
                    <DirectChat />
                  </SectionGate>
                </PrivateRoute>
              }
            />
            <Route
              path="/mensajes-admin"
              element={
                <AdminRoute>
                  <AdminChat />
                </AdminRoute>
              }
            />
            <Route
              path="/utilidades"
              element={
                <SectionGate section="utilidades">
                  <Utilidades />
                </SectionGate>
              }
            />
            <Route
              path="/utilidades/selector-de-dedos"
              element={
                <SectionGate section="utilidades">
                  <FingerSelector />
                </SectionGate>
              }
            />
            <Route
              path="/utilidades/temporizador"
              element={
                <SectionGate section="utilidades">
                  <Temporizador />
                </SectionGate>
              }
            />
            <Route
              path="/utilidades/dado"
              element={
                <SectionGate section="utilidades">
                  <Dado />
                </SectionGate>
              }
            />
            <Route
              path="/colabora"
              element={
                <SectionGate section="colabora">
                  <Colaborar />
                </SectionGate>
              }
            />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            {/* Short links de deeplinks compartibles — público, sin gating. */}
            <Route path="/s/:code" element={<ShortLinkRedirect />} />
            <Route path="*" element={<NotFound />} />
          </PageTransition>
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const { loading } = useAuth();
  const {
    loaded: configLoaded,
    backendDown,
    retryConnection,
  } = useSiteConfig();
  // Fuente única del estado de transición: lo consumen el frame (acá) y el
  // chrome (en AppRoutes), así ambos siguen la misma `displayLocation`.
  const transition = usePageTransition();
  useVisualViewportVars();
  // PWA: restaura el deep-link si el SO recargó el start_url ("/") al refrescar.
  usePwaRouteRestore();
  // El FAB "Bancanos" y el AdminViewToggle comparten el spot bottom-left. El
  // FAB reporta acá si está visible para que el toggle suba (stacked) mientras
  // el FAB ocupa el spot y baje cuando se esconde (timer o ruta /colabora).
  const [bancanosVisible, setBancanosVisible] = useState(false);

  // El health-check de boot (GET /api/site-config) detectó que el backend no
  // responde → tomamos toda la pantalla con el 500 ("se nos volcó el tablero").
  // "Reintentar" reintenta la conexión sin recargar la página entera.
  if (backendDown) {
    return <ServerError onRetry={retryConnection} />;
  }

  // Mantenemos el splash hasta que auth Y el config de boot resuelvan, así la
  // toma del 500 (o el primer paint real) entra sin un flash del shell vacío.
  const showSplash = loading || !configLoaded;
  // Las auth pages no tienen sidebar, así que el frame necesita su borde
  // izquierdo (el resto del app lo omite porque el sidebar cubre esa franja).
  // Usa la location MOSTRADA para entrar en sync con el sidebar durante el slide.
  const frameClass = isAuthPath(transition.displayLocation.pathname)
    ? "appFrame appFrameAuth"
    : "appFrame";
  return (
    <>
      <SplashScreen visible={showSplash} />
      <BoardGameBackground />
      <div className={frameClass} aria-hidden="true" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <AppRoutes transition={transition} />
      </div>
      <ToastContainer />
      <ChatWindowManager />
      <ChatLauncher />
      <ColaborarFab onVisibilityChange={setBancanosVisible} />
      <AdminViewToggle bancanosVisible={bancanosVisible} />
      <ViewAsUserBanner />
    </>
  );
}

export default function App() {
  return (
    // Opt-in a los future flags de React Router v7 para silenciar los warnings
    // de v6. El único splat route (path="*") navega a una ruta absoluta ("/"),
    // así que v7_relativeSplatPath no cambia comportamiento.
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <ThemeProvider>
          <AuthProvider>
            <SiteConfigProvider>
              <CommunityProvider>
                <NotificationProvider>
                  <ChatProvider>
                    <ErrorBoundary>
                      <AppShell />
                    </ErrorBoundary>
                  </ChatProvider>
                </NotificationProvider>
              </CommunityProvider>
            </SiteConfigProvider>
          </AuthProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  );
}
