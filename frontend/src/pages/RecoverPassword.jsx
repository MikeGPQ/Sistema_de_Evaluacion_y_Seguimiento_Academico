import React, { useState } from 'react';
import { Mail, KeyRound, ArrowRight, ArrowLeft, GraduationCap, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../lib/axios';

const RecoverPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleRequestCode = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Ingresa tu correo electrónico');
      return;
    }

    // Validación estricta: Solo acepta formato de correo
    const isCorreoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isCorreoValido) {
      setError('Formato inválido. Ingresa un correo electrónico válido.');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      // Mandamos el correo en el campo identifier que espera el backend
      await client.post('/auth/forgot-password', { identifier: email });
      setMsg('Se ha enviado un código de 6 dígitos a tu correo.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ocurrió un error al solicitar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return setError('El código debe tener 6 dígitos');
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/validate-reset-code', { identifier: email, code });
      navigate('/change-password', { 
        state: { isRecovery: true, identifier: res.data.identifier, code: code } 
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Código inválido o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-[20px] shadow-sm w-full max-w-[420px] overflow-hidden border border-gray-100 flex flex-col">
          
          <div className="bg-[#0B172A] py-6 px-8 flex flex-col items-center justify-center text-white">
            <GraduationCap size={32} />
            <span className="text-xl font-black mt-2">Recuperar Acceso</span>
          </div>

          <div className="p-8 pb-10 flex flex-col">
            {step === 1 ? (
              <form onSubmit={handleRequestCode} className="space-y-5">
                <p className="text-sm text-gray-500 text-center mb-4">Ingresa tu correo institucional o personal y te enviaremos un código de validación.</p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase">Correo electrónico</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="ej. alumno@red.unid.mx"
                      value={email}
                      onChange={(e) => {
                        const sinEspacios = e.target.value.replace(/\s/g, '');
                        setEmail(sinEspacios);
                        if (error) setError('');
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A]"
                    />
                  </div>
                </div>
                {error && <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-2 rounded">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3 bg-[#F2A900] hover:bg-[#E59F00] font-bold rounded-lg flex justify-center items-center gap-2 text-sm transition-colors shadow-sm">
                  {loading ? 'Enviando...' : 'Recibir Código'} <ArrowRight size={16} />
                </button>
                <button type="button" onClick={() => navigate('/login')} className="w-full text-xs text-gray-500 hover:text-black font-bold text-center mt-2 flex justify-center items-center gap-1">
                  <ArrowLeft size={14} /> Volver al Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleValidateCode} className="space-y-5">
                {msg && <p className="text-green-700 text-[11px] font-bold text-center bg-green-50 p-2 rounded mb-2 border border-green-100">{msg}</p>}
                
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold text-gray-400">Enviado a:</span>
                        <span className="text-xs font-semibold text-[#0B172A] truncate max-w-[180px]" title={email}>{email}</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        <Edit3 size={14} /> Editar
                    </button>
                </div>

                <p className="text-sm text-gray-500 text-center mb-2">Ingresa el código de 6 dígitos que recibiste.</p>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase">Código de seguridad</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-center text-xl tracking-[0.5em] font-bold focus:ring-1 focus:ring-[#0B172A] focus:border-[#0B172A]"
                    />
                  </div>
                </div>
                {error && <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-2 rounded">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3 bg-[#0B172A] hover:bg-gray-800 text-white font-bold rounded-lg flex justify-center items-center gap-2 text-sm transition-colors shadow-md">
                  {loading ? 'Validando...' : 'Verificar Código'} <ArrowRight size={16} />
                </button>
                
                <p className="text-[10px] text-gray-400 text-center mt-4">
                    ¿No recibiste el código? Revisa tu carpeta de spam o intenta editar el correo.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoverPassword;