import { useState, useEffect } from 'react';
import client from '../../lib/axios';
import Modal from '../ui/Modal';

export default function ManualRegister({ isOpen, onClose }) {
  const [careers, setCareers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [files, setFiles] = useState({ foto: null, certificado: null });
  
  const [formData, setFormData] = useState({
    nombre: '', apellido_paterno: '', apellido_materno: '',
    curp: '', email_personal: '', email_institucional: '', career_id: '',
    origin_school_id: '', promedio_procedencia: '',
    calle: '', numero_domicilio: '', colonia: '',
    codigo_postal: '', municipio: '', estado: 'Campeche'
  });

  useEffect(() => {
    if (isOpen) {
      client.get('/students/options').then(res => {
        setCareers(res.data.careers || []);
        setSchools(res.data.schools || []);
      });
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.foto) return alert("⚠️ La foto es obligatoria.");

    const dataPayload = {
      ...formData,
      career_id: parseInt(formData.career_id),
      origin_school_id: formData.origin_school_id ? parseInt(formData.origin_school_id) : null,
      promedio_procedencia: parseFloat(formData.promedio_procedencia),
      email_institucional: formData.email_institucional.trim() === "" ? null : formData.email_institucional,
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
      alert(`✅ ALTA EXITOSA\n\nMatrícula: ${res.data.matricula}\nContraseña: ${res.data.temporal_password}`);
      onClose();
    } catch (error) {
      alert("❌ Error: " + (error.response?.data?.detail || "Fallo al guardar"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alta Alumno - Nuevo Ingreso">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* INFORMACIÓN PERSONAL */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
          <h4 className="text-blue-800 font-extrabold mb-4 text-xs uppercase tracking-wider">Información Personal</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 bg-blue-50 p-3 rounded-md border border-blue-100 text-blue-900 text-xs font-bold text-center uppercase tracking-tight">
              La matrícula será asignada automáticamente por el sistema
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Nombre(s) <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="nombre" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">CURP <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="curp" onChange={handleChange} className="input-base uppercase font-semibold" maxLength={18} required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Ap. Paterno <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="apellido_paterno" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Ap. Materno <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="apellido_materno" onChange={handleChange} className="input-base font-semibold" required />
            </div>
          </div>
        </div>

        {/* INFORMACIÓN ACADÉMICA */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
          <h4 className="text-blue-800 font-extrabold mb-4 text-xs uppercase tracking-wider">Información Académica</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-4">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Carrera <span className="text-red-600 font-black text-sm">*</span></label>
              <select name="career_id" onChange={handleChange} className="input-base bg-white font-semibold" required>
                <option value="">Seleccione Carrera...</option>
                {careers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Cuatrimestre</label>
              <input value="1º Cuatrimestre" className="input-base bg-gray-100 text-gray-600 font-bold" disabled />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Escuela Procedencia <span className="text-red-600 font-black text-sm">*</span></label>
              <select name="origin_school_id" onChange={handleChange} className="input-base bg-white font-semibold" required>
                <option value="">Seleccione Escuela...</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Promedio <span className="text-red-600 font-black text-sm">*</span></label>
              <input type="number" step="0.01" name="promedio_procedencia" onChange={handleChange} className="input-base font-bold" required />
            </div>
          </div>
        </div>

        {/* DOMICILIO */}
        <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 shadow-sm">
          <h4 className="text-gray-700 font-extrabold mb-4 text-xs uppercase tracking-wider">Contacto y Domicilio</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Email Personal <span className="text-red-600 font-black text-sm">*</span></label>
              <input type="email" name="email_personal" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Email Institucional</label>
              <input type="email" name="email_institucional" onChange={handleChange} className="input-base font-semibold" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Calle <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="calle" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">No. Exterior <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="numero_domicilio" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">C.P. <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="codigo_postal" onChange={handleChange} className="input-base font-bold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Colonia <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="colonia" onChange={handleChange} className="input-base font-semibold" required />
            </div>
            <div>
              <label className="text-xs font-extrabold text-gray-500 uppercase block mb-1">Municipio <span className="text-red-600 font-black text-sm">*</span></label>
              <input name="municipio" onChange={handleChange} className="input-base font-semibold" required />
            </div>
          </div>
        </div>

        {/* DOCUMENTACIÓN */}
        <div className="border border-gray-200 rounded-lg p-5 bg-blue-50 shadow-sm">
          <h4 className="text-blue-900 font-extrabold mb-4 text-xs uppercase tracking-wider">Documentación Requerida</h4>
          <div className="grid grid-cols-2 gap-5">
            <div className="relative">
              <input type="file" name="foto" id="f-foto" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-foto" className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.foto ? 'border-green-600 bg-green-100 text-green-800' : 'border-gray-400 bg-white hover:border-blue-500'}`}>
                <span className="text-xs font-extrabold uppercase px-2 text-center">{files.foto ? `✅ ${files.foto.name}` : "Subir Foto *"}</span>
              </label>
            </div>
            <div className="relative">
              <input type="file" name="certificado" id="f-cert" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-cert" className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.certificado ? 'border-green-600 bg-green-100 text-green-800' : 'border-gray-400 bg-white hover:border-blue-500'}`}>
                <span className="text-xs font-extrabold uppercase px-2 text-center">{files.certificado ? `✅ ${files.certificado.name}` : "Subir Certificado"}</span>
              </label>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-sm shadow-xl hover:bg-blue-700 uppercase tracking-widest transition-transform transform active:scale-95">
          Registrar Nuevo Ingreso
        </button>
      </form>
    </Modal>
  );
}