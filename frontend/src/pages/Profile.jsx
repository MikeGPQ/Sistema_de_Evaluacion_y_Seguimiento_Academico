import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  IdCard,
  KeyRound,
  BadgeCheck,
} from "lucide-react";
import { useAuth } from "../hooks/AuthContext";
import Modal from "../components/ui/Modal"; 

const Profile = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const roleName = user?.role?.name || "usuario";

  useEffect(() => { setImgError(false); }, [user?.foto_id]);

  const fullName =
    user?.full_name ||
    user?.nombre_completo ||
    user?.name ||
    user?.nombre ||
    user?.username ||
    "Nombre no disponible";

  const identifier = user?.identifier || "No disponible";
  const emailPersonal = user?.email_personal || null;
  const emailInstitucional = user?.email_institucional || null;
  const hasEmails = roleName === "admin" || roleName === "super_admin" || roleName === "alumno" || roleName === "docente";

  const photo =
    (roleName === "alumno" && user?.foto_id)
      ? `${import.meta.env.VITE_API_URL}files/${user.foto_id}`
      : null;

  const getRoleLabel = (role) => {
    if (role === "super_admin") return "Super Administrador";
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

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-[#0B172A] p-6 rounded-t-lg -mx-6 -mt-6 mb-6">
        <button onClick={onClose} className="flex items-center text-slate-300 hover:text-white text-sm mb-3 transition-colors font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Cerrar perfil
        </button>
        <h2 className="text-2xl font-bold text-white">Mi Perfil</h2>
        <p className="text-sm text-slate-300 mt-1">
          Consulta tu información personal y administra tus credenciales.
        </p>
      </div>

      <div className="p-2 md:p-6 bg-slate-50 rounded-lg">
        <div className="flex flex-col lg:flex-row gap-8 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="w-full lg:w-[220px] flex flex-col items-center">
            {photo && !imgError ? (
              <img
                src={photo}
                alt="Foto de perfil"
                onError={() => setImgError(true)}
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
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Nombre completo</p>
                <p className="text-sm text-gray-800 font-semibold break-words">{fullName}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                  <IdCard size={14} />Matrícula / ID
                </p>
                <p className="text-sm text-gray-800 font-semibold break-words">{identifier}</p>
              </div>

              {hasEmails && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                    <Mail size={14} />Correo personal
                  </p>
                  <p className="text-sm text-gray-800 font-semibold break-all">{emailPersonal || "No disponible"}</p>
                </div>
              )}

              {hasEmails && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-2">
                    <Mail size={14} />Correo institucional
                  </p>
                  <p className="text-sm text-gray-800 font-semibold break-all">{emailInstitucional || "No disponible"}</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/change-password");
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#F2A900] hover:bg-[#E59F00] text-[#1A1A1A] font-bold rounded-lg transition-transform active:scale-[0.98] text-sm"
              >
                <KeyRound size={16} />
                Cambiar contraseña
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-lg transition-colors text-sm"
              >
                Cerrar Perfil
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
    </Modal>
  );
};

export default Profile;