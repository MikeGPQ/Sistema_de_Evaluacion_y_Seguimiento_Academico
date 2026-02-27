import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { Hammer } from 'lucide-react'; 

// Páginas
import LoginPage from '../pages/LoginPage';
import ImportarAlumnos from '../pages/Alumnos/ImportarAlumnos';
import ListadoAlumnos from '../pages/Alumnos/ListadoAlumnos';
import CambiarEstatusAlumno from '../pages/Alumnos/CambiarEstatusAlumno';

// Layouts
import AdminLayout from '../layouts/AdminLayout'; 
import AlumnoLayout from '../layouts/AlumnoLayout';
import DocenteLayout from '../layouts/DocenteLayout';

// ==========================================
// COMPONENTES REUTILIZABLES
// ==========================================

const EnConstruccion = ({ modulo }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[80vh] bg-[#F8F9FA] text-center px-4">
      <div className="w-20 h-20 bg-blue-100 text-[#1A237E] rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Hammer className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Módulo en Construcción</h2>
      <p className="text-gray-500 max-w-md">
        El módulo de <span className="font-semibold text-[#1A237E]">{modulo}</span> se encuentra actualmente en fase de desarrollo. Estará disponible próximamente.
      </p>
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

// Componente Guardián de Rutas
const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // Validamos que el usuario esté en su área permitida
  if (user?.role !== allowedRole) {
    if (user?.role === 'admin') return <Navigate to="/alumnos/listado" replace />;
    if (user?.role === 'alumno') return <Navigate to="/alumno/horario" replace />;
    if (user?.role === 'docente') return <Navigate to="/docente/pase-lista" replace />; 
    return <Navigate to="/login" replace />;
  }

  return children;
};

// ==========================================
// RUTAS PRINCIPALES DE LA APLICACIÓN
// ==========================================
const AppRoutes = () => {
  const { isAuthenticated, user, loading } = useAuth();

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
        
        {/* LOGIN DINÁMICO MULTI-ROL */}
        <Route 
          path="/login" 
          element={
            !isAuthenticated ? <LoginPage /> : 
            user?.role === 'admin' ? <Navigate to="/alumnos/listado" /> : 
            user?.role === 'docente' ? <Navigate to="/docente/pase-lista" /> :
            <Navigate to="/alumno/horario" /> 
          } 
        />

        {/* ========================================== */}
        {/* ZONA DE ADMINISTRADOR (Protegida)          */}
        {/* ========================================== */}
        <Route element={<ProtectedRoute allowedRole="admin"><AdminLayout /></ProtectedRoute>}>
          <Route path="/alumnos/listado" element={<ListadoAlumnos />} />
          <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
          <Route path="/alumnos/cambiar-estatus" element={<CambiarEstatusAlumno />} />
          
          {/* Módulos de Admin pendientes */}
          <Route path="/docentes" element={<EnConstruccion modulo="Sincronización Docente" />} />
          <Route path="/horarios" element={<EnConstruccion modulo="Grupos y Horarios" />} />
          <Route path="/reportes" element={<EnConstruccion modulo="Boletas y Listas" />} />
        </Route>

        {/* ========================================== */}
        {/* ZONA DE DOCENTE (Protegida)                */}
        {/* ========================================== */}
        <Route path="/docente" element={<ProtectedRoute allowedRole="docente"><DocenteLayout /></ProtectedRoute>}>
          <Route path="pase-lista" element={<EnConstruccion modulo="Pase de Lista Digital" />} />
          <Route path="calificaciones" element={<EnConstruccion modulo="Captura de Calificaciones" />} />
          <Route path="actas" element={<EnConstruccion modulo="Generación de Actas Oficiales" />} />
        </Route>

        {/* ========================================== */}
        {/* ZONA DE ALUMNO (Protegida)                 */}
        {/* ========================================== */}
        <Route path="/alumno" element={<ProtectedRoute allowedRole="alumno"><AlumnoLayout /></ProtectedRoute>}>
          <Route path="horario" element={<EnConstruccion modulo="Mi Horario" />} />
          <Route path="asistencias" element={<EnConstruccion modulo="Mis Asistencias" />} />
          <Route path="calificaciones" element={<EnConstruccion modulo="Mis Calificaciones" />} />
        </Route>

        {/* ========================================== */}
        {/* RUTAS GLOBALES                             */}
        {/* ========================================== */}
        <Route path="/change-password" element={<ChangePasswordPage />} />
        
        {/* REDIRECCIÓN RAÍZ */}
        <Route path="/" element={
          !isAuthenticated ? <Navigate to="/login" /> : 
          user?.role === 'admin' ? <Navigate to="/alumnos/listado" /> : 
          user?.role === 'docente' ? <Navigate to="/docente/pase-lista" /> :
          <Navigate to="/alumno/horario" /> 
        } />

        {/* CATCH-ALL (Cualquier ruta inválida regresa al inicio) */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;