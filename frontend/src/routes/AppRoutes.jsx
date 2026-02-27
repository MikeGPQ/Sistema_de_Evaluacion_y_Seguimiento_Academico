import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import ImportarAlumnos from '../pages/Alumnos/ImportarAlumnos';
import ListadoAlumnos from '../pages/Alumnos/ListadoAlumnos';
import CambiarEstatusAlumno from '../pages/Alumnos/CambiarEstatusAlumno';
import PortalAlumno from '../pages/Alumnos/PortalAlumno'; 
import { useAuth } from '../hooks/AuthContext';

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
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isAlumno = user?.role === 'alumno';

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
            !isAuthenticated ? <LoginPage /> : 
            isAdmin ? <Navigate to="/alumnos/listado" /> : 
            <Navigate to="/portal-alumno" />
          } 
        />

        <Route path="/" element={
          !isAuthenticated ? <Navigate to="/login" /> : 
          isAdmin ? <Navigate to="/alumnos/listado" /> : 
          <Navigate to="/portal-alumno" />
        } />


        <Route 
          path="/alumnos/listado" 
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            isAdmin ? <ListadoAlumnos /> : 
            <Navigate to="/portal-alumno" />
          } 
        />
        
        <Route 
          path="/alumnos/importar" 
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            isAdmin ? <ImportarAlumnos /> : 
            <Navigate to="/portal-alumno" />
          } 
        />

        <Route 
          path="/alumnos/cambiar-estatus" 
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            isAdmin ? <CambiarEstatusAlumno /> : 
            <Navigate to="/portal-alumno" />
          } 
        />


        <Route 
          path="/portal-alumno" 
          element={
            !isAuthenticated ? <Navigate to="/login" /> :
            isAlumno ? <PortalAlumno /> : 
            <Navigate to="/alumnos/listado" />
          } 
        />
        
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;