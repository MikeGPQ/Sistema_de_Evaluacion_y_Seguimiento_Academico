import React from 'react';
import { HardHat, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/AuthContext';

const PortalAlumno = () => {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <HardHat className="w-10 h-10 text-blue-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          ¡Hola, {user?.email || 'Alumno'}!
        </h1>
        <h2 className="text-lg font-semibold text-blue-600 mb-4">
          Portal en Construcción
        </h2>
        
        <p className="text-gray-600 mb-8 text-sm leading-relaxed">
          Estamos trabajando en el módulo de estudiantes de SESA para que pronto puedas consultar tu carga académica, calificaciones y estatus de manera sencilla. ¡Vuelve pronto!
        </p>

        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default PortalAlumno;