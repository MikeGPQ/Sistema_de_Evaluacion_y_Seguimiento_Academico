import { useState, useEffect } from 'react';
import client from '../../lib/axios';
import Modal from '../ui/Modal';
import Swal from 'sweetalert2';
import Select from 'react-select'; 
import { useAuth } from '../../hooks/AuthContext';

// =========================================================================
// 🌟 ALGORITMO: VALIDADOR DE PREFIJO Y CONSONANTES CURP (REGLAS RENAPO)
// =========================================================================
const calcularLetrasCURP = (nombre, paterno, materno) => {
  const limpia = (str) => String(str || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nom = limpia(nombre); const pat = limpia(paterno); const mat = limpia(materno);
  if (!nom || !pat) return null;

  const ignorar = ['DE', 'LA', 'LAS', 'LOS', 'MAC', 'MC', 'VAN', 'VON', 'Y'];
  
  const getPalabraFiltro = (texto) => {
    const palabras = texto.split(' ').filter(p => !ignorar.includes(p));
    return palabras[0] || 'X';
  };

  const getNombreFiltro = (texto) => {
    const palabras = texto.split(' ').filter(p => !ignorar.includes(p));
    if (palabras.length > 1 && (palabras[0] === 'JOSE' || palabras[0] === 'MARIA')) {
      return palabras[1];
    }
    return palabras[0] || 'X';
  };

  const apellidoPat = getPalabraFiltro(pat);
  const apellidoMat = getPalabraFiltro(mat) !== 'X' ? getPalabraFiltro(mat) : '';
  const primerNom = getNombreFiltro(nom);

  // --- BLOQUE 1: PRIMERAS 4 LETRAS ---
  const letra1 = apellidoPat.charAt(0) || 'X';
  let letra2 = 'X';
  for (let i = 1; i < apellidoPat.length; i++) {
    if (['A', 'E', 'I', 'O', 'U'].includes(apellidoPat.charAt(i))) {
      letra2 = apellidoPat.charAt(i); break;
    }
  }
  const letra3 = apellidoMat ? apellidoMat.charAt(0) : 'X';
  const letra4 = primerNom.charAt(0) || 'X';
  let prefijo = `${letra1}${letra2}${letra3}${letra4}`;
  
  const malas = ['BACA','BAKA','BUEI','BUEY','CACA','CACO','CAGA','CAGO','CAKA','CAKO','COGE','COGI','COJA','COJE','COJI','COJO','COLA','CULO','FALO','FETO','GETA','GUEI','GUEY','JETA','JOTO','KACA','KACO','KAGA','KAGO','KAKA','KAKO','KOGE','KOGI','KOJA','KOJE','KOJI','KOJO','KOLA','KULO','LILO','LOCA','LOCO','LOKA','LOKO','MAME','MAMO','MEAR','MEAS','MEON','MIAR','MION','MOCO','MOKO','MUTE','NACA','NACO','PEDA','PEDO','PENE','PIPI','PITO','POPO','PUTA','PUTO','QULO','RATA','ROBA','ROBE','ROBO','RUIN','SENO','TETA','VACA','VAGA','VAGO','VAKA','VUEI','VUEY','WUEI','WUEY'];
  if (malas.includes(prefijo)) prefijo = prefijo.charAt(0) + 'X' + prefijo.substring(2);

  // --- BLOQUE 2: CONSONANTES INTERNAS (Posiciones 14, 15 y 16) ---
  const getPrimeraConsonanteInterna = (palabra) => {
    for (let i = 1; i < palabra.length; i++) {
      const char = palabra.charAt(i);
      if (/[B-DF-HJ-NP-TV-Z]/.test(char)) return char;
      if (char === 'Ñ') return 'X'; // La norma cambia la Ñ por X en consonantes internas
    }
    return 'X';
  };

  const cons1 = getPrimeraConsonanteInterna(apellidoPat);
  const cons2 = apellidoMat ? getPrimeraConsonanteInterna(apellidoMat) : 'X';
  const cons3 = getPrimeraConsonanteInterna(primerNom);
  const consonantes = `${cons1}${cons2}${cons3}`;

  return { prefijo, consonantes };
};

export default function ManualRegister({ isOpen, onClose, alumnoAEditar }) {
  const { user } = useAuth();
  const [careers, setCareers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [coloniasAPI, setColoniasAPI] = useState([]);
  const [files, setFiles] = useState({ foto: null, certificado: null });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [erroresEnVivo, setErroresEnVivo] = useState({ curp: '', email: '', promedio: '' });
  const [validacionExitosa, setValidacionExitosa] = useState({ curp: false, email: false, promedio: false });
  const [datosOriginales, setDatosOriginales] = useState(null);

  const [formData, setFormData] = useState({
    matricula: '', 
    nombre: '', apellido_paterno: '', apellido_materno: '',
    curp: '', email_personal: '', email_institucional: '', career_id: '',
    origin_school_id: '', promedio_procedencia: '',
    calle: '', numero_domicilio: '', colonia: '',
    codigo_postal: '', municipio: '', estado: 'Campeche',
    status: 'activo',
    foto_id: null, foto_nombre: null,
    certificado_id: null, certificado_nombre: null
  });

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? '#1e3a8a' : '#d1d5db', 
      boxShadow: state.isFocused ? '0 0 0 1px #1e3a8a' : 'none',
      '&:hover': { borderColor: state.isFocused ? '#1e3a8a' : '#9ca3af' },
      borderRadius: '0.375rem', padding: '2px', fontSize: '0.875rem', fontWeight: '500',
      backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff', transition: 'all 0.3s ease'
    }),
    menu: base => ({
      ...base, borderRadius: '0.5rem', overflow: 'hidden',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', animation: 'fadeIn 0.2s ease-in-out', zIndex: 50
    }),
    option: (base, state) => ({
      ...base, backgroundColor: state.isSelected ? '#1e3a8a' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1e293b', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500'
    })
  };

  useEffect(() => {
    if (isOpen) {
      setErroresEnVivo({ curp: '', email: '', promedio: '' }); 
      setValidacionExitosa({ curp: false, email: false, promedio: false });
      setFiles({ foto: null, certificado: null });
      setColoniasAPI([]);
      setFormData({
        matricula: '', nombre: '', apellido_paterno: '', apellido_materno: '',
        curp: '', email_personal: '', email_institucional: '', career_id: '',
        origin_school_id: '', promedio_procedencia: '',
        calle: '', numero_domicilio: '', colonia: '',
        codigo_postal: '', municipio: '', estado: 'Campeche', status: 'activo',
        foto_id: null, foto_nombre: null, certificado_id: null, certificado_nombre: null
      });

      client.get('/alumnos/options').then(res => {
        setCareers(res.data.careers || []);
        setSchools(res.data.schools || []);
      }).catch(err => console.error("Error al cargar catálogos:", err));

      if (alumnoAEditar) {
        setIsLoadingDetails(true);
        client.get(`/alumnos/detalle/${alumnoAEditar.matricula}`).then(res => {
            const { student, address } = res.data;
            
            let cp_sufijo = '';
            if (address.codigo_postal && address.codigo_postal.length === 5) {
                cp_sufijo = address.codigo_postal.substring(2);
                fetch(`https://api.zippopotam.us/MX/${address.codigo_postal}`)
                  .then(r => r.json())
                  .then(data => setColoniasAPI(data.places.map(p => p['place name'])))
                  .catch(() => setColoniasAPI([]));
            }

           let email_inst_limpio = student.email_institucional || '';
            if (email_inst_limpio.includes('@')) {
                email_inst_limpio = email_inst_limpio.split('@')[0];
            }

            const promRaw = String(student.promedio_procedencia || '').trim().toLowerCase();
            const esPromedioInvalido = ['', 'nan', 'null', 'none', 'undefined', '0'].includes(promRaw);
            const promedioValor = esPromedioInvalido ? '' : Math.round(student.promedio_procedencia).toString();

            const dataCargada = {
                matricula: student.matricula,
                nombre: student.nombre,
                apellido_paterno: student.apellido_paterno,
                apellido_materno: student.apellido_materno,
                curp: student.curp,
                email_personal: student.email_personal,
                email_institucional: email_inst_limpio,
                career_id: student.career_id,
                origin_school_id: student.origin_school_id,
                promedio_procedencia: promedioValor,
                calle: address.calle,
                numero_domicilio: address.numero_domicilio,
                colonia: address.colonia,
                codigo_postal: cp_sufijo,
                municipio: address.municipio,
                estado: address.estado || 'Campeche',
                status: student.status,
                foto_id: student.foto_id ?? null,
                foto_nombre: student.foto_nombre ?? null,
                certificado_id: student.certificado_id ?? null,
                certificado_nombre: student.certificado_nombre ?? null
            };
            setFormData(dataCargada);
            setDatosOriginales(dataCargada);
            
            // 🌟 REGEX ESTRICTO Y VALIDACIÓN DUAL AL ABRIR
            const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|mx|org|net|edu|gob)$/i;

            let mensajeErrorCurp = '';
            let exitoCurp = false;

            if (!curpRegex.test(student.curp)) {
              mensajeErrorCurp = '❌ La CURP importada es inválida. Debe corregirse.';
            } else {
              const letrasEsperadas = calcularLetrasCURP(student.nombre, student.apellido_paterno, student.apellido_materno);
              if (letrasEsperadas) {
                const prefijoIngresado = student.curp.substring(0, 4);
                const consonantesIngresadas = student.curp.substring(13, 16);
                
                if (prefijoIngresado !== letrasEsperadas.prefijo) {
                  mensajeErrorCurp = `❌ El inicio de la CURP no coincide. Debería ser ${letrasEsperadas.prefijo}.`;
                } else if (consonantesIngresadas !== letrasEsperadas.consonantes) {
                  mensajeErrorCurp = `❌ Las consonantes internas no coinciden. Deberían ser ${letrasEsperadas.consonantes}.`;
                } else {
                  exitoCurp = true;
                }
              }
            }

            const emailValido = emailRegex.test(student.email_personal);
            const promedioValido = promedioValor !== '';

            setValidacionExitosa({
              curp: exitoCurp,
              email: emailValido,
              promedio: promedioValido
            });

            setErroresEnVivo({
              curp: mensajeErrorCurp,
              email: emailValido ? '' : '❌ El correo importado tiene un formato dudoso.',
              promedio: promedioValido ? '' : '❌ Falta el promedio.'
            });

        }).catch(err => {
            console.error("Error obteniendo detalles:", err);
            Swal.fire('Error', 'No se pudieron cargar los detalles del alumno', 'error');
        }).finally(() => {
            setIsLoadingDetails(false);
        });
      }
    }
  }, [isOpen, alumnoAEditar]);

  useEffect(() => {
    if (isLoadingDetails) return;

    const fullCP = formData.codigo_postal.length === 3 ? `24${formData.codigo_postal}` : '';
    
    if (fullCP.length === 5) {
      fetch(`https://api.zippopotam.us/MX/${fullCP}`)
        .then(res => {
          if (!res.ok) throw new Error("C.P. no encontrado");
          return res.json();
        })
        .then(data => {
            const colonias = data.places.map(place => place['place name']);
            setColoniasAPI(colonias);
            
            const prefijo = fullCP.substring(0, 3);
            const catalogoMunicipios = {
              '240': 'Campeche', '241': 'Carmen', '242': 'Palizada', '243': 'Escárcega',
              '244': 'Champotón', '245': 'Hecelchakán', '246': 'Hopelchén', '247': 'Tenabo',
              '248': 'Calkiní', '249': 'Dzitbalché'
            };
            const municipioDetectado = catalogoMunicipios[prefijo] || '';

            setFormData(prev => ({ 
              ...prev, estado: 'Campeche', municipio: municipioDetectado, 
              colonia: colonias.includes(prev.colonia) ? prev.colonia : '' 
            })); 
        })
        .catch(() => setColoniasAPI([]));
    } else if (formData.codigo_postal.length < 3) {
        setColoniasAPI([]);
    }
  }, [formData.codigo_postal, isLoadingDetails]);

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

    if (name === 'numero_domicilio') {
      finalValue = finalValue.replace(/[^a-zA-Z0-9\s]/g, '');
    }

    if (name === 'calle') {
      finalValue = finalValue.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, '');
    }

    if (name === 'promedio_procedencia') {
      finalValue = finalValue.replace(/[^0-9]/g, '');
    }

    if (name === 'codigo_postal') {
      finalValue = finalValue.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: finalValue, colonia: '', municipio: '' }));
      return; 
    }

    if (name === 'email_institucional') {
      finalValue = finalValue.replace(/[\s@]/g, '').toLowerCase();
    } else if (name === 'email_personal') {
      finalValue = finalValue.replace(/\s/g, '').toLowerCase();
      const atIdx = finalValue.indexOf('@');
      if (atIdx !== -1) {
        finalValue = finalValue.slice(0, atIdx + 1) + finalValue.slice(atIdx + 1).replace(/@/g, '');
      }
    } else if (name === 'curp') {
      finalValue = finalValue.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));

    if (name === 'curp') {
      const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
      if (finalValue.length === 18) {
        if (!curpRegex.test(finalValue)) {
          setErroresEnVivo(prev => ({ ...prev, curp: '❌ El formato de la CURP es incorrecto.' }));
          setValidacionExitosa(prev => ({ ...prev, curp: false }));
        } else {
          // 🌟 VALIDACIÓN EN VIVO COMPLETA
          const letrasEsperadas = formData.nombre && formData.apellido_paterno 
            ? calcularLetrasCURP(formData.nombre, formData.apellido_paterno, formData.apellido_materno) 
            : null;
            
          if (letrasEsperadas) {
            const prefijoIngresado = finalValue.substring(0, 4);
            const consonantesIngresadas = finalValue.substring(13, 16);

            if (prefijoIngresado !== letrasEsperadas.prefijo) {
              setErroresEnVivo(prev => ({ ...prev, curp: `❌ El inicio de la CURP no coincide. Debería ser ${letrasEsperadas.prefijo}.` }));
              setValidacionExitosa(prev => ({ ...prev, curp: false }));
            } else if (consonantesIngresadas !== letrasEsperadas.consonantes) {
              setErroresEnVivo(prev => ({ ...prev, curp: `❌ Las consonantes internas no coinciden. Deberían ser ${letrasEsperadas.consonantes}.` }));
              setValidacionExitosa(prev => ({ ...prev, curp: false }));
            } else if (alumnoAEditar && finalValue === alumnoAEditar.curp) {
              setErroresEnVivo(prev => ({ ...prev, curp: '' }));
              setValidacionExitosa(prev => ({ ...prev, curp: true }));
            } else {
              setErroresEnVivo(prev => ({ ...prev, curp: '' }));
              setValidacionExitosa(prev => ({ ...prev, curp: false }));
            }
          }
        }
      } else {
        setErroresEnVivo(prev => ({ ...prev, curp: '' }));
        setValidacionExitosa(prev => ({ ...prev, curp: false }));
      }
    }

    if (name === 'email_personal') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|mx|org|net|edu|gob)$/i;
      const afterAt = finalValue.split('@')[1] || '';
      const looksComplete = finalValue.includes('@') && afterAt.includes('.') && afterAt.split('.').pop().length >= 2;
      if (finalValue.length === 0) {
        setErroresEnVivo(prev => ({ ...prev, email: '' }));
        setValidacionExitosa(prev => ({ ...prev, email: false }));
      } else if (looksComplete) {
        if (emailRegex.test(finalValue)) {
          if (alumnoAEditar && finalValue === alumnoAEditar.email_personal) {
            setErroresEnVivo(prev => ({ ...prev, email: '' }));
            setValidacionExitosa(prev => ({ ...prev, email: true }));
          } else {
            setErroresEnVivo(prev => ({ ...prev, email: '' }));
            setValidacionExitosa(prev => ({ ...prev, email: false }));
          }
        } else {
          setErroresEnVivo(prev => ({ ...prev, email: '❌ Formato inválido o dominio no permitido.' }));
          setValidacionExitosa(prev => ({ ...prev, email: false }));
        }
      } else {
        setErroresEnVivo(prev => ({ ...prev, email: '' }));
        setValidacionExitosa(prev => ({ ...prev, email: false }));
      }
    }
    
    if (name === 'promedio_procedencia') {
      const num = parseInt(finalValue, 10);
      if (finalValue !== '' && (num < 0 || num > 10)) {
        setErroresEnVivo(prev => ({ ...prev, promedio: '❌ El promedio debe ser entero entre 0 y 10' }));
        setValidacionExitosa(prev => ({ ...prev, promedio: false }));
      } else if (finalValue !== '') {
        setErroresEnVivo(prev => ({ ...prev, promedio: '' }));
        setValidacionExitosa(prev => ({ ...prev, promedio: true }));
      } else {
        setErroresEnVivo(prev => ({ ...prev, promedio: '' }));
        setValidacionExitosa(prev => ({ ...prev, promedio: false }));
      }
    }
  };

  const handleSelectChange = (selectedOption, actionMeta) => {
    const { name } = actionMeta;
    setFormData(prev => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
  };

const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    const file = selectedFiles[0];

    if (!file) return;

    if (name === 'foto') {
      // Validación 1: Formato JPG o PNG
      const validTypes = ['image/jpeg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        Swal.fire('Formato Inválido', 'La fotografía debe ser en formato JPG o PNG.', 'error');
        e.target.value = ''; 
        return;
      }

      // Validación 2: Peso máximo 
      const maxSizeInBytes = 2 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        Swal.fire('Archivo muy pesado', 'La fotografía no debe superar los 2MB.', 'error');
        e.target.value = '';
        return;
      }

      // Validación 3: Dimensiones mínimas 
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl); 
        if (img.width < 250 || img.height < 250) {
          Swal.fire('Dimensiones Inválidas', 'La fotografía debe tener al menos 250x250 píxeles.', 'error');
          e.target.value = '';
          return;
        }
        
        setFiles(prev => ({ ...prev, [name]: file }));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        Swal.fire('Error', 'El archivo de imagen está corrupto o no se puede leer.', 'error');
        e.target.value = '';
      };
      
      img.src = objectUrl;
      return;
    }

    if (name === 'certificado') {
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire('Archivo muy pesado', 'El certificado no debe superar los 2MB.', 'error');
        e.target.value = '';
        return;
      }
    }

    setFiles(prev => ({ ...prev, [name]: file }));
  };

  const handleCheckCurp = async () => {
    if (formData.curp.length === 18 && (!alumnoAEditar || formData.curp !== alumnoAEditar.curp)) {
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
      } catch (error) { console.error("Error", error); }
    }
  };

  const handleCheckEmail = async () => {
    if (formData.email_personal.length > 5 && (!alumnoAEditar || formData.email_personal !== alumnoAEditar.email_personal)) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|mx|org|net|edu|gob)$/i;
      if (!emailRegex.test(formData.email_personal)) {
        setErroresEnVivo(prev => ({ ...prev, email: '❌ Formato de correo inválido o sospechoso.' }));
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
      } catch (error) { console.error("Error", error); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i;
    if (!curpRegex.test(formData.curp)) return Swal.fire('Formato Inválido', 'La CURP no tiene el formato oficial. Por favor corrígela.', 'error');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|mx|org|net|edu|gob)$/i;
    if (!emailRegex.test(formData.email_personal)) return Swal.fire('Correo Inválido', 'El Correo Personal contiene un error de escritura (.comd, etc). Por favor corrígelo.', 'error');

    // 🌟 BLINDAJE FINAL DE CONCORDANCIA DUAL AL GUARDAR
    if (formData.nombre && formData.apellido_paterno && formData.curp.length === 18) {
      const letrasEsperadas = calcularLetrasCURP(formData.nombre, formData.apellido_paterno, formData.apellido_materno);
      if (letrasEsperadas) {
        const prefijoIngresado = formData.curp.substring(0, 4);
        const consonantesIngresadas = formData.curp.substring(13, 16);
        
        if (prefijoIngresado !== letrasEsperadas.prefijo) {
          return Swal.fire('Inconsistencia en Datos', `Las primeras 4 letras de la CURP no coinciden con el nombre. Deberían ser ${letrasEsperadas.prefijo}.`, 'error');
        }
        if (consonantesIngresadas !== letrasEsperadas.consonantes) {
          return Swal.fire('Inconsistencia en Datos', `Las consonantes internas de la CURP (letras 14 a 16) no coinciden. Deberían ser ${letrasEsperadas.consonantes}.`, 'error');
        }
      }
    }

    if (erroresEnVivo.curp || erroresEnVivo.email || erroresEnVivo.promedio) {
      return Swal.fire('Formulario Incompleto', 'Por favor corrige los errores antes de continuar.', 'warning');
    }

    if (!formData.career_id) return Swal.fire('Falta Carrera', 'Debes seleccionar una carrera.', 'warning');
    if (!formData.origin_school_id) return Swal.fire('Falta Escuela', 'Debes seleccionar la escuela de procedencia.', 'warning');
    if (!formData.colonia) return Swal.fire('Falta Colonia', 'Debes seleccionar una colonia.', 'warning');
    if (formData.codigo_postal.length !== 3) return Swal.fire('C.P. Inválido', 'El código postal debe estar completo.', 'warning');

    const tieneFotoPrevia = !!formData.foto_id;
    const esEstatusExento = formData.status?.toLowerCase().includes('baja'); 
    
    if (!files.foto && !tieneFotoPrevia && !esEstatusExento) {
        return Swal.fire('Falta la Fotografía', 'La fotografía es obligatoria para alumnos activos. Este alumno no tiene una foto registrada.', 'warning');
    }

    setIsLoading(true);

    let finalEmailInstitucional = null;
    if (formData.email_institucional.trim() !== "") {
      const rawEmail = formData.email_institucional.trim().toLowerCase();
      finalEmailInstitucional = `${rawEmail}@red.unid.mx`;
    }

    const { status, foto_id, foto_nombre, certificado_id, certificado_nombre, ...restFormData } = formData;
    const dataPayload = {
      ...restFormData,
      usuario_id: user?.identifier || user?.email || "Admin Local",
      career_id: parseInt(formData.career_id),
      origin_school_id: parseInt(formData.origin_school_id),
      promedio_procedencia: parseInt(formData.promedio_procedencia, 10),
      email_institucional: finalEmailInstitucional,
      cuatrimestre: 1,
      address: {
        calle: formData.calle, numero_domicilio: formData.numero_domicilio,
        colonia: formData.colonia, codigo_postal: `24${formData.codigo_postal}`, 
        municipio: formData.municipio, estado: 'Campeche' 
      }
    };

    const dataToSend = new FormData();
    dataToSend.append('student_data', JSON.stringify(dataPayload));
    if (files.foto) dataToSend.append('foto_perfil', files.foto);
    if (files.certificado) dataToSend.append('certificado', files.certificado);

    try {
      if (alumnoAEditar) {
         await client.put(`/alumnos/actualizar/${alumnoAEditar.matricula}`, dataToSend);
         Swal.fire({ title: 'Actualizado', text: 'Los datos del alumno han sido actualizados', icon: 'success', confirmButtonColor: '#f59e0b' }).then(() => onClose());
      } else {
         const res = await client.post('/alumnos/register', dataToSend);
         Swal.fire({ title: 'Guardado', text: `Matrícula generada: ${res.data.matricula}`, icon: 'success', confirmButtonColor: '#f59e0b' }).then(() => onClose());
      }
    } catch (error) {
      Swal.fire('Error', error.response?.data?.detail || "Fallo en el servidor.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const careerOptions = careers.map(c => ({ value: c.id, label: c.name }));
  const schoolOptions = schools.map(s => ({ value: s.id, label: s.name }));
  const coloniaOptions = coloniasAPI.map(col => ({ value: col, label: col }));

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      {isLoadingDetails ? (
        <div className="flex flex-col items-center justify-center p-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-bold">Cargando datos del alumno...</p>
        </div>
      ) : (
      <>
      <div className="bg-[#1e3a8a] p-6 rounded-t-lg -mx-6 -mt-6 mb-6">
        <button onClick={onClose} className="flex items-center text-blue-200 hover:text-white text-sm mb-3 transition-colors font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Volver a inicio
        </button>
        <h2 className="text-2xl font-bold text-white">
            {alumnoAEditar ? 'Edición de Alumno' : 'Alta de Alumno'}
        </h2>
        <p className="text-blue-200 text-sm mt-1">
            {alumnoAEditar ? 'Modifique la información del alumno seleccionado.' : 'Complete los datos del alumno para registrarlo en el sistema'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-slate-50 p-2 md:p-6 rounded-lg">
        
        {/* 1. INFORMACIÓN PERSONAL */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">👤</div>
            Información Personal
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">ID UNID (Matrícula)</label>
              <input value={alumnoAEditar ? formData.matricula : "Se genera automáticamente al guardar"} className="w-full border border-gray-200 rounded-md p-2.5 text-sm text-gray-500 bg-gray-100 outline-none font-bold tracking-wider" disabled />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nombre(s) <span className="text-red-500">*</span></label>
              <input name="nombre" value={formData.nombre} maxLength={50} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Paterno <span className="text-red-500">*</span></label>
              <input name="apellido_paterno" value={formData.apellido_paterno} maxLength={50} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Apellido Materno <span className="text-red-500">*</span></label>
              <input name="apellido_materno" value={formData.apellido_materno} maxLength={50} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">CURP <span className="text-red-500">*</span></label>
              <input name="curp" value={formData.curp} onChange={handleChange} onBlur={handleCheckCurp} 
                className={`w-full border rounded-md p-2.5 text-sm uppercase outline-none font-bold tracking-wider transition-all focus:ring-1 ${erroresEnVivo.curp ? 'border-red-500 bg-red-50 focus:ring-red-500 text-red-700' : validacionExitosa.curp ? 'border-green-500 bg-green-50 focus:ring-green-500 text-green-700' : 'border-gray-300 focus:border-[#1e3a8a]'}`} maxLength={18} required />
              <div className="flex justify-between items-start mt-1">
                <div>
                  {erroresEnVivo.curp && <p className="text-xs text-red-600 font-bold animate-pulse">{erroresEnVivo.curp}</p>}
                  {validacionExitosa.curp && !erroresEnVivo.curp && <p className="text-xs text-green-600 font-bold">✓ CURP válida</p>}
                  {!erroresEnVivo.curp && !validacionExitosa.curp && formData.curp.length === 18 && <p className="text-xs text-blue-600 font-medium">✓ Formato correcto</p>}
                </div>
                <span className={`text-xs font-mono ${formData.curp.length === 18 ? (erroresEnVivo.curp ? 'text-red-500' : 'text-green-600') : 'text-gray-400'}`}>
                  {formData.curp.length}/18
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. INFORMACIÓN ACADÉMICA */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">🎓</div>
            Información Académica
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Programa Académico <span className="text-red-500">*</span></label>
              <Select name="career_id" options={careerOptions} onChange={handleSelectChange} value={careerOptions.find(opt => opt.value === formData.career_id) || null} placeholder="Seleccione una carrera..." styles={customSelectStyles} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Escuela de Procedencia <span className="text-red-500">*</span></label>
              <Select name="origin_school_id" options={schoolOptions} onChange={handleSelectChange} value={schoolOptions.find(opt => opt.value === formData.origin_school_id) || null} placeholder="Seleccione..." styles={customSelectStyles} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Promedio General <span className="text-red-500">*</span></label>
              <input
                type="text" inputMode="numeric" maxLength="2" name="promedio_procedencia" value={formData.promedio_procedencia}
                onChange={handleChange} disabled={!!alumnoAEditar}
                className={`w-full border rounded-md p-2.5 text-sm outline-none transition-all ${alumnoAEditar ? 'bg-gray-100 text-gray-500 border-gray-200' : erroresEnVivo.promedio ? 'border-red-500 bg-red-50 focus:ring-red-500 text-red-700' : 'border-gray-300 focus:border-[#1e3a8a]'}`} required
              />
              {erroresEnVivo.promedio && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.promedio}</p>}
              {validacionExitosa.promedio && !erroresEnVivo.promedio && <p className="text-xs text-blue-600 mt-1.5 font-medium">✓ Promedio correcto</p>}
            </div>
          </div>
        </div>

        {/* 3. DIRECCIÓN / CONTACTO */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-6 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">📍</div>
            Dirección y Contacto
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Institucional</label>
              <div className="flex">
                <input type="text" name="email_institucional" value={formData.email_institucional} onChange={handleChange} className="w-full border border-gray-300 rounded-l-md p-2.5 text-sm lowercase focus:border-[#1e3a8a] outline-none" />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">@red.unid.mx</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Correo Personal <span className="text-red-500">*</span></label>
              <input type="email" name="email_personal" value={formData.email_personal} onChange={handleChange} onBlur={handleCheckEmail} onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
                className={`w-full border rounded-md p-2.5 text-sm lowercase outline-none transition-all ${erroresEnVivo.email ? 'border-red-500 bg-red-50 focus:ring-red-500 text-red-700' : validacionExitosa.email ? 'border-green-500 bg-green-50 focus:ring-green-500 text-green-700' : 'border-gray-300 focus:border-[#1e3a8a]'}`} required />
              {erroresEnVivo.email && <p className="text-xs text-red-600 mt-1.5 font-bold animate-pulse">{erroresEnVivo.email}</p>}
              {validacionExitosa.email && !erroresEnVivo.email && <p className="text-xs text-green-600 mt-1.5 font-bold">✓ Correo válido</p>}
              {!erroresEnVivo.email && !validacionExitosa.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|mx|org|net|edu|gob)$/i.test(formData.email_personal) &&
                <p className="text-xs text-blue-600 mt-1.5 font-medium">✓ Formato correcto</p>}
            </div>

            <div className="md:col-span-2 mt-4 border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Calle <span className="text-red-500">*</span></label>
                <input name="calle" value={formData.calle} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Número Exterior <span className="text-red-500">*</span></label>
                <input name="numero_domicilio" value={formData.numero_domicilio} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Código Postal (Estado) <span className="text-red-500">*</span></label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 font-bold text-sm">24</span>
                  <input name="codigo_postal" value={formData.codigo_postal} maxLength={3} onChange={handleChange} className="w-full border border-gray-300 rounded-r-md p-2.5 text-sm focus:border-[#1e3a8a] outline-none font-bold tracking-wider" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Colonia <span className="text-red-500">*</span></label>
                <Select name="colonia" options={coloniaOptions} onChange={handleSelectChange} value={coloniaOptions.find(opt => opt.value === formData.colonia) || null} placeholder={coloniasAPI.length > 0 ? "Seleccione..." : "Escriba Código Postal"} styles={customSelectStyles} isDisabled={coloniasAPI.length === 0} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Ciudad / Municipio <span className="text-red-500">*</span></label>
                <input name="municipio" value={formData.municipio} onChange={handleChange} readOnly={coloniasAPI.length > 0 && formData.municipio !== ''} className={`w-full border rounded-md p-2.5 text-sm outline-none transition-colors ${coloniasAPI.length > 0 && formData.municipio !== '' ? 'bg-gray-100 text-gray-500 border-transparent' : 'border-gray-300 focus:border-[#1e3a8a]'}`} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Estado <span className="text-red-500">*</span></label>
                <input value={formData.estado || "Campeche"} disabled className="w-full border border-gray-200 rounded-md p-2.5 text-sm bg-gray-50 outline-none text-gray-500 font-medium" />
              </div>
            </div>
          </div>
        </div>

        {/* 4. DOCUMENTOS MULTIMEDIA */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <h4 className="flex items-center text-[#1e3a8a] font-bold mb-4 text-base">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-3">📁</div>
            Expediente Digital
          </h4>
          <div className="grid grid-cols-2 gap-5">
            <div className="relative group">
              <input type="file" name="foto" id="f-foto" accept="image/jpeg, image/png" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-foto" className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.foto ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 text-gray-400'}`}>
                <span className="text-xs font-bold uppercase tracking-wider text-center px-2">
                    {files.foto
                      ? `✅ ${files.foto.name}`
                      : alumnoAEditar
                        ? formData.foto_id
                          ? formData.foto_nombre ? `📷 ${formData.foto_nombre}` : "Actualizar Fotografía (Opcional)"
                          : formData.status?.toLowerCase().includes('baja') ? "Agregar Fotografía (Opcional)" : "Agregar Fotografía *"
                        : "Subir Fotografía *"}
                </span>
              </label>
            </div>
            <div className="relative group">
              <input type="file" name="certificado" id="f-cert" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <label htmlFor="f-cert" className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${files.certificado ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 text-gray-400'}`}>
                <span className="text-xs font-bold uppercase tracking-wider text-center px-2">
                    {files.certificado
                      ? `✅ ${files.certificado.name}`
                      : alumnoAEditar
                        ? formData.certificado_id
                          ? formData.certificado_nombre ? `📄 ${formData.certificado_nombre}` : "Actualizar Certificado (Opcional)"
                          : "Agregar Certificado (Opcional)"
                        : "Subir Certificado"}
                </span>
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
            {(() => {
              const camposEditables = ['nombre', 'apellido_paterno', 'apellido_materno', 'curp', 'email_personal', 'email_institucional', 'career_id', 'origin_school_id', 'calle', 'numero_domicilio', 'colonia', 'codigo_postal', 'municipio', 'estado'];
              const sinCambios = !!(alumnoAEditar && datosOriginales && !camposEditables.some(c => String(formData[c] ?? '') !== String(datosOriginales[c] ?? '')) && !files.foto && !files.certificado);
              const deshabilitado = isLoading || !!erroresEnVivo.curp || !!erroresEnVivo.email || !!erroresEnVivo.promedio || sinCambios;
              return (
                <button type="submit" disabled={deshabilitado} className={`flex items-center px-6 py-2 rounded-md text-sm font-bold text-white shadow-sm transition-all ${deshabilitado ? 'bg-amber-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}>
                  <span className="mr-2">💾</span>
                  {isLoading ? 'Procesando...' : (alumnoAEditar ? 'Actualizar Alumno' : 'Guardar Alumno')}
                </button>
              );
            })()}
          </div>
        </div>
      </form>
      </>
      )}
    </Modal>
  );
}