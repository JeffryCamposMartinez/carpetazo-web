import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { pageLoaders, preloadMainSections } from './utils/routePreload';

// Cada pantalla se descarga solo cuando se visita: el primer arranque en móvil pesa mucho menos
const LandingPage = lazy(pageLoaders.landing);
const Dashboard = lazy(pageLoaders.dashboard);
const ExplorePage = lazy(pageLoaders.explore);
const FolderPokemon = lazy(pageLoaders.folder);
const PublicCatalog = lazy(pageLoaders.catalog);
const SellerProfile = lazy(pageLoaders.seller);
const ProfilePage = lazy(pageLoaders.profile);
const Messages = lazy(pageLoaders.messages);
const FoldersPage = lazy(pageLoaders.folders);
const CardsPage = lazy(pageLoaders.cards);
const SellersPage = lazy(pageLoaders.sellers);
const NotFound = lazy(pageLoaders.notFound);

// Barra fina de carga mientras llega la pantalla (sin saltos de diseño)
function RouteLoading() {
  return (
    <div className="flex-1" role="status" aria-label="Cargando">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div className="route-loading-bar h-full w-1/3 rounded-full bg-[#facc15]" />
      </div>
    </div>
  );
}

// Cada cambio de ruta reinicia el aviso de error
function RouteBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function App() {
  // Con la página ya cargada, el navegador descarga en segundo plano las secciones del menú
  useEffect(() => preloadMainSections(), []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="flex flex-col min-h-[100dvh] w-full relative">
          <Header />
          
          <div className="flex-1 flex flex-col">
            <RouteBoundary>
            <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/bienvenida" element={<LandingPage />} />
              <Route path="/" element={<ExplorePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/carpeta/:id" element={<FolderPokemon />} />
              <Route path="/c/:folderId" element={<PublicCatalog />} />
              <Route path="/mensajes" element={<Messages />} />
              <Route path="/carpetas" element={<FoldersPage />} />
              <Route path="/cartas" element={<CardsPage />} />
              <Route path="/vendedores" element={<SellersPage />} />
              {/* Dynamic Username Route (Must be last to not override other paths) */}
              <Route path="/:sellerUsername" element={<SellerProfile />} />
              {/* Global 404 Catch-All Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </RouteBoundary>
          </div>
          
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
