import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { useAuth } from '../hooks/AuthContext'; 

// --- COMPONENTES TEMPORALES ---
const AdminDashboard = () => <div className="p-8"><h1>Panel de Administrador</h1></div>;
const StudentDashboard = () => <div className="p-8"><h1>Panel de Alumno</h1></div>;
const DocenteDashboard = () => <div className="p-8"><h1>Panel de Docente</h1></div>;
const ChangePasswordPage = () => {
  const { logout } = useAuth();
  return (
    <div className="p-8 bg-amber-50 min-h-screen text-center">
      <h1 className="text-2xl font-bold text-amber-700">Cambio de Contraseña Obligatorio</h1>
      <p className="mb-4">Debes actualizar tu contraseña temporal para continuar.</p>
      <button 
        onClick={logout}
        className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
      >
        Cerrar Sesión y volver al Login
      </button>
    </div>
  );
};

const AppRoutes = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* RUTA PÚBLICA */}
        <Route 
          path="/login" 
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} 
        />

        {/* LÓGICA DE ENRUTAMIENTO (HU-30a) */}
        <Route path="/" element={
          isAuthenticated ? (
            user?.is_temp_password ? (
              <Navigate to="/change-password" />
            ) : (
              <Navigate to={`/${user?.role}`} />
            )
          ) : (
            <Navigate to="/login" />
          )
        } />

        {/* RUTAS PROTEGIDAS */}
        <Route 
          path="/admin" 
          element={isAuthenticated && user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/alumno" 
          element={isAuthenticated && user?.role === 'alumno' ? <StudentDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/docente" 
          element={isAuthenticated && user?.role === 'docente' ? <DocenteDashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/change-password" 
          element={isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" />} 
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;