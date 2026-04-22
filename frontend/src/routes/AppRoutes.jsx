import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/AuthContext";
import { Hammer } from "lucide-react";
import ReporteAsistencia from "../pages/AttendanceReport";
// Páginas
import LoginPage from "../pages/LoginPage";
import ChangePassword from "../pages/ChangePassword";
import RecoverPassword from "../pages/RecoverPassword";

// Admin
import ImportStudents from "../pages/Students/ImportStudents";
import StudentList from "../pages/Students/StudentList";
import ChangeStudentStatus from "../pages/Students/ChangeStudentStatus";
import GroupAndSchedule from "../pages/GroupsAndSchedules/GroupAndSchedule";
import MySchedule from "../pages/Students/MySchedule";
import StudentAttendance from '../pages/Students/StudentAttendance'; 
import MyAcademicGroups from "../pages/GroupsAndSchedules/MyAcademicGroups"; 

// Super Admin
import AdministratorList from "../pages/Administrators/AdministratorList";
import AuditLogs from "../pages/Administrators/AuditLogs";
import GradeSlips from "../pages/Administrators/GradeSlips";
import SigadSync from "../pages/Administrators/SigadSync";

// Docentes
import Grades from "../pages/Teachers/Grades";
import ReportCards from "../pages/Teachers/ReportCards";

// Layouts
import AdminLayout from "../layouts/AdminLayout";
import StudentLayout from "../layouts/StudentLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import MyGrades from "../pages/Students/MyGrades";
// Docente
import TeacherAttendance from "../pages/Teachers/TeacherAttendance";

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
          
          <Route path="/boletas" element={<GradeSlips />} />
          <Route path="/alumnos/listado" element={<StudentList />} />
          <Route path="/alumnos/importar" element={<ImportStudents />} />
          <Route path="/alumnos/cambiar-estatus" element={<ChangeStudentStatus />} />
          <Route path="/horarios" element={<GroupAndSchedule />} />
          <Route path="/reportes/asistencia" element={<ReporteAsistencia />} />
        </Route>
        {/* SUPER ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminLayout /></ProtectedRoute>}>
          <Route path="/administradores/listado" element={<AdministratorList />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
          <Route path="/admin/sincronizacion-sigad" element={<SigadSync />} />
        </Route>
        
        {/* DOCENTE */}
        <Route path="/docente" element={<ProtectedRoute allowedRoles={["docente"]}><TeacherLayout /></ProtectedRoute>}>
          <Route path="pase-lista" element={<TeacherAttendance />} />
          <Route path="calificaciones" element={<Grades />} />
         <Route path="actas" element={<ReportCards />} />
        </Route>

         {/* ALUMNO */}
        <Route path="/alumno" element={<ProtectedRoute allowedRoles={["alumno"]}><StudentLayout /></ProtectedRoute>}>
          <Route path="horario" element={<MySchedule />} />
          <Route path="calificaciones" element={<MyGrades />} />
          <Route path="asistencias" element={<StudentAttendance />} />
          <Route path="carga-academica" element={<MyAcademicGroups />} />
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