import { useState, useEffect } from 'react';
import client from '../../lib/axios';
import Modal from '../ui/Modal';
import Swal from 'sweetalert2';
import Select from 'react-select'; // 🌟 LA NUEVA MAGIA PARA LOS DROPDOWNS

export default function ManualRegister({ isOpen, onClose }) {
  const [careers, setCareers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [coloniasAPI, setColoniasAPI] = useState([]);
  const [files, setFiles] = useState({ foto: null, certificado: null });
  
  const [isLoading, setIsLoading] = useState(false);

  const [erroresEnVivo, setErroresEnVivo] = useState({ curp: '', email: '', promedio: '' });
  const [validacionExitosa, setValidacionExitosa] = useState({ curp: false, email: false });

  const [formData, setFormData] = useState({
    nombre: '', apellido_paterno: '', apellido_materno: '',
    curp: '', email_personal: '', email_institucional: '', career_id: '',
    origin_school_id: '', promedio_procedencia: '',
    calle: '', numero_domicilio: '', colonia: '',
    codigo_postal: '', municipio: '', estado: '',
    status: 'activo'
  });

  // 🌟 ESTILOS PERSONALIZADOS PARA QUE REACT-SELECT SE VEA COMO TAILWIND
  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? '#6366f1' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #6366f1' : 'none',
      '&:hover': { borderColor: state.isFocused ? '#6366f1' : '#9ca3af' },
      borderRadius: '0.375rem',
      padding: '2px',
      fontSize: '0.875rem',
      fontWeight: '600',
      backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff',
      transition: 'all 0.3s ease'
    }),
    menu: base => ({
      ...base,
      borderRadius: '0.5rem',
      overflow: 'hidden',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      animation: 'fadeIn 0.2s ease-in-out',
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#4f46e5' : state.isFocused ? '#e0e7ff' : 'white',
      color: state.isSelected ? 'white' : '#1f2937',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'background-color 0.15s ease'
    })
  };

  useEffect(() => {
    if (isOpen) {
      setErroresEnVivo({ curp: '', email: '', promedio: '' }); 
      setValidacionExitosa({ curp: false, email: false });
      client.get('/students/options').then(res => {
        setCareers(res.data.careers || []);
        setSchools(res.data.schools || []);
      }).catch(err => console.error("Error al cargar catálogos:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.codigo_postal.length === 5) {
      fetch(`https://api.zippopotam.us/MX/${formData.codigo_postal}`)
        .then(res => {
          if (!res.ok) throw new Error("C.P. no encontrado");
          return res.json();
        })
        .then(data => {
            const colonias = data.places.map(place => place['place name']);
            setColoniasAPI(colonias);
            
            const estadoDetectado = data.places[0]['state'] || 'Campeche';
            let municipioDetectado = '';

            if (estadoDetectado === "Campeche") {
              const prefijo = formData.codigo_postal.substring(0, 3);
              const catalogoMunicipios = {
                '240': 'Campeche', '241': 'Carmen', '242': 'Palizada', '243': 'Escárcega',
                '244': 'Champotón', '245': 'Hecelchakán', '246': 'Hopelchén', '247': 'Tenabo',
                '248': 'Calkiní', '249': 'Dzitbalché'
              };
              municipioDetectado = catalogoMunicipios[prefijo] || '';
            }

            setFormData(prev => ({ 
              ...prev, 
              estado: estadoDetectado,
              municipio: municipioDetectado,
              colonia: '' // Limpiamos la colonia anterior por si cambian de C.P.
            })); 
        })
        .catch(() => setColoniasAPI([]));
    } else {
        setColoniasAPI([]);
    }
  }, [formData.codigo_postal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const formattedValue = name.includes('email') ? value.toLowerCase() : value.toUpperCase();
    setFormData(prev => ({ ...prev, [name]: formattedValue })); 

    if (name === 'curp') {
      setErroresEnVivo(prev => ({ ...prev, curp: '' }));
      setValidacionExitosa(prev => ({ ...prev, curp: false }));
    }
    if (name === 'email_personal') {
      setErroresEnVivo(prev => ({ ...prev, email: '' }));
      setValidacionExitosa(prev => ({ ...prev, email: false }));
    }
    
    if (name === 'promedio_procedencia') {
      const num = parseFloat(value);
      if (value !== '' && (num < 0 || num > 10)) {
        setErroresEnVivo(prev => ({ ...prev, promedio: '❌ El promedio debe ser entre 0 y 10' }));
      } else {
        setErroresEnVivo(prev => ({ ...prev, promedio: '' }));
      }
    }
  };

  // 🌟 NUEVO: Manejador especial para los nuevos Selects animados
  const handleSelectChange = (selectedOption, actionMeta) => {
    const { name } = actionMeta;
    setFormData(prev => ({ 
      ...prev, 
      [name]: selectedOption ? selectedOption.value : '' 
    }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
    }
  };

  const handleCheckCurp = async () => {
    if (formData.curp.length === 18) {
      try {
        const res = await client.get(`/students/check-curp?curp=${formData.curp}`);
        if (res.data.exists) {
          setErroresEnVivo(prev => ({ ...prev, curp: '❌ Esta CURP ya está registrada en el sistema.' }));
          setValidacionExitosa(prev => ({ ...prev, curp: false }));
        } else {
          setErroresEnVivo(prev => ({ ...prev, curp: '' }));
          setValidacionExitosa(prev => ({ ...prev, curp: true })); 
        }
      } catch (error) {
        console.error("Error verificando CURP", error);
      }
    }
  };

  const handleCheckEmail = async () => {
    if (formData.email_personal.includes('@')) {
      try {
        const res = await client.get(`/students/check-email?email=${formData.email_personal.toLowerCase()}`);
        if (res.data.exists) {
          setErroresEnVivo(prev => ({ ...prev, email: '❌ Este correo ya está en uso por otro alumno.' }));
          setValidacionExitosa(prev => ({ ...prev, email: false }));
        } else {
          setErroresEnVivo(prev => ({ ...prev, email: '' }));
          setValidacionExitosa(prev => ({ ...prev, email: true })); 
        }
      } catch (error) {
        console.error("Error verificando Email", error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio) {
      return Swal.fire('Formulario Incompleto', 'Por favor corrige los errores marcados en rojo antes de continuar.', 'warning');
    }

    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
    if (!curpRegex.test(formData.curp)) return Swal.fire('Formato Inválido', 'La CURP no tiene el formato oficial.', 'error');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
    if (!emailRegex.test(formData.email_personal)) return Swal.fire('Correo Inválido', 'El Correo Personal no es válido.', 'error');

    if (!formData.career_id) return Swal.fire('Falta Carrera', 'Debes seleccionar una carrera.', 'warning');
    if (!formData.origin_school_id) return Swal.fire('Falta Escuela', 'Debes seleccionar la escuela de procedencia.', 'warning');
    if (!formData.colonia) return Swal.fire('Falta Colonia', 'Debes seleccionar una colonia.', 'warning');

    if (!files.foto) return Swal.fire('Falta la Fotografía', 'La fotografía es obligatoria para el registro.', 'warning');

    const promedio = parseFloat(formData.promedio_procedencia);
    if (promedio < 0 || promedio > 10) {
      return Swal.fire('Promedio Inválido', 'El promedio general debe ser un número entre 0 y 10.', 'error');
    }

    setIsLoading(true);

    const dataPayload = {
      ...formData,
      career_id: parseInt(formData.career_id),
      origin_school_id: parseInt(formData.origin_school_id),
      promedio_procedencia: promedio,
      email_institucional: formData.email_institucional.trim() === "" ? null : formData.email_institucional.toLowerCase(),
      cuatrimestre: 1,
      address: {
        calle: formData.calle, numero_domicilio: formData.numero_domicilio,
        colonia: formData.colonia, codigo_postal: formData.codigo_postal,
        municipio: formData.municipio, estado: formData.estado
      }
    };

    const dataToSend = new FormData();
    dataToSend.append('student_data', JSON.stringify(dataPayload));
    dataToSend.append('foto_perfil', files.foto);
    if (files.certificado) dataToSend.append('certificado', files.certificado);

    try {
      const res = await client.post('/students/register', dataToSend);
      
      Swal.fire({
        title: '¡Alumno Guardado Exitosamente!',
        text: `Se generó la matrícula ${res.data.matricula} y se han enviado las credenciales de acceso a su correo.`,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Aceptar'
      }).then((result) => {
        if (result.isConfirmed) {
          onClose(); 
        }
      });

    } catch (error) {
      Swal.fire('Error al guardar', error.response?.data?.detail || "Fallo en el servidor.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 PREPARAMOS LAS OPCIONES PARA LOS SELECTS ANIMADOS
  const careerOptions = careers.map(c => ({ value: c.id, label: c.name }));
  const schoolOptions = schools.map(s => ({ value: s.id, label: s.name }));
  const coloniaOptions = coloniasAPI.map(col => ({ value: col, label: col }));
  const statusOptions = [
    { value: 'activo', label: 'Activo' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Nuevo Alumno">
      {/* 🌟 CSS INYECTADO PARA LA ANIMACIÓN DE FADE-IN */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 1. INFORMACIÓN PERSONAL */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
          <h4 className="flex items-center text-gray-800 font-bold mb-4 text-sm">
            <span className="mr-2 text-indigo-600">👤</span> Información Personal
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Matrícula <span className="text-red-500">*</span></label>
              <input value="Se asignará automáticamente" className="w-full border border-gray-300 rounded-md p-2.5 text-sm text-gray-500 bg-gray-50 outline-none font-medium" disabled />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Nombre(s) <span className="text-red-500">*</span></label>
              <input name="nombre" placeholder="Ej: Juan Carlos" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Apellido Paterno <span className="text-red-500">*</span></label>
              <input name="apellido_paterno" placeholder="Ej: García" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Apellido Materno <span className="text-red-500">*</span></label>
              <input name="apellido_materno" placeholder="Ej: López" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold" required />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">CURP <span className="text-red-500">*</span></label>
              <input 
                name="curp" 
                placeholder="Ej: ABCD123456HXXXXX01" 
                onChange={handleChange} 
                onBlur={handleCheckCurp} 
                className={`w-full border rounded-md p-2.5 text-sm uppercase outline-none font-bold tracking-wider transition-colors focus:ring-1
                  ${erroresEnVivo.curp 
                    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500' 
                    : validacionExitosa.curp 
                      ? 'border-green-500 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`} 
                maxLength={18} 
                required 
              />
              {erroresEnVivo.curp && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.curp}</p>}
              {validacionExitosa.curp && <p className="text-xs text-green-600 mt-1.5 font-bold">✅ CURP disponible</p>}
            </div>
          </div>
        </div>

        {/* 2. INFORMACIÓN ACADÉMICA */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
          <h4 className="flex items-center text-gray-800 font-bold mb-4 text-sm">
            <span className="mr-2 text-indigo-600">🎓</span> Información Académica
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 🌟 SELECT ANIMADO PARA CARRERAS */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Carrera / Programa <span className="text-red-500">*</span></label>
              <Select
                name="career_id"
                options={careerOptions}
                onChange={handleSelectChange}
                placeholder="Busque o seleccione una carrera..."
                styles={customSelectStyles}
                noOptionsMessage={() => "No se encontraron carreras"}
                isClearable
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Cuatrimestre <span className="text-red-500">*</span></label>
              <input value="1º Cuatrimestre" disabled className="w-full border border-gray-300 rounded-md p-2.5 text-sm bg-gray-50 outline-none font-bold text-gray-500" />
            </div>

            {/* 🌟 SELECT ANIMADO PARA ESTATUS */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Estatus <span className="text-red-500">*</span></label>
              <Select
                name="status"
                options={statusOptions}
                onChange={handleSelectChange}
                defaultValue={statusOptions[0]} // Inicia en "Activo"
                styles={customSelectStyles}
                isSearchable={false} // No se necesita buscar aquí
              />
            </div>
            
            {/* 🌟 SELECT ANIMADO PARA ESCUELAS */}
            <div className="md:col-span-2 mt-2 border-t border-gray-100 pt-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">Escuela de Procedencia <span className="text-red-500">*</span></label>
              <Select
                name="origin_school_id"
                options={schoolOptions}
                onChange={handleSelectChange}
                placeholder="Escriba para buscar una escuela..."
                styles={customSelectStyles}
                noOptionsMessage={() => "Escuela no encontrada"}
                isClearable
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Promedio General <span className="text-red-500">*</span></label>
              <input 
                type="number" step="0.01" min="0" max="10" placeholder="Ej: 8.5" name="promedio_procedencia" onChange={handleChange} 
                className={`w-full border rounded-md p-2.5 text-sm outline-none font-bold transition-colors focus:ring-1
                  ${erroresEnVivo.promedio 
                    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`} 
                required 
              />
              {erroresEnVivo.promedio && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.promedio}</p>}
            </div>
          </div>
        </div>

        {/* 3. INFORMACIÓN DE CONTACTO Y DOMICILIO */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
          <h4 className="flex items-center text-gray-800 font-bold mb-4 text-sm">
            <span className="mr-2 text-indigo-600">✉️</span> Información de Contacto
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Correo Personal <span className="text-red-500">*</span></label>
              <input 
                type="email" name="email_personal" placeholder="Ej: alumno@gmail.com" onChange={handleChange} onBlur={handleCheckEmail} 
                className={`w-full border rounded-md p-2.5 text-sm lowercase outline-none font-semibold transition-colors focus:ring-1
                  ${erroresEnVivo.email 
                    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500' 
                    : validacionExitosa.email 
                      ? 'border-green-500 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`} 
                required 
              />
              {erroresEnVivo.email && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.email}</p>}
              {validacionExitosa.email && <p className="text-xs text-green-600 mt-1.5 font-bold">✅ Correo disponible</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Correo Institucional</label>
              <input type="email" name="email_institucional" placeholder="Ej: alumno@unid.edu.mx" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm lowercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold" />
            </div>
            <div className="md:col-span-2 mt-3">
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">Domicilio</h5>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Calle <span className="text-red-500">*</span></label>
              <input name="calle" placeholder="Ej: Av. Central" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 outline-none font-semibold" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">No. Exterior <span className="text-red-500">*</span></label>
              <input name="numero_domicilio" placeholder="Ej: 45" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 outline-none font-semibold" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">C.P. <span className="text-red-500">*</span></label>
              <input name="codigo_postal" maxLength={5} placeholder="Ej: 24000" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 outline-none font-bold tracking-wider" required />
            </div>
            
            {/* 🌟 SELECT ANIMADO PARA COLONIAS */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Colonia <span className="text-red-500">*</span></label>
              <Select
                name="colonia"
                options={coloniaOptions}
                onChange={handleSelectChange}
                placeholder={coloniasAPI.length > 0 ? "Seleccione una colonia..." : "Escriba el C.P. primero"}
                styles={customSelectStyles}
                isDisabled={coloniasAPI.length === 0}
                noOptionsMessage={() => "Sin resultados"}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Municipio <span className="text-red-500">*</span></label>
              <input name="municipio" value={formData.municipio} onChange={handleChange} readOnly={coloniasAPI.length > 0} className={`w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 outline-none font-bold transition-colors ${coloniasAPI.length > 0 ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-transparent' : 'bg-white'}`} required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Estado <span className="text-red-500">*</span></label>
              <input name="estado" value={formData.estado} onChange={handleChange} readOnly={coloniasAPI.length > 0} className={`w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-indigo-500 outline-none font-bold transition-colors ${coloniasAPI.length > 0 ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-transparent' : 'bg-white'}`} required />
            </div>
          </div>
        </div>

        {/* 4. DOCUMENTOS */}
        <div className="border border-gray-200 rounded-lg p-5 bg-indigo-50 shadow-sm">
          <h4 className="flex items-center text-indigo-900 font-bold mb-4 text-sm">
            <span className="mr-2">📁</span> Documentación Requerida
          </h4>
          <div className="grid grid-cols-2 gap-5">
            <div className="relative group">
              <input type="file" name="foto" id="f-foto" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-foto" className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${files.foto ? 'border-green-500 bg-green-50 text-green-700' : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mb-2 ${files.foto ? 'text-green-500' : 'text-indigo-300 group-hover:text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">{files.foto ? `✅ ${files.foto.name}` : "Subir Foto *"}</span>
              </label>
            </div>
            <div className="relative group">
              <input type="file" name="certificado" id="f-cert" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-cert" className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${files.certificado ? 'border-green-500 bg-green-50 text-green-700' : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mb-2 ${files.certificado ? 'text-green-500' : 'text-indigo-300 group-hover:text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">{files.certificado ? `✅ ${files.certificado.name}` : "Subir Certificado"}</span>
              </label>
            </div>
          </div>
        </div>

        {/* BOTONES */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors uppercase tracking-wide">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading || erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio} className={`px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition-all uppercase tracking-wide ${isLoading || erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl active:scale-95'}`}>
            {isLoading ? 'Guardando...' : 'Registrar Nuevo Ingreso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}