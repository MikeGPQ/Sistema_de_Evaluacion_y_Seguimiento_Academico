import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, HelpCircle, Globe, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import client from '../lib/axios';

const LoginPage = () => {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanIdentifier = credentials.identifier;

    if (!cleanIdentifier || !credentials.password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    const isExactLength = /^\d{8}$/.test(cleanIdentifier);
    if (!isExactLength) {
      setError('El ID institucional debe tener exactamente 8 números.');
      return;
    }

    if (!cleanIdentifier || !credentials.password.trim()) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await client.post('/auth/login', {
        identifier: cleanIdentifier,
        password: credentials.password 
      });

      authLogin(response.data);

      if (response.data?.is_temp_password) {
        navigate('/change-password?forced=1');
        return;
      }

      if (response.data?.role?.name === 'admin') navigate('/alumnos/listado');
      else if (response.data?.role?.name === 'docente') navigate('/docente/pase-lista');
      else navigate('/alumno/horario');

    } catch (err) {
      setError('ID o contraseña incorrectos');
      console.error("Detalle técnico del error:", err.response?.data || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // HU-31: requiere contraseña actual, por eso debe existir sesión
  const handleForgotPassword = (e) => {
    e.preventDefault();
    setError('');

    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      setError('Para cambiar tu contraseña debes iniciar sesión primero.');
      return;
    }

    const u = JSON.parse(savedUser);

    if (u?.is_temp_password) {
      navigate('/change-password?forced=1');
    } else {
      navigate('/change-password');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative font-sans">

      <div className="absolute top-6 right-8 hidden md:block">
        <a href="#" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors font-medium">
          <Globe size={14} /> Sitio Web UNID
        </a>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-[420px] overflow-hidden border border-gray-100 flex flex-col">

          <div className="bg-[#0B172A] pt-8 pb-7 px-8 flex flex-col items-center justify-center text-white">
            <div className="flex items-center gap-3">
              <GraduationCap size={32} className="text-white" />
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-wide leading-none">UNID</span>
                <span className="text-[8px] uppercase tracking-[0.2em] mt-0.5 text-gray-300">
                  Universidad Interamericana
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 pb-10 flex flex-col text-center">
            <h1 className="text-[22px] font-bold text-[#1A1A1A] mb-1">Portal de Alumnos</h1>
            <p className="text-sm text-gray-500 mb-8 font-medium">Ingresa tus credenciales para continuar</p>

            <form onSubmit={handleLogin} className="space-y-5 text-left flex flex-col">

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide ml-0.5">
                  ID
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0B172A] transition-colors" />
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="ej. 00123456"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A] transition-all text-sm text-gray-800 placeholder:text-gray-400"
                    value={credentials.identifier}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value.replace(/\D/g, '');
                      setCredentials({ ...credentials, identifier: onlyNumbers });
                      if (error) setError('');
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wide ml-0.5">
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0B172A] transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A] transition-all text-sm text-gray-800 placeholder:text-gray-400 tracking-widest"
                    onChange={(e) => {
                      setCredentials({ ...credentials, password: e.target.value });
                      if (error) setError('');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 mb-2 gap-3">
                <span className="text-xs text-gray-400 font-medium">
                  Si es tu primer acceso, al ingresar se te pedirá cambiar contraseña.
                </span>

                <a
                  href="#"
                  onClick={handleForgotPassword}
                  className="text-xs text-gray-500 hover:text-[#0B172A] font-medium transition-colors whitespace-nowrap"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-center animate-in fade-in">
                  <p className="text-red-600 text-xs font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 bg-[#F2A900] hover:bg-[#E59F00] text-[#1A1A1A] font-bold rounded-lg flex items-center justify-center gap-2 transition-transform shadow-sm text-sm ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
              >
                {isLoading ? 'Verificando...' : 'Ingresar al Portal'} <ArrowRight size={16} className="ml-1" />
              </button>
            </form>

          </div>
        </div>
      </div>

      <footer className="w-full p-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-400 gap-4">
        <p>© 2026 Universidad Interamericana para el Desarrollo. Todos los derechos reservados.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-gray-600">Aviso de Privacidad</a>
          <a href="#" className="hover:text-gray-600">Términos de Uso</a>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;