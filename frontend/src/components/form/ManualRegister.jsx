import { useState, useEffect } from 'react';
import client from '../../lib/axios';
import Modal from '../ui/Modal';
import Swal from 'sweetalert2';
import Select from 'react-select'; 

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

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? '#1e3a8a' : '#d1d5db', 
      boxShadow: state.isFocused ? '0 0 0 1px #1e3a8a' : 'none',
      '&:hover': { borderColor: state.isFocused ? '#1e3a8a' : '#9ca3af' },
      borderRadius: '0.375rem',
      padding: '2px',
      fontSize: '0.875rem',
      fontWeight: '500',
      backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff',
      transition: 'all 0.3s ease'
    }),
    menu: base => ({
      ...base,
      borderRadius: '0.5rem',
      overflow: 'hidden',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      animation: 'fadeIn 0.2s ease-in-out',
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#1e3a8a' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1e293b',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500'
    })
  };

  useEffect(() => {
    if (isOpen) {
      setErroresEnVivo({ curp: '', email: '', promedio: '' }); 
      setValidacionExitosa({ curp: false, email: false });
      setFiles({ foto: null, certificado: null });
      setFormData({
        nombre: '', apellido_paterno: '', apellido_materno: '',
        curp: '', email_personal: '', email_institucional: '', career_id: '',
        origin_school_id: '', promedio_procedencia: '',
        calle: '', numero_domicilio: '', colonia: '',
        codigo_postal: '', municipio: '', estado: '',
        status: 'activo'
      });
      setColoniasAPI([]);

      client.get('/alumnos/options').then(res => {
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
              ...prev, estado: estadoDetectado, municipio: municipioDetectado, colonia: '' 
            })); 
        })
        .catch(() => setColoniasAPI([]));
    } else {
        setColoniasAPI([]);
    }
  }, [formData.codigo_postal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'nombre' || name === 'apellido_paterno' || name === 'apellido_materno') {
      finalValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    }

    if (name.includes('email')) {
      finalValue = finalValue.toLowerCase(); 
    } else if (name === 'curp') {
      finalValue = finalValue.toUpperCase(); 
    }

    setFormData(prev => ({ ...prev, [name]: finalValue })); 

    if (name === 'curp') {
      setErroresEnVivo(prev => ({ ...prev, curp: '' }));
      setValidacionExitosa(prev => ({ ...prev, curp: false }));
    }
    if (name === 'email_personal') {
      setErroresEnVivo(prev => ({ ...prev, email: '' }));
      setValidacionExitosa(prev => ({ ...prev, email: false }));
    }
    
    if (name === 'promedio_procedencia') {
      const num = parseFloat(finalValue);
      if (finalValue !== '' && (num < 0 || num > 10)) {
        setErroresEnVivo(prev => ({ ...prev, promedio: '❌ El promedio debe ser entre 0 y 10' }));
      } else {
        setErroresEnVivo(prev => ({ ...prev, promedio: '' }));
      }
    }
  };

  const handleSelectChange = (selectedOption, actionMeta) => {
    const { name } = actionMeta;
    setFormData(prev => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
    }
  };

 const handleCheckCurp = async () => {
    if (formData.curp.length === 18) {
      const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
      if (!curpRegex.test(formData.curp)) {
        setErroresEnVivo(prev => ({ ...prev, curp: '❌ El formato de la CURP es incorrecto.' }));
        setValidacionExitosa(prev => ({ ...prev, curp: false }));
        return;
      }

      try {
        const res = await client.get(`/alumnos/check-curp?curp=${formData.curp}`);
        if (res.data.exists) {
          setErroresEnVivo(prev => ({ ...prev, curp: '❌ Esta CURP ya está registrada.' }));
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
    if (formData.email_personal.length > 5) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
      if (!emailRegex.test(formData.email_personal)) {
        setErroresEnVivo(prev => ({ ...prev, email: '❌ Formato de correo inválido.' }));
        setValidacionExitosa(prev => ({ ...prev, email: false }));
        return;
      }

      try {
        const res = await client.get(`/alumnos/check-email?email=${formData.email_personal.toLowerCase()}`);
        if (res.data.exists) {
          setErroresEnVivo(prev => ({ ...prev, email: '❌ Este correo ya está en uso.' }));
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
      return Swal.fire('Formulario Incompleto', 'Por favor corrige los errores antes de continuar.', 'warning');
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
      return Swal.fire('Promedio Inválido', 'El promedio debe ser entre 0 y 10.', 'error');
    }

    setIsLoading(true);

    let finalEmailInstitucional = null;
    if (formData.email_institucional.trim() !== "") {
      const rawEmail = formData.email_institucional.trim().toLowerCase();
      finalEmailInstitucional = rawEmail.includes('@') ? rawEmail : `${rawEmail}@red.unid.mx`;
    }

    const dataPayload = {
      ...formData,
      career_id: parseInt(formData.career_id),
      origin_school_id: parseInt(formData.origin_school_id),
      promedio_procedencia: promedio,
      email_institucional: finalEmailInstitucional,
      cuatrimestre: 1,
      address: {
        calle: formData.calle, numero_domicilio: formData.numero_domicilio,
        colonia: formData.colonia, codigo_postal: formData.codigo_postal,
        municipio: formData.municipio, 
        estado: 'Campeche' 
      }
    };

    const dataToSend = new FormData();
    dataToSend.append('student_data', JSON.stringify(dataPayload));
    dataToSend.append('foto_perfil', files.foto);
    if (files.certificado) dataToSend.append('certificado', files.certificado);

    try {
      const res = await client.post('/alumnos/register', dataToSend);
      
      Swal.fire({
        title: '¡Alumno Guardado Exitosamente!',
        text: `Se generó la matrícula ${res.data.matricula} y se han enviado las credenciales a su correo.`,
        icon: 'success',
        confirmButtonColor: '#f59e0b'
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

  const careerOptions = careers.map(c => ({ value: c.id, label: c.name }));
  const schoolOptions = schools.map(s => ({ value: s.id, label: s.name }));
  const coloniaOptions = coloniasAPI.map(col => ({ value: col, label: col }));

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      <div className="bg-[#1e3a8a] p-6 rounded-t-lg -mx-6 -mt-6 mb-6">
        <button onClick={onClose} className="flex items-center text-blue-200 hover:text-white text-sm mb-3 transition-colors font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Volver a inicio
        </button>
        <h2 className="text-2xl font-bold text-white">Alta de Alumno</h2>
        <p className="text-blue-200 text-sm mt-1">Complete los datos del alumno para registrarlo en el sistema</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-slate-50 p-2 md:p-6 rounded-lg">
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">
              👤
            </div>
            Información Personal
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">ID UNID (autogenerado)</label>
              <input value="Se genera automáticamente al guardar" className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-400 bg-gray-50 outline-none font-medium" disabled />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nombre(s) <span className="text-red-500">*</span></label>
              <input name="nombre" value={formData.nombre} placeholder="Ej: Juan Carlos" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Paterno <span className="text-red-500">*</span></label>
              <input name="apellido_paterno" value={formData.apellido_paterno} placeholder="Ej: García" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Materno <span className="text-red-500">*</span></label>
              <input name="apellido_materno" value={formData.apellido_materno} placeholder="Ej: López" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">CURP <span className="text-red-500">*</span></label>
              <input 
                name="curp" value={formData.curp} placeholder="Ej: ABCD123456HXXXXX01" onChange={handleChange} onBlur={handleCheckCurp} 
                className={`w-full border rounded-md p-2.5 text-sm uppercase outline-none font-bold tracking-wider transition-all focus:ring-1
                  ${erroresEnVivo.curp ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500' : validacionExitosa.curp ? 'border-green-500 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500' : 'border-gray-300 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]'}`} 
                maxLength={18} required 
              />
              {erroresEnVivo.curp && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.curp}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">
              🎓
            </div>
            Información Académica
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Programa Académico <span className="text-red-500">*</span></label>
              <Select name="career_id" options={careerOptions} onChange={handleSelectChange} placeholder="Seleccione una carrera..." styles={customSelectStyles} isClearable />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Cuatrimestre <span className="text-red-500">*</span></label>
              <input value="1º Cuatrimestre" disabled className="w-full border border-gray-200 rounded-md p-2.5 text-sm bg-gray-50 outline-none text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Estatus <span className="text-red-500">*</span></label>
              <input value="Activo" disabled className="w-full border border-gray-200 rounded-md p-2.5 text-sm bg-gray-50 outline-none text-gray-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Escuela de Procedencia <span className="text-red-500">*</span></label>
              <Select name="origin_school_id" options={schoolOptions} onChange={handleSelectChange} placeholder="Seleccione..." styles={customSelectStyles} isClearable />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Promedio General <span className="text-red-500">*</span></label>
              <input 
                type="number" step="0.01" min="0" max="10" placeholder="Ej: 8.5" name="promedio_procedencia" value={formData.promedio_procedencia} onChange={handleChange} 
                className={`w-full border rounded-md p-2.5 text-sm outline-none transition-all focus:ring-1 ${erroresEnVivo.promedio ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500' : 'border-gray-300 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]'}`} required 
              />
              {erroresEnVivo.promedio && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.promedio}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">
              📍
            </div>
            Dirección y Contacto
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Institucional</label>
              <div className="flex">
                <input type="text" name="email_institucional" value={formData.email_institucional} placeholder="Ej: darkminnk128" onChange={handleChange} className="w-full border border-gray-300 rounded-l-md p-2.5 text-sm lowercase focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none" />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">@red.unid.mx</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Personal <span className="text-red-500">*</span></label>
              <input 
                type="email" name="email_personal" value={formData.email_personal} placeholder="Ej: alumno@gmail.com" onChange={handleChange} onBlur={handleCheckEmail} 
                className={`w-full border rounded-md p-2.5 text-sm lowercase outline-none transition-all focus:ring-1 ${erroresEnVivo.email ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500' : validacionExitosa.email ? 'border-green-500 bg-green-50 focus:border-green-500' : 'border-gray-300 focus:border-[#1e3a8a] focus:ring-[#1e3a8a]'}`} required 
              />
              {erroresEnVivo.email && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.email}</p>}
            </div>

            <div className="md:col-span-2 mt-4 border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Calle <span className="text-red-500">*</span></label>
                <input name="calle" value={formData.calle} placeholder="Ej: Av. Insurgentes" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Número Exterior <span className="text-red-500">*</span></label>
                <input name="numero_domicilio" value={formData.numero_domicilio} placeholder="Ej: 123" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Código Postal <span className="text-red-500">*</span></label>
                <input name="codigo_postal" value={formData.codigo_postal} maxLength={5} placeholder="Ej: 06000" onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none font-bold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Colonia <span className="text-red-500">*</span></label>
                <Select name="colonia" options={coloniaOptions} onChange={handleSelectChange} placeholder={coloniasAPI.length > 0 ? "Seleccione..." : "Escriba C.P."} styles={customSelectStyles} isDisabled={coloniasAPI.length === 0} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Ciudad / Municipio <span className="text-red-500">*</span></label>
                <input 
                  name="municipio" value={formData.municipio} onChange={handleChange} 
                  readOnly={coloniasAPI.length > 0 && formData.municipio !== ''} 
                  className={`w-full border rounded-md p-2.5 text-sm outline-none transition-colors ${coloniasAPI.length > 0 && formData.municipio !== '' ? 'bg-gray-100 text-gray-500 border-transparent' : 'border-gray-300 focus:border-[#1e3a8a]'}`} required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Estado <span className="text-red-500">*</span></label>
                <input value="Campeche" disabled className="w-full border border-gray-200 rounded-md p-2.5 text-sm bg-gray-50 outline-none text-gray-500 font-medium" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-4 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">
              📁
            </div>
            Expediente Digital
          </h4>
          <div className="grid grid-cols-2 gap-5">
            <div className="relative group">
              <input type="file" name="foto" id="f-foto" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-foto" className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.foto ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 text-gray-400'}`}>
                <span className="text-xs font-bold uppercase tracking-wider">{files.foto ? `✅ ${files.foto.name}` : "Subir Fotografía *"}</span>
              </label>
            </div>
            <div className="relative group">
              <input type="file" name="certificado" id="f-cert" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-cert" className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.certificado ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 text-gray-400'}`}>
                <span className="text-xs font-bold uppercase tracking-wider">{files.certificado ? `✅ ${files.certificado.name}` : "Subir Certificado"}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4">
          <span className="text-xs text-red-500">* Campos obligatorios</span>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading || erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio} className={`flex items-center px-6 py-2 rounded-md text-sm font-bold text-white shadow-sm transition-all ${isLoading || erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio ? 'bg-amber-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}>
              <span className="mr-2">💾</span> {isLoading ? 'Guardando...' : 'Guardar Alumno'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}