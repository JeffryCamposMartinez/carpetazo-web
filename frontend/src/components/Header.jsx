import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

import AuthModal from './AuthModal';

export default function Header() {
  const { currentUser, logout, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userAvatar, setUserAvatar] = useState(null);
  const [userUsername, setUserUsername] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('Carpetas');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const searchCategories = [
    { label: 'Carpetas', route: '/carpetas' },
    { label: 'Cartas', route: '/cartas' },
    { label: 'Vendedores', route: '/vendedores' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    const cat = searchCategories.find(c => c.label === searchCategory);
    const route = cat ? cat.route : '/explorar';
    if (searchQuery.trim()) {
      navigate(`${route}?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(route);
    }
  };

  const getLinkClass = (path) => {
    const isActive = location.pathname.startsWith(path);
    
    if (isActive) {
      // Active tab: light blue background, rounded top only, text dark blue, touches the bottom
      return `font-extrabold text-[#1a2b4b] bg-[#DBEAFE] rounded-t-xl px-6 py-3 transition-all duration-300`;
    }
    // Inactive tab: light blue text, transparent, smaller padding
    return `text-blue-200 hover:text-white hover:bg-white/10 rounded-t-xl px-5 py-2 transition-all duration-300 font-bold text-sm mb-1`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-dropdown')) {
        setIsDropdownOpen(false);
      }
      if (!event.target.closest('.search-category-dropdown')) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

    useEffect(() => {
    if (currentUser) {
      setUserAvatar(currentUser.photoURL);
      // Fetch user profile from API if needed
      // For now, we'll just use the auth info to prevent crashes
    } else {
      setUserAvatar(null);
    }
  }, [currentUser]);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
      {/* Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

