import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { UserPlus, FileSpreadsheet, LogOut } from 'lucide-react';
import LoginPage from '../pages/LoginPage';
import ImportarAlumnos from '../pages/Alumnos/ImportarAlumnos';
import ManualRegister from '../components/form/ManualRegister';
import { useAuth } from '../hooks/AuthContext'; 

const DashboardAlumnos = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
          <p className="text-sm text-gray-500">Bienvenido, {user?.identifier || 'Admin'} ({user?.role || 'Dev'})</p>
        </div>

        <div className="flex gap-3 items-center">
          <Link 
            to="/admin/import" 
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
          >
            <FileSpreadsheet size={20} />
            Importar Excel
          </Link>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
          >
            <UserPlus size={20} />
            Nuevo Ingreso
          </button>

          <button 
            onClick={logout}
            className="ml-4 text-red-500 hover:text-red-700 font-bold p-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white h-96 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-400">
        <div className="p-4 bg-gray-50 rounded-full mb-4">
          <UserPlus size={40} className="text-gray-300" />
        </div>
        <p className="font-medium">Tabla de Alumnos (Próximamente)</p>
      </div>

      <ManualRegister isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

const ChangePasswordPage = () => {
  const { logout } = useAuth();
  return (
    <div className="p-8 bg-amber-50 min-h-screen flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-amber-700 mb-2">Cambio de Contraseña Obligatorio</h1>
      <button onClick={logout} className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold">Cerrar Sesión</button>
    </div>
  );
};

const AppRoutes = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} 
        />

        <Route path="/" element={
          isAuthenticated ? <DashboardAlumnos /> : <Navigate to="/login" />
        } />

        <Route 
          path="/admin" 
          element={isAuthenticated ? <DashboardAlumnos /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin/import" 
          element={isAuthenticated ? <ImportarAlumnos /> : <Navigate to="/login" />} 
        />
        
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;