import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';

// Cada pantalla se descarga solo cuando se visita: el primer arranque en móvil pesa mucho menos
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const FolderPokemon = lazy(() => import('./pages/FolderPokemon'));
const PublicCatalog = lazy(() => import('./pages/PublicCatalog'));
const SellerProfile = lazy(() => import('./pages/SellerProfile'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const Messages = lazy(() => import('./pages/Messages'));
const FoldersPage = lazy(() => import('./pages/FoldersPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="flex flex-col min-h-[100dvh] w-full relative">
          <Header />
          
          <div className="flex-1 flex flex-col">
            <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/bienvenida" element={<LandingPage />} />
              <Route path="/" element={<ExplorePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/carpeta/:id" element={<FolderPokemon />} />
              <Route path="/c/:folderId" element={<PublicCatalog />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/mensajes" element={<Messages />} />
              <Route path="/carpetas" element={<FoldersPage />} />
              {/* Dynamic Username Route (Must be last to not override other paths) */}
              <Route path="/:sellerUsername" element={<SellerProfile />} />
              {/* Global 404 Catch-All Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </div>
          
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
