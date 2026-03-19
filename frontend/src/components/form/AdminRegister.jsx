import { useState, useEffect } from 'react';
import client from '../../lib/axios';
import Modal from '../ui/Modal';
import Swal from 'sweetalert2';
import { useAuth } from '../../hooks/AuthContext';

export default function AdminRegister({ isOpen, onClose, adminAEditar }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [erroresEnVivo, setErroresEnVivo] = useState({ email_personal: '' });
  const [validacionExitosa, setValidacionExitosa] = useState({ email_personal: false });
  const [datosOriginales, setDatosOriginales] = useState(null);

  const [formData, setFormData] = useState({
    numero_empleado: '',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    email_personal: '',
    email_institucional: ''
  });

useEffect(() => {
    if (isOpen) {
      setErroresEnVivo({ email_personal: '' });
      setValidacionExitosa({ email_personal: false });
      
      if (adminAEditar) {
        let email_inst_limpio = adminAEditar.email_institucional || '';
        if (email_inst_limpio.includes('@')) {
            email_inst_limpio = email_inst_limpio.split('@')[0];
        }

        const esActivo = adminAEditar.estatus === 'Activo';

        const dataCargada = {
          numero_empleado: adminAEditar.numero_empleado,
          nombre: adminAEditar.nombre || '',
          apellido_paterno: adminAEditar.apellido_paterno || '',
          apellido_materno: adminAEditar.apellido_materno || '',
          email_personal: adminAEditar.email_personal || '',
          email_institucional: email_inst_limpio,
          is_active: esActivo 
        };

        setFormData(dataCargada);
        setDatosOriginales(dataCargada);
      } else {
        const defaultData = {
          numero_empleado: '',
          nombre: '',
          apellido_paterno: '',
          apellido_materno: '',
          email_personal: '',
          email_institucional: '',
          is_active: true 
        };
        setFormData(defaultData);
        setDatosOriginales(null);
      }
    }
  }, [isOpen, adminAEditar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (typeof finalValue === 'string') {
      finalValue = finalValue.replace(/^\s+/, '');
      finalValue = finalValue.replace(/\s{2,}/g, ' ');
    }

    if (name === 'nombre' || name === 'apellido_paterno' || name === 'apellido_materno') {
      finalValue = finalValue.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    }

    if (name === 'email_personal') {
      finalValue = finalValue.replace(/\s/g, '').toLowerCase();
      // Solo un arroba permitido
      const firstAt = finalValue.indexOf('@');
      if (firstAt !== -1) {
        finalValue = finalValue.slice(0, firstAt + 1) + finalValue.slice(firstAt + 1).replace(/@/g, '');
      }
    }

    if (name === 'email_institucional') {
      finalValue = finalValue.replace(/[\s@]/g, '').toLowerCase();
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));

    if (name === 'email_personal') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
      if (finalValue.length === 0) {
        setErroresEnVivo(prev => ({ ...prev, email_personal: '' }));
        setValidacionExitosa(prev => ({ ...prev, email_personal: false }));
      } else if (emailRegex.test(finalValue)) {
        setErroresEnVivo(prev => ({ ...prev, email_personal: '' }));
        setValidacionExitosa(prev => ({ ...prev, email_personal: true }));
      } else {
        setErroresEnVivo(prev => ({ ...prev, email_personal: '❌ Formato de correo inválido' }));
        setValidacionExitosa(prev => ({ ...prev, email_personal: false }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.apellido_paterno || !formData.email_personal) {
      return Swal.fire('Campos Incompletos', 'Por favor complete todos los campos obligatorios (*).', 'warning');
    }

    if (erroresEnVivo.email_personal) {
      return Swal.fire('Formulario Inválido', 'Por favor corrija los errores marcados en rojo.', 'error');
    }

    setIsLoading(true);

    let finalEmailInstitucional = null;
    if (formData.email_institucional.trim() !== "") {
      finalEmailInstitucional = `${formData.email_institucional.trim()}@red.unid.mx`;
    }

    try {
      const { numero_empleado, email_institucional, ...restoDatos } = formData;
      
      const payload = {
          ...restoDatos,
          email_institucional: finalEmailInstitucional,
          usuario_id: user?.identifier || user?.email || "Admin Local"
      };

      if (adminAEditar) {
        await client.put(`/administradores/actualizar/${adminAEditar.numero_empleado}`, payload);
        
        Swal.fire({ 
          title: 'Actualizado', 
          text: 'Los datos del administrador han sido actualizados.', 
          icon: 'success',
          confirmButtonColor: '#1A237E'
        }).then(() => onClose());

      } else {
        const res = await client.post('/administradores/register', payload);
        Swal.fire({ 
          title: 'Administrador Registrado', 
          text: `Se ha registrado el empleado con el ID: ${res.data.numero_empleado}. Las credenciales han sido enviadas.`, 
          icon: 'success', 
          confirmButtonColor: '#1A237E' 
        }).then(() => onClose());
      }
    } catch (error) {
      Swal.fire('Error', error.response?.data?.detail || "Fallo en la comunicación con el servidor.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-[#1A237E] p-6 rounded-t-lg -mx-6 -mt-6 mb-6">
        <button onClick={onClose} className="flex items-center text-blue-200 hover:text-white text-sm mb-3 transition-colors font-medium">
            Cerrar panel
        </button>
        <h2 className="text-2xl font-bold text-white">
            {adminAEditar ? 'Edición de Administrador' : 'Alta de Administrador'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-50 p-2 md:p-6 rounded-lg">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1A237E] font-bold mb-6 text-base">
            Datos del Empleado
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">ID de Empleado</label>
              <input 
                value={adminAEditar ? formData.numero_empleado : "Se genera automáticamente al guardar"} 
                className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-500 bg-gray-100 outline-none font-bold tracking-wider cursor-not-allowed" 
                disabled 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nombre(s) <span className="text-red-500">*</span></label>
              <input name="nombre" value={formData.nombre} maxLength={100} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] outline-none" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Paterno <span className="text-red-500">*</span></label>
              <input name="apellido_paterno" value={formData.apellido_paterno} maxLength={100} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] outline-none" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Materno</label>
              <input name="apellido_materno" value={formData.apellido_materno} maxLength={100} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] outline-none" />
            </div>

            <div className="mt-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Personal <span className="text-red-500">*</span></label>
              <input
                type="email"
                name="email_personal"
                value={formData.email_personal}
                onChange={handleChange}
                onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
                maxLength={150}
                className={`w-full border rounded-md p-2.5 text-sm lowercase outline-none transition-all ${erroresEnVivo.email_personal ? 'border-red-500 bg-red-50 focus:ring-red-500 text-red-700' : validacionExitosa.email_personal ? 'border-green-500 bg-green-50 focus:ring-green-500 text-green-700' : 'border-gray-300 focus:border-[#1A237E]'}`}
                required
              />
              {erroresEnVivo.email_personal && <p className="text-xs text-red-600 mt-1.5 font-bold">{erroresEnVivo.email_personal}</p>}
            </div>

            <div className="mt-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Institucional (Opcional)</label>
              <div className="flex">
                <input 
                  type="text" 
                  name="email_institucional" 
                  value={formData.email_institucional} 
                  onChange={handleChange} 
                  maxLength={50}
                  className="w-full border border-gray-300 rounded-l-md p-2.5 text-sm lowercase focus:border-[#1A237E] outline-none" 
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">@red.unid.mx</span>
              </div>
            </div>

          {adminAEditar && (
              <div className="mt-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Estatus en el Sistema</label>
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 flex items-center justify-between bg-white min-h-[42px] focus-within:border-[#1A237E] transition-colors">
                  <span className="text-sm text-gray-500">Acceso Administrativo</span>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-red-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    <span className={`ml-3 text-sm font-bold w-14 text-right ${formData.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {formData.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        

        <div className="flex justify-between items-center pt-4">
          <span className="text-xs text-red-500">* Campos obligatorios</span>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-5 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
 
            {(() => {
              const camposEditables = ['nombre', 'apellido_paterno', 'apellido_materno', 'email_personal', 'email_institucional', 'is_active'];
              const sinCambios = !!(adminAEditar && datosOriginales && !camposEditables.some(c => String(formData[c] ?? '') !== String(datosOriginales[c] ?? '')));
              const deshabilitado = isLoading || !!erroresEnVivo.email_personal || sinCambios;
              
              return (
                <button 
                  type="submit" 
                  disabled={deshabilitado} 
                  className={`flex items-center px-6 py-2 rounded-md text-sm font-bold text-white shadow-sm transition-all ${deshabilitado ? 'bg-indigo-300 cursor-not-allowed' : 'bg-[#1A237E] hover:bg-indigo-900'}`}
                >
                  {isLoading ? 'Procesando...' : (adminAEditar ? 'Actualizar' : 'Guardar Administrador')}
                </button>
              );
            })()}
          </div>
        </div>
      </form>
    </Modal>
  );
}