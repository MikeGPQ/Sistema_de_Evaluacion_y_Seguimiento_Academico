import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Key, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext'; // Para guardar la sesión
import client from '../lib/axios'; // Tu instancia de axios ya configurada

const LoginPage = () => {
  const { login: authLogin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Enviamos el identifier (Matrícula/ID) y password al Backend (HU-30a)
      const response = await client.post('/auth/login', {
        identifier: credentials.identifier,
        password: credentials.password
      });

      // 2. Si es exitoso, guardamos los datos (rol, is_temp_password) en el contexto
      authLogin(response.data);
      
      // Nota: No necesitamos redireccionar manualmente aquí. 
      // AppRoutes detectará el cambio en el AuthContext y hará su magia.
      
    } catch (err) {
      // 3. Criterio HU-30a: Mensaje genérico por seguridad
      setError('Correo o contraseña incorrectos');
      console.error("Detalle técnico del error:", err.response?.data || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl shadow-lg mb-6 text-white">
          <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM3.89 9L12 4.57 20.11 9 12 13.43 3.89 9zM12 15l-6.19-3.37L4.57 13 12 17.05l7.43-4.05-1.24-1.37L12 15z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-2">Sistema Académico</h1>
        <p className="text-slate-500 mb-8 font-medium">Ingresa tus credenciales institucionales</p>

        <form onSubmit={handleLogin} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Matrícula o ID</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text"
                required
                placeholder="Matrícula / Usuario"
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-600"
                onChange={(e) => setCredentials({...credentials, identifier: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Contraseña</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-600"
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded shadow-sm">
               <p className="text-red-700 text-sm font-medium">{error} </p>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
          >
            {isLoading ? 'Verificando...' : 'Iniciar Sesión'} <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-8">
          <a href="#" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800 text-sm">
            <Key size={16} /> ¿Olvidaste tu contraseña? 
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;