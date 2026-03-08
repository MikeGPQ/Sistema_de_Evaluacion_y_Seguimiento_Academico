import React from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  IdCard,
  KeyRound,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";
import { useAuth } from "../hooks/AuthContext";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const roleName = user?.role?.name || "usuario";

  const fullName =
    user?.full_name ||
    user?.nombre_completo ||
    user?.name ||
    user?.nombre ||
    user?.username ||
    "Nombre no disponible";

  const userId =
    user?.id ||
    user?.user_id ||
    user?.identifier ||
    "No disponible";

  const matricula =
    user?.matricula ||
    user?.enrollment ||
    user?.student_code ||
    user?.identifier ||
    "No disponible";

  const email =
    user?.personal_email ||
    user?.email ||
    user?.correo ||
    user?.correo_personal ||
    "No disponible";

  const photo =
    user?.photo_url ||
    user?.photo ||
    user?.avatar ||
    user?.foto ||
    null;

  const getRoleLabel = (role) => {
    if (role === "admin") return "Administrador";
    if (role === "docente") return "Docente";
    if (role === "alumno") return "Alumno";
    return "Usuario";
  };

  const getInitials = (name) => {
    if (!name || name === "Nombre no disponible") return "US";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  };

  const goBackByRole = () => {
    if (roleName === "admin") return navigate("/alumnos/listado");
    if (roleName === "docente") return navigate("/docente/pase-lista");
    return navigate("/alumno/horario");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-[760px] overflow-hidden border border-gray-100">
          <div className="bg-[#0B172A] px-8 py-8 text-white">
            <h1 className="text-2xl font-bold">Mi Perfil</h1>
            <p className="text-sm text-gray-300 mt-1">
              Consulta tu información personal y administra tus credenciales.
            </p>
          </div>

          <div className="p-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-[220px] flex flex-col items-center">
                {photo ? (
                  <img
                    src={photo}
                    alt="Foto de perfil"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-sm"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-100 shadow-sm flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-500">
                      {getInitials(fullName)}
                    </span>
                  </div>
                )}

                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wide">
                  <BadgeCheck size={14} />
                  {getRoleLabel(roleName)}
                </div>
              </div>

              <div className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                      Nombre completo
                    </p>
                    <p className="text-sm text-gray-800 font-semibold break-words">
                      {fullName}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                      <IdCard size={14} />
                      ID
                    </p>
                    <p className="text-sm text-gray-800 font-semibold break-words">
                      {userId}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                      Matrícula
                    </p>
                    <p className="text-sm text-gray-800 font-semibold break-words">
                      {matricula}
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                      <Mail size={14} />
                      Correo personal
                    </p>
                    <p className="text-sm text-gray-800 font-semibold break-all">
                      {email}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/change-password")}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#F2A900] hover:bg-[#E59F00] text-[#1A1A1A] font-bold rounded-lg transition-transform active:scale-[0.98] text-sm"
                  >
                    <KeyRound size={16} />
                    Cambiar contraseña
                  </button>

                  <button
                    type="button"
                    onClick={goBackByRole}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-lg transition-colors text-sm"
                  >
                    <ArrowLeft size={16} />
                    Regresar
                  </button>
                </div>

                <div className="mt-6 bg-[#FFF7D6] border border-[#FFE7A3] rounded-lg px-4 py-3">
                  <p className="text-[12px] text-[#8A6A00] font-medium">
                    Verifica que tus datos sean correctos. Si deseas actualizar
                    tus credenciales, usa el botón de cambio de contraseña.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full p-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-400 gap-4">
        <p>
          © 2026 Universidad Interamericana para el Desarrollo. Todos los
          derechos reservados.
        </p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-gray-600">
            Aviso de Privacidad
          </a>
          <a href="#" className="hover:text-gray-600">
            Términos de Uso
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Profile;