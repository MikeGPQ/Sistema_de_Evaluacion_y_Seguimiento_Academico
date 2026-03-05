import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  Users, 
  RefreshCcw, 
  CalendarDays, 
  FileText, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';

const formatName = (name) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

const AdminLayout = () => {
  const location = useLocation();
  const { logout, user } = useAuth(); 
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (path) => location.pathname.includes(path);

  const nombreCrudo = user?.nombre_completo || "Usuario Administrador";
  const nombreUsuario = formatName(nombreCrudo);
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase();

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
                <span className="font-bold text-base tracking-wide leading-tight">SESA Admin</span>
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

        <div className={`p-4 border-b border-slate-800 bg-[#0b172a] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#1A237E] flex items-center justify-center text-white font-bold text-xs shrink-0 border border-indigo-500">
              {inicialUsuario}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span 
                  className="text-sm font-semibold text-white whitespace-normal break-words leading-tight line-clamp-2" 
                  title={nombreUsuario}
                >
                  {nombreUsuario}
                </span>
                <span className="text-[10px] text-slate-400 truncate mt-0.5">
                  Administrador
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0" title="Cerrar Sesión">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <nav className="space-y-2">
            <Link to="/alumnos/listado" title="Alumnos" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive('/alumnos') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <Users className="w-[18px] h-[18px] shrink-0" /> 
              {!isCollapsed && <span>Alumnos</span>}
            </Link>
            <Link to="/docentes" title="Sincronización Docente" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive('/docentes') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <RefreshCcw className="w-[18px] h-[18px] shrink-0" /> 
              {!isCollapsed && <span>Sincronización Docente</span>}
            </Link>
            <Link to="/horarios" title="Grupos y Horarios" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive('/horarios') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <CalendarDays className="w-[18px] h-[18px] shrink-0" /> 
              {!isCollapsed && <span>Grupos y Horarios</span>}
            </Link>
            <Link to="/reportes" title="Boletas y Listas" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive('/reportes') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <FileText className="w-[18px] h-[18px] shrink-0" /> 
              {!isCollapsed && <span>Boletas y Listas</span>}
            </Link>
          </nav>
        </div>

        {isCollapsed && (
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
            <span className="font-bold text-sm tracking-wide">SESA Admin</span>
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

    </div>
  );
};

export default AdminLayout;