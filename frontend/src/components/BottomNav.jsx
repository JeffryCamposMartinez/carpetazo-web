import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex flex-col items-center justify-center bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary rounded-full px-4 py-1 hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-all duration-200 ease-in-out active:scale-90"
      : "flex flex-col items-center justify-center text-on-surface-variant dark:text-on-surface-variant px-4 py-1 hover:bg-surface-container-high dark:hover:bg-surface-container-highest transition-all duration-200 ease-in-out active:scale-90";
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 pb-6 md:hidden border-t border-outline-variant dark:border-outline bg-surface dark:bg-surface-dim shadow-lg rounded-t-xl">
      <Link className={getLinkClasses('/')} to="/">
        <span translate="no" className="material-symbols-outlined" data-icon="grid_view" data-weight={location.pathname === '/' ? "fill" : "regular"}>grid_view</span>
        <span className="font-label-sm text-label-sm mt-1">Catálogo</span>
      </Link>
      <Link className={getLinkClasses('/admin')} to="/admin">
        <span translate="no" className="material-symbols-outlined" data-icon="person" data-weight={location.pathname === '/admin' ? "fill" : "regular"}>person</span>
        <span className="font-label-sm text-label-sm mt-1">Admin</span>
      </Link>
    </nav>
  );
}
