import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  GraduationCap,
  LogOut,
} from "lucide-react";
import client from "../lib/axios";
import { useAuth } from "../hooks/AuthContext";

const ChangePassword = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isRecovery = location.state?.isRecovery || false;
  const recoveryCode = location.state?.code || "";
  const recoveryIdentifier = location.state?.identifier || "";

  const forced = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("forced") === "1";
  }, [location.search]);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const identifier = user?.identifier || recoveryIdentifier;

  const goHomeByRole = (role) => {
    if (role?.name === "admin") return navigate("/alumnos/listado");
    if (role?.name === "docente") return navigate("/docente/pase-lista");
    return navigate("/alumno/horario");
  };

  const validatePasswordStrength = (password) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!password) {
      return "La nueva contraseña es obligatoria.";
    }
    if (!regex.test(password)) {
      return "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";
    }
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");

    if (!identifier) {
      setError("No hay sesión activa ni proceso de recuperación.");
      return;
    }

    const passwordError = validatePasswordStrength(form.new_password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!isRecovery && form.current_password === form.new_password) {
      setError("La nueva contraseña no puede ser igual a la contraseña actual.");
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    setLoading(true);
    try {
      if (isRecovery) {
        await client.post("/auth/reset-password", {
          identifier,
          code: recoveryCode,
          new_password: form.new_password,
          confirm_password: form.confirm_password,
        });

        setOk("Contraseña recuperada exitosamente. Redirigiendo al login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);

      } else {
        await client.put("/auth/change-password", {
          identifier,
          current_password: form.current_password,
          new_password: form.new_password,
          confirm_password: form.confirm_password,
        });

        updateUser({ ...user, is_temp_password: false });
        setOk("Contraseña actualizada exitosamente.");
        setForm({ current_password: "", new_password: "", confirm_password: "" });

        setTimeout(() => {
          goHomeByRole(user?.role);
        }, 700);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        "No se pudo actualizar la contraseña. Verifica los datos.";
      setError(msg);
      console.error("Error change-password:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    if (forced) return;
    goHomeByRole(user?.role);
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative font-sans">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-[520px] overflow-hidden border border-gray-100 flex flex-col">
          <div className="bg-[#0B172A] pt-8 pb-7 px-8 flex flex-col items-center justify-center text-white">
            <div className="flex items-center gap-3">
              <GraduationCap size={32} className="text-white" />
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-wide leading-none">
                  UNID
                </span>
                <span className="text-[8px] uppercase tracking-[0.2em] mt-0.5 text-gray-300">
                  Universidad Interamericana
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 pb-10 flex flex-col text-center">
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1">
              {isRecovery ? "Restablecer Contraseña" : "Cambio de Contraseña"}
            </h1>

            {forced ? (
              <div className="mt-4 mb-6 rounded-lg border border-[#FFE7A3] bg-[#FFF7D6] px-4 py-3 text-left">
                <p className="text-sm font-bold text-[#8A6A00]">
                  Cambio obligatorio
                </p>
                <p className="text-[12px] text-[#8A6A00] mt-1">
                  Por seguridad, debes cambiar tu contraseña temporal para
                  continuar.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-6 font-medium">
                {isRecovery
                  ? "Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta."
                  : "Actualiza tu contraseña para mantener tu cuenta segura."}
              </p>
            )}

            <form
              onSubmit={onSubmit}
              className="space-y-5 text-left flex flex-col"
            >
              {!isRecovery && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide ml-0.5">
                    Contraseña actual
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0B172A] transition-colors" />
                    <input
                      type={showCurrent ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A] transition-all text-sm text-gray-800 placeholder:text-gray-400 tracking-widest"
                      value={form.current_password}
                      onChange={(e) =>
                        setForm({ ...form, current_password: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      aria-label="Mostrar contraseña actual"
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide ml-0.5">
                  Nueva contraseña
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0B172A] transition-colors" />
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A] transition-all text-sm text-gray-800 placeholder:text-gray-400 tracking-widest"
                    value={form.new_password}
                    onChange={(e) =>
                      setForm({ ...form, new_password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label="Mostrar nueva contraseña"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-[#0B172A] mt-1 font-semibold bg-blue-50 p-2 rounded border border-blue-100">
                  Obligatorio: Mínimo 8 caracteres, incluir al menos una mayúscula, una minúscula, un número y un símbolo.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide ml-0.5">
                  Confirmar nueva contraseña
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0B172A] transition-colors" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    placeholder="Repite la nueva contraseña"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A] transition-all text-sm text-gray-800 placeholder:text-gray-400 tracking-widest"
                    value={form.confirm_password}
                    onChange={(e) =>
                      setForm({ ...form, confirm_password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label="Mostrar confirmación"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-center animate-in fade-in">
                  <p className="text-red-600 text-xs font-bold">{error}</p>
                </div>
              )}

              {ok && (
                <div className="bg-green-50 border border-green-100 p-2.5 rounded-lg text-center animate-in fade-in">
                  <p className="text-green-700 text-xs font-bold">{ok}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 bg-[#F2A900] hover:bg-[#E59F00] text-[#1A1A1A] font-bold rounded-lg flex items-center justify-center gap-2 transition-transform shadow-sm text-sm ${
                  loading
                    ? "opacity-70 cursor-not-allowed"
                    : "active:scale-[0.98]"
                }`}
              >
                {loading ? "Guardando..." : "Actualizar contraseña"}
                <ArrowRight size={16} className="ml-1" />
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[#0B172A] transition-colors"
                >
                  <LogOut size={14} /> {isRecovery ? "Cancelar" : "Cerrar sesión"}
                </button>

                {!isRecovery && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={forced}
                    className={`text-xs font-bold transition-colors ${
                      forced
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-500 hover:text-[#0B172A]"
                    }`}
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="pt-2 text-[11px] text-gray-400 text-center">
                Usuario: <span className="font-bold">{identifier || "—"}</span>
              </div>
            </form>
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

export default ChangePassword;