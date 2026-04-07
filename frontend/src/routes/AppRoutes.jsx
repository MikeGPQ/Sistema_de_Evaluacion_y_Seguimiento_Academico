import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/AuthContext";
import { Hammer } from "lucide-react";
import ReporteAsistencia from "../pages/ReporteAsistencia";
// Páginas
import LoginPage from "../pages/LoginPage";
import ChangePassword from "../pages/ChangePassword";
import RecoverPassword from "../pages/RecoverPassword";

// Admin
import ImportarAlumnos from "../pages/Alumnos/ImportarAlumnos";
import ListadoAlumnos from "../pages/Alumnos/ListadoAlumnos";
import CambiarEstatusAlumno from "../pages/Alumnos/CambiarEstatusAlumno";
import GruposYHorarios from "../pages/GruposyHorarios/GrupoyHorarios";
import MiHorario from "../pages/Alumnos/MiHorario";
import StudentAttendance from '../pages/Alumnos/StudentAttendance'; 
import MiCargaAcademica from "../pages/GruposyHorarios/MiCargaAcademica"; 

// Super Admin
import ListadoAdministradores from "../pages/Administradores/ListadoAdministradores";
import AuditLogs from "../pages/Administradores/AuditLogs";
import Boletas from "../pages/Administradores/Boletas";
import SincronizacionSigad from "../pages/Administradores/SincronizacionSigad";

// Docentes
import Calificaciones from "../pages/Docentes/Calificaciones";
import ReportesDocente from "../pages/Docentes/ReportCards";

// Layouts
import AdminLayout from "../layouts/AdminLayout";
import AlumnoLayout from "../layouts/AlumnoLayout";
import DocenteLayout from "../layouts/DocenteLayout";
import MisCalificaciones from "../pages/Alumnos/MisCalificaciones";
// Docente
import AsistenciaDocente from "../pages/Docentes/AsistenciaDocente";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.is_temp_password) return <Navigate to="/change-password?forced=1" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.role?.name)) {
    if (user?.role?.name === "admin" || user?.role?.name === "super_admin") return <Navigate to="/alumnos/listado" replace />;
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
            ) : (user?.role?.name === "admin" || user?.role?.name === "super_admin") ? (
              <Navigate to="/alumnos/listado" replace />
            ) : user?.role?.name === "docente" ? (
              <Navigate to="/docente/pase-lista" replace />
            ) : (
              <Navigate to="/alumno/horario" replace />
            )
          }
        />

        <Route
          path="/recover-password"
          element={!isAuthenticated ? <RecoverPassword /> : <Navigate to="/" replace />}
        />

        <Route
          path="/change-password"
          element={<ChangePassword />}
        />

        {/* ADMIN & SUPER ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminLayout /></ProtectedRoute>}>
          
          <Route path="/boletas" element={<Boletas />} />
          <Route path="/alumnos/listado" element={<ListadoAlumnos />} />
          <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
          <Route path="/alumnos/cambiar-estatus" element={<CambiarEstatusAlumno />} />
          <Route path="/horarios" element={<GruposYHorarios />} />
          <Route path="/reportes/asistencia" element={<ReporteAsistencia />} />
        </Route>
        {/* SUPER ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminLayout /></ProtectedRoute>}>
          <Route path="/administradores/listado" element={<ListadoAdministradores />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
          <Route path="/admin/sincronizacion-sigad" element={<SincronizacionSigad />} />
        </Route>
        
        {/* DOCENTE */}
        <Route path="/docente" element={<ProtectedRoute allowedRoles={["docente"]}><DocenteLayout /></ProtectedRoute>}>
          <Route path="pase-lista" element={<AsistenciaDocente />} />
          <Route path="calificaciones" element={<Calificaciones />} />
         <Route path="actas" element={<ReportesDocente />} />
        </Route>

         {/* ALUMNO */}
        <Route path="/alumno" element={<ProtectedRoute allowedRoles={["alumno"]}><AlumnoLayout /></ProtectedRoute>}>
          <Route path="horario" element={<MiHorario />} />
          <Route path="calificaciones" element={<MisCalificaciones />} />
          <Route path="asistencias" element={<StudentAttendance />} />
          <Route path="carga-academica" element={<MiCargaAcademica />} />
        </Route>

        {/* ROOT */}
        <Route
          path="/"
          element={
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : user?.is_temp_password ? (
              <Navigate to="/change-password?forced=1" replace />
            ) : (user?.role?.name === "admin" || user?.role?.name === "super_admin") ? (
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