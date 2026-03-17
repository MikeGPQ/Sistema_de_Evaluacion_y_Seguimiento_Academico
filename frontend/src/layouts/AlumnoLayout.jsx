import React, { useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  CalendarDays, 
  CheckSquare, 
  Award, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import Profile from '../pages/Profile';

const formatName = (name) => {
  if (!name) return "";
  return name.toLowerCase().split(" ").filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const AlumnoLayout = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const effectivelyCollapsed = isCollapsed && !isMobileOpen;

  const photoUrl =
    user?.foto_id
      ? `${import.meta.env.VITE_API_URL}files/${user.foto_id}`
      : null;
  const isActive = (path) => location.pathname.includes(path);

  const nombreCrudo =
    user?.full_name ||
    user?.nombre_completo ||
    user?.name ||
    user?.nombre ||
    'Estudiante';
  const nombreUsuario = formatName(nombreCrudo);

  const getInitials = (name) => {
    if (!name) return 'AL';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  };

  const displayArea =
    user?.email ||
    user?.correo ||
    user?.identifier ||
    'Portal Académico';

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans overflow-hidden">

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-30 bg-[#0B172A] text-white flex flex-col flex-shrink-0 shadow-xl transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-[260px]'}
        `}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute top-1/2 -right-3.5 -translate-y-1/2 bg-[#F2A900] text-[#0B172A] p-1.5 rounded-full shadow-lg z-50 hover:scale-110 transition-transform"
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4 font-bold" /> : <ChevronLeft className="w-4 h-4 font-bold" />}
        </button>

        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-[#070e1a]">
          <div className="flex items-center overflow-hidden w-full">
            <div className={`w-8 h-8 bg-[#F2A900] rounded text-[#0B172A] flex items-center justify-center font-black text-sm shrink-0 shadow-sm transition-all ${isCollapsed ? 'mx-auto' : ''}`}>
              U
            </div>
            {!isCollapsed && (
              <div className="flex flex-col ml-3 transition-opacity duration-300">
                <span className="font-bold text-base tracking-wide leading-tight">SESA Alumno</span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest">Campus Campeche</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors absolute right-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-4 border-b border-slate-800 bg-[#0b172a] flex items-center ${effectivelyCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className={`flex items-center gap-3 overflow-hidden text-left hover:bg-slate-800 rounded-lg p-1 transition-colors flex-1 ${effectivelyCollapsed ? 'justify-center' : ''}`}
            title="Ver perfil"
          >
            {photoUrl && !avatarError ? (
              <img
                src={photoUrl}
                alt="Foto de perfil"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-cyan-400"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#00AEEF] flex items-center justify-center text-white font-bold text-xs shrink-0 border border-cyan-400">
                {getInitials(nombreUsuario)}
              </div>
            )}
            {!effectivelyCollapsed && (
              <div className="flex flex-col truncate">
                <span
                  className="text-sm font-semibold text-white whitespace-normal break-words leading-tight line-clamp-2"
                  title={nombreUsuario}
                >
                  {nombreUsuario}
                </span>
                <span className="text-[10px] text-slate-400 truncate mt-0.5">
                  {displayArea}
                </span>
              </div>
            )}
          </button>
          {!effectivelyCollapsed && (
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <nav className="space-y-2">
            <Link to="/alumno/horario" title="Mi Horario" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${effectivelyCollapsed ? 'justify-center' : ''} ${isActive('/horario') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <CalendarDays className="w-[18px] h-[18px] shrink-0" />
              {!effectivelyCollapsed && <span>Mi Horario</span>}
            </Link>
            <Link to="/alumno/asistencias" title="Mis Asistencias" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${effectivelyCollapsed ? 'justify-center' : ''} ${isActive('/asistencias') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <CheckSquare className="w-[18px] h-[18px] shrink-0" />
              {!effectivelyCollapsed && <span>Mis Asistencias</span>}
            </Link>
            <Link to="/alumno/calificaciones" title="Mis Calificaciones" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${effectivelyCollapsed ? 'justify-center' : ''} ${isActive('/calificaciones') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <Award className="w-[18px] h-[18px] shrink-0" />
              {!effectivelyCollapsed && <span>Mis Calificaciones</span>}
            </Link>
          </nav>
        </div>

        {effectivelyCollapsed && (
          <div className="p-4 flex justify-center border-t border-slate-800">
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Cerrar Sesión">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="md:hidden flex items-center justify-between bg-[#070e1a] text-white p-4 shadow-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#F2A900] rounded text-[#0B172A] flex items-center justify-center font-black text-sm shadow-sm">
              U
            </div>
            <span className="font-bold text-sm tracking-wide">SESA Alumno</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <Profile 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />

    </div>
  );
};

export default AlumnoLayout;