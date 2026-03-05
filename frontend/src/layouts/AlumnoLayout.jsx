import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  CalendarDays, 
  CheckSquare, 
  Award, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';

const AlumnoLayout = () => {
  const location = useLocation();
  const { logout } = useAuth(); 

  const isActive = (path) => location.pathname.includes(path);

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans overflow-hidden">
      
      {/* SIDEBAR LATERAL (Estilo SESA) */}
      <aside className="w-[260px] bg-[#0B172A] text-white flex flex-col flex-shrink-0 shadow-xl z-20">
        
        {/* Logo Institucional */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#070e1a]">
          <div className="w-7 h-7 bg-[#F2A900] rounded text-[#0B172A] flex items-center justify-center font-black text-sm mr-3 shadow-sm">
            U
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-wide leading-tight">SESA Alumno</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest">Campus Campeche</span>
          </div>
        </div>

        {/* Menú de Navegación del Estudiante */}
        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
          <nav className="space-y-1.5">
            <Link to="/alumno/horario" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/horario') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <CalendarDays className="w-[18px] h-[18px]" /> Mi Horario
            </Link>
            <Link to="/alumno/asistencias" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/asistencias') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <CheckSquare className="w-[18px] h-[18px]" /> Mis Asistencias
            </Link>
            <Link to="/alumno/calificaciones" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive('/calificaciones') ? 'bg-[#1A237E] text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <Award className="w-[18px] h-[18px]" /> Mis Calificaciones
            </Link>
          </nav>
        </div>

        {/* User Profile / Logout */}
        <div className="p-4 border-t border-slate-800 bg-[#070e1a] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#00AEEF] flex items-center justify-center text-white font-bold text-xs shrink-0 border border-cyan-400">
              AL
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold truncate text-white">Estudiante</span>
              <span className="text-[10px] text-slate-400 truncate">Portal Académico</span>
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

export default AlumnoLayout;