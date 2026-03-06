import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/AuthContext";
import { Hammer } from "lucide-react";

// Páginas
import LoginPage from "../pages/LoginPage";
import ChangePassword from "../pages/ChangePassword";
import RecoverPassword from "../pages/RecoverPassword"; // <-- NUEVO COMPONENTE IMPORTADO

// Admin
import ImportarAlumnos from "../pages/Alumnos/ImportarAlumnos";
import ListadoAlumnos from "../pages/Alumnos/ListadoAlumnos";
import CambiarEstatusAlumno from "../pages/Alumnos/CambiarEstatusAlumno";

// Layouts
import AdminLayout from "../layouts/AdminLayout";
import AlumnoLayout from "../layouts/AlumnoLayout";
import DocenteLayout from "../layouts/DocenteLayout";

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

// Guardián de rutas
const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ✅ HU-31: forzar cambio si es temporal
  if (user?.is_temp_password) return <Navigate to="/change-password?forced=1" replace />;

  if (allowedRole && user?.role?.name !== allowedRole) {
    if (user?.role?.name === "admin") return <Navigate to="/alumnos/listado" replace />;
    if (user?.role?.name === "alumno") return <Navigate to="/alumno/horario" replace />;
    if (user?.role?.name === "docente") return <Navigate to="/docente/pase-lista" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

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
        {/* LOGIN */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <LoginPage />
            ) : user?.is_temp_password ? (
              <Navigate to="/change-password?forced=1" replace />
            ) : user?.role?.name === "admin" ? (
              <Navigate to="/alumnos/listado" replace />
            ) : user?.role?.name === "docente" ? (
              <Navigate to="/docente/pase-lista" replace />
            ) : (
              <Navigate to="/alumno/horario" replace />
            )
          }
        />

        {/* --- HU-32: RECUPERACIÓN DE CONTRASEÑA --- */}
        {/* Ruta pública para solicitar y validar el código por correo */}
        <Route
          path="/recover-password"
          element={!isAuthenticated ? <RecoverPassword /> : <Navigate to="/" replace />}
        />

        {/* --- HU-31 & HU-32: CAMBIO DE CONTRASEÑA --- */}
        {/* Liberamos el candado de isAuthenticated para que los usuarios sin sesión 
            puedan entrar si vienen del flujo de recuperación con su código validado */}
        <Route
          path="/change-password"
          element={<ChangePassword />}
        />

        {/* ADMIN */}
        <Route element={<ProtectedRoute allowedRole="admin"><AdminLayout /></ProtectedRoute>}>
          <Route path="/alumnos/listado" element={<ListadoAlumnos />} />
          <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
          <Route path="/alumnos/cambiar-estatus" element={<CambiarEstatusAlumno />} />

          <Route path="/docentes" element={<EnConstruccion modulo="Sincronización Docente" />} />
          <Route path="/horarios" element={<EnConstruccion modulo="Grupos y Horarios" />} />
          <Route path="/reportes" element={<EnConstruccion modulo="Boletas y Listas" />} />
        </Route>

        {/* DOCENTE */}
        <Route path="/docente" element={<ProtectedRoute allowedRole="docente"><DocenteLayout /></ProtectedRoute>}>
          <Route path="pase-lista" element={<EnConstruccion modulo="Pase de Lista Digital" />} />
          <Route path="calificaciones" element={<EnConstruccion modulo="Captura de Calificaciones" />} />
          <Route path="actas" element={<EnConstruccion modulo="Generación de Actas Oficiales" />} />
        </Route>

        {/* ALUMNO */}
        <Route path="/alumno" element={<ProtectedRoute allowedRole="alumno"><AlumnoLayout /></ProtectedRoute>}>
          <Route path="horario" element={<EnConstruccion modulo="Mi Horario" />} />
          <Route path="asistencias" element={<EnConstruccion modulo="Mis Asistencias" />} />
          <Route path="calificaciones" element={<EnConstruccion modulo="Mis Calificaciones" />} />
        </Route>

        {/* ROOT */}
        <Route
          path="/"
          element={
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : user?.is_temp_password ? (
              <Navigate to="/change-password?forced=1" replace />
            ) : user?.role?.name === "admin" ? (
              <Navigate to="/alumnos/listado" replace />
            ) : user?.role?.name === "docente" ? (
              <Navigate to="/docente/pase-lista" replace />
            ) : (
              <Navigate to="/alumno/horario" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;