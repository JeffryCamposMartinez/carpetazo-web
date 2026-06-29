import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ExplorePage from './pages/ExplorePage';
import FolderPokemon from './pages/FolderPokemon';
import PublicCatalog from './pages/PublicCatalog';
import AdminPanel from './pages/AdminPanel';
import ProfilePage from './pages/ProfilePage';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="flex flex-col min-h-screen w-full relative">
          <Header />
          
          <div className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/explorar" element={<ExplorePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/carpeta/:id" element={<FolderPokemon />} />
              <Route path="/c/:folderId" element={<PublicCatalog />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </div>
          
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
