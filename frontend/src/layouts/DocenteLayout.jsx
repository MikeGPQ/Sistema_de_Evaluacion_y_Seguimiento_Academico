import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  ClipboardList, 
  FileEdit, 
  FileCheck,
  LogOut 
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';

const DocenteLayout = () => {
  const location = useLocation();
  const { logout } = useAuth(); 

  const isActive = (path) => location.pathname.includes(path);

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans overflow-hidden">
      
      {/* SIDEBAR LATERAL */}
      <aside className="w-[260px] bg-[#0B172A] text-white flex flex-col flex-shrink-0 shadow-xl z-20">
        
        {/* Logo Institucional */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#070e1a]">
          <div className="w-7 h-7 bg-[#F2A900] rounded text-[#0B172A] flex items-center justify-center font-black text-sm mr-3 shadow-sm">
            U
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-wide leading-tight">SESA Docente</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest">Campus Campeche</span>
          </div>
        </div>

        {/* Menú de Navegación del Docente */}
        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
          <nav className="space-y-1.5">
            <Link to="/docente/pase-lista" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/pase-lista') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <ClipboardList className="w-[18px] h-[18px]" /> Pase de Lista
            </Link>
            <Link to="/docente/calificaciones" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/calificaciones') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <FileEdit className="w-[18px] h-[18px]" /> Calificaciones
            </Link>
            <Link to="/docente/actas" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/actas') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <FileCheck className="w-[18px] h-[18px]" /> Generar Actas
            </Link>
          </nav>
        </div>

        {/* User Profile / Logout */}
        <div className="p-4 border-t border-slate-800 bg-[#070e1a] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#10B981] flex items-center justify-center text-white font-bold text-xs shrink-0 border border-emerald-400">
              PR
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold truncate text-white">Profesor</span>
              <span className="text-[10px] text-slate-400 truncate">Plantilla Activa</span>
            </div>
          </div>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Cerrar Sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO DINÁMICO */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto">
          <Outlet /> 
        </div>
      </main>

    </div>
  );
};

export default DocenteLayout;