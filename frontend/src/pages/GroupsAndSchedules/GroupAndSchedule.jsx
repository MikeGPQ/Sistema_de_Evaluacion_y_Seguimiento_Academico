import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, ArrowLeft, BookOpen, Clock, AlertTriangle, 
  CheckCircle, Save, Calendar, User, Download, ChevronRight, ChevronLeft, Zap, Layers
} from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';
import { useAuth } from '../../hooks/AuthContext';

const HORAS_CLASE = [
  "7:00 - 8:00", "8:00 - 9:00", "9:00 - 10:00", 
  "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", 
  "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
  "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00",
  "19:00 - 20:00", "20:00 - 21:00"
];
const DIAS_SEMANA = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

const timeToMinutes = (t) => {
  if (!t) return 0;
  const partes = t.toString().trim().split(':');
  const h = parseInt(partes[0], 10) || 0;
  const m = parseInt(partes[1], 10) || 0;
  return h * 60 + m;
};

// Normaliza textos para evitar errores por "Miércoles" vs "Miercoles"
const normalizarDia = (str) => {
  return str ? str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
};

const GroupAndSchedule = () => {
  const { user } = useAuth();
  const [materiasAdelanto, setMateriasAdelanto] = useState([]);
  const navigate = useNavigate();
  const [vistaActual, setVistaActual] = useState('asignacion'); 
  
  const [matriculaBuscada, setMatriculaBuscada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [materiasRegulares, setMateriasRegulares] = useState([]);
  const [materiasRecursamiento, setMateriasRecursamiento] = useState([]);
  const [horarioReal, setHorarioReal] = useState([]); 
  
  const [seleccion, setSeleccion] = useState({});
  const [seleccionOriginal, setSeleccionOriginal] = useState({}); 
  const [inscripcionesOriginales, setInscripcionesOriginales] = useState([]);
  
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const seleccionValues = Object.values(seleccion).map(s => s.group_id).sort().join(',');
  const originalValues = [...inscripcionesOriginales].sort().join(',');
  const hayCambios = seleccionValues !== originalValues;

  useEffect(() => {
    const handleBeforeUnload = (evento) => {
      if (hayCambios) {
        evento.preventDefault();
        evento.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hayCambios]);

  // funcion para proteger acciones que pueden causar perdida de cambios guardados
  const ejecutarConProteccion = async (accionConfirmada) => {
    if (hayCambios) {
      const confirmacion = await Swal.fire({
        title: '¿Salir sin guardar?',
        text: 'Tienes materias seleccionadas sin confirmar. Si continuas, los cambios en progreso serán descartados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#1A237E',
        confirmButtonText: 'Sí, descartar cambios',
        cancelButtonText: 'Cancelar'
      });

      if (confirmacion.isConfirmed) {
        setSeleccion(seleccionOriginal);
        accionConfirmada();
      }
    } else {
      accionConfirmada();
    }
  };

  // funcion para buscar alumno y cargar su informacion y catalogo de materias disponibles
  const buscarAlumno = async (matriculaAUsar = matriculaBuscada) => {
    if (!matriculaAUsar) return;
    setCargando(true);
    setAlumnoInfo(null);
    setSeleccion({});
    setSeleccionOriginal({});
    setInscripcionesOriginales([]); 
    setMostrarSugerencias(false); 
    setHorarioReal([]);

    try {
      const response = await client.get(`/asignacion/${matriculaAUsar}/disponibles`);
      const data = response.data;
      
      if (data.alumno_cuatrimestre !== 1) {
        Swal.fire({
          icon: 'warning',
          title: 'Acceso Denegado',
          text: `El alumno se encuentra en el ${data.alumno_cuatrimestre}º cuatrimestre. El módulo es exclusivo para Nuevo Ingreso.`,
          confirmButtonColor: '#1A237E'
        });
        setCargando(false);
        setMatriculaBuscada(''); 
        return; 
      }
      
      try {
        const resHorario = await client.get(`/asignacion/${matriculaAUsar}/horario`);
        setHorarioReal(resHorario.data);
      } catch (err) {
        console.error("Informacion de horario no disponible.", err);
      }

      setAlumnoInfo({
        matricula: data.alumno_matricula,
        nombre: data.alumno_nombre,
        cuatrimestre: data.alumno_cuatrimestre,
        carrera: data.carrera,
        grupoBase: data.grupo_base,
        bloqueado: data.grupo_base_bloqueado,
        esMaestria: data.es_maestria
      });
      
      setMateriasRegulares(data.materias_regulares);
      setMateriasRecursamiento(data.materias_recursamiento);
      setMateriasAdelanto(data.materias_adelanto || []);

      const seleccionInicial = {};
      const gruposQueYaTenia = data.grupos_inscritos || [];

      if (data.es_maestria) {
        data.materias_regulares.forEach(mat => {
          const yaInscrita = mat.grupos_disponibles.find(g => gruposQueYaTenia.includes(g.group_id));
            if (yaInscrita) {
              seleccionInicial[mat.subject_id] = { group_id: yaInscrita.group_id, is_retake: false, es_adelanto: false };
            } else {
              const grupoDisponible = mat.grupos_disponibles.find(g => g.cupo_disponible > 0);
              if (grupoDisponible) {
                seleccionInicial[mat.subject_id] = { group_id: grupoDisponible.group_id, is_retake: false, es_adelanto: false };
              }
            }
        });
      }

      const escanearCatalogo = (catalogo, isRetake, isAdelanto = false) => {
        catalogo.forEach(mat => {
          mat.grupos_disponibles.forEach(g => {
            if (gruposQueYaTenia.includes(g.group_id)) {
              seleccionInicial[mat.subject_id] = { 
                group_id: g.group_id, 
                is_retake: isRetake,
                es_adelanto: isAdelanto 
              };
            }
          });
        });
      };

      escanearCatalogo(data.materias_regulares, false);
      escanearCatalogo(data.materias_recursamiento, true);
      escanearCatalogo(data.materias_adelanto || [], false, true);
      setSeleccion(seleccionInicial);
      setSeleccionOriginal(seleccionInicial);
      setInscripcionesOriginales(gruposQueYaTenia);
      setVistaActual('asignacion');

    } catch (error) {
      const mensajeBackend = error.response?.data?.detail || 'No existen registros asociados a la matricula proporcionada.';
      const esBloqueo = error.response?.status === 403; 

      Swal.fire({ 
        icon: esBloqueo ? 'warning' : 'error', 
        title: esBloqueo ? 'Acción Bloqueada' : 'Error de Consulta', 
        text: mensajeBackend,
        confirmButtonColor: '#1A237E'
      });
      
      if (esBloqueo) setMatriculaBuscada(''); 
    } finally {
      setCargando(false);
    }
  };

  // funcion para manejar el cambio de input de matricula y mostrar surgerencias
  const handleCambioInput = async (e) => {
    const valor = e.target.value.replace(/\D/g, ''); 
    setMatriculaBuscada(valor);

    if (valor.length >= 3 && valor.length < 8) {
      try {
        const res = await client.get(`/asignacion/buscar-alumno?q=${valor}`);
        setSugerencias(res.data);
        setMostrarSugerencias(true);
      } catch (error) {
        setSugerencias([]);
      }
    } else {
      setMostrarSugerencias(false);
    }
  };

  // funcion para manejar la seleccion de sugerencia de alumno
  const handleSeleccionarSugerencia = (matriculaElegida) => {
    ejecutarConProteccion(() => {
      setMatriculaBuscada(matriculaElegida);
      setMostrarSugerencias(false); 
      buscarAlumno(matriculaElegida); 
    });
  };

const verificarChoquesFront = (grupoEvaluar, seleccionActual) => {
    try {
      const seleccionIds = Object.values(seleccionActual).map(s => s.group_id);

      if (alumnoInfo.esMaestria) {
        const getModuleInfo = (groupId) => {
          let idx = materiasRegulares.findIndex(mat => mat.grupos_disponibles.some(g => g.group_id === groupId));
          if (idx !== -1) return { index: idx, modulo: (idx % 3) + 1 };
          
          idx = materiasAdelanto.findIndex(mat => mat.grupos_disponibles.some(g => g.group_id === groupId));
          if (idx !== -1) return { index: idx, modulo: (idx % 3) + 1 };
          
          idx = materiasRecursamiento.findIndex(mat => mat.grupos_disponibles.some(g => g.group_id === groupId));
          if (idx !== -1) return { index: idx, modulo: (idx % 3) + 1 };

          return null;
        };

        const infoEvaluar = getModuleInfo(grupoEvaluar.group_id);
        
        if (infoEvaluar) {
          const sesionesEvaluar = grupoEvaluar.horario_raw || [];
          
          for (const subjectId of Object.keys(seleccionActual)) {
            const groupIdSeleccionado = seleccionActual[subjectId].group_id;
            const infoSel = getModuleInfo(groupIdSeleccionado);
            
            if (infoSel && infoSel.modulo === infoEvaluar.modulo) {
                let grupoSeleccionadoObj = null;
                let nombreMateriaChoque = "Asignatura Asignada";
                
                [...materiasRegulares, ...materiasAdelanto, ...materiasRecursamiento].forEach(mat => {
                    const g = mat.grupos_disponibles.find(x => x.group_id === groupIdSeleccionado);
                    if (g) {
                      grupoSeleccionadoObj = g;
                      nombreMateriaChoque = mat.nombre;
                    }
                });

                if (grupoSeleccionadoObj) {
                  const sesionesSel = grupoSeleccionadoObj.horario_raw || [];
                  for (const s1 of sesionesEvaluar) {
                    for (const s2 of sesionesSel) {
                      const dia1 = normalizarDia(s1.dia);
                      const dia2 = normalizarDia(s2.dia);
                      
                      if (dia1 && dia2 && dia1 === dia2) {
                        const ini1 = timeToMinutes(s1.inicio); 
                        const fin1 = timeToMinutes(s1.fin);
                        const ini2 = timeToMinutes(s2.inicio); 
                        const fin2 = timeToMinutes(s2.fin);
                        
                        if (ini1 < fin2 && fin1 > ini2) {
                          return { 
                            hayChoque: true, 
                            materiaChoque: nombreMateriaChoque, 
                            dia: `${s1.dia} (Módulo Secuencial ${infoEvaluar.modulo})` 
                          };
                        }
                      }
                    }
                  }
                }
            }
          }
        }
        return { hayChoque: false };
      }

      const sesionesEvaluar = grupoEvaluar.horario_raw || [];
      for (const mat of [...materiasRegulares, ...materiasRecursamiento, ...materiasAdelanto]) {
        for (const g of mat.grupos_disponibles) {
          if (seleccionIds.includes(g.group_id)) {
             const sesionesSel = g.horario_raw || [];
             for (const s1 of sesionesEvaluar) {
               for (const s2 of sesionesSel) {
                 const dia1 = normalizarDia(s1.dia);
                 const dia2 = normalizarDia(s2.dia);
                 if (dia1 && dia2 && dia1 === dia2) {
                   const ini1 = timeToMinutes(s1.inicio); 
                   const fin1 = timeToMinutes(s1.fin);
                   const ini2 = timeToMinutes(s2.inicio); 
                   const fin2 = timeToMinutes(s2.fin);
                   
                   if (ini1 < fin2 && fin1 > ini2) {
                     return { hayChoque: true, materiaChoque: mat.nombre, dia: s1.dia };
                   }
                 }
               }
             }
          }
        }
      }
      return { hayChoque: false };
    } catch (error) {
      return { hayChoque: false };
    }
  };

  // manejo de seleccion de grupo
  //funcion que maneja la seleccion y deseleccion de grupos, con proteccion de cambios y validacion de choques
  const handleSeleccionGrupo = async (subjectId, groupId, isRetake, esAdelanto = false) => {
    if (seleccion[subjectId]?.group_id === groupId) {
      if (inscripcionesOriginales.includes(groupId)) {
        const confirmacion = await Swal.fire({
          title: '¿Confirmar desvinculación?',
          text: 'Esta acción eliminará el registro del alumno en esta asignatura. Proceder implica alterar la carga académica oficial.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#1A237E',
          confirmButtonText: 'Confirmar baja',
          cancelButtonText: 'Cancelar'
        });

        if (!confirmacion.isConfirmed) return;

        const nuevaSeleccion = { ...seleccion };
        delete nuevaSeleccion[subjectId];
        const materiasPayload = Object.entries(nuevaSeleccion).map(([sid, data]) => ({
          subject_id: parseInt(sid),
          group_id: data.group_id,
          is_retake: data.is_retake,
          es_adelanto: data.es_adelanto || false
        }));
        
        try {
          await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, { 
              materias: materiasPayload,
              usuario_id: user?.identifier || user?.email || "Admin Local"
          });
          
          await Swal.fire({ icon: 'success', title: 'Operación exitosa', text: 'Baja registrada en el sistema.', confirmButtonColor: '#1A237E' });
          await buscarAlumno(alumnoInfo.matricula);
          
        } catch (error) {
          Swal.fire({ icon: 'error', title: 'Fallo de operación', text: error.response?.data?.detail || 'Imposible completar la transacción.', confirmButtonColor: '#1A237E' });
        }
        return;
      }

      setSeleccion(prev => {
        const nueva = { ...prev };
        delete nueva[subjectId];
        return nueva;
      });

    } else {
      let grupoNuevo = null;
      [...materiasRegulares, ...materiasRecursamiento, ...materiasAdelanto].forEach(mat => {
        if (mat.subject_id === subjectId) {
          const g = mat.grupos_disponibles.find(x => x.group_id === groupId);
          if (g) grupoNuevo = g;
        }
      });

      if (grupoNuevo) {
        const choque = verificarChoquesFront(grupoNuevo, seleccion);
        if (choque.hayChoque) {
          Swal.fire({
            icon: 'error', title: 'Conflicto de Horarios',
            text: `Incompatibilidad detectada el día ${choque.dia} con la asignatura: '${choque.materiaChoque}'.`,
            confirmButtonColor: '#1A237E'
          });
          return; 
        }
      }

      setSeleccion(prev => ({
        ...prev,
        [subjectId]: { group_id: groupId, is_retake: isRetake, es_adelanto: esAdelanto }
      }));
    }
  };

  // funcion para manejar la carga automatica de materias, priorizando tronco comun y validando choques 
  const handleCargaAutomatica = async () => {
    const confirmacion = await Swal.fire({
      title: 'Inscripción en Bloque (Nuevo Ingreso)',
      text: 'El sistema asignará automáticamente el paquete oficial de 1er cuatrimestre correspondiente a la carrera del alumno. ¿Desea proceder?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#22c55e'
    });
    
    if (!confirmacion.isConfirmed) return;

    setGuardando(true);
    try {
      const response = await client.post(`/asignacion/${alumnoInfo.matricula}/carga-bloque-nuevo-ingreso`);
      
      await Swal.fire({ 
        icon: 'success', 
        title: 'Asignación Oficial Completada', 
        text: response.data.message, 
        confirmButtonColor: '#1A237E'
      });
      
      // Recargamos el alumno para ver la carga oficial reflejada en pantalla y en el PDF
      await buscarAlumno(alumnoInfo.matricula);

    } catch (error) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Error de Asignación', 
        text: error.response?.data?.detail || 'No se pudo generar la carga en bloque automática.', 
        confirmButtonColor: '#1A237E' 
      });
    } finally {
      setGuardando(false);
    }
  };

  // funcion para guardar la seleccion actual 
  const handleGuardarCarga = async () => {
    const materiasPayload = Object.entries(seleccion).map(([subjectId, data]) => ({
      subject_id: parseInt(subjectId),
      group_id: data.group_id,
      is_retake: data.is_retake,
      es_adelanto: data.es_adelanto || false
    }));

    if (materiasPayload.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Advertencia', text: 'El conjunto de selección se encuentra vacío.' });
      return;
    }

    setGuardando(true);
    try {
      const response = await client.post(`/asignacion/${alumnoInfo.matricula}/guardar`, {
        materias: materiasPayload,
        usuario_id: user?.identifier || user?.email || "Admin Local"
      });
      
      await Swal.fire({
        icon: 'success',
        title: 'Transacción Confirmada',
        text: response.data.message,
        confirmButtonColor: '#1A237E'
      });

      await buscarAlumno(alumnoInfo.matricula);

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: error.response?.data?.detail || 'No se pudo sincronizar la transacción de carga académica.',
        confirmButtonColor: '#1A237E'
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('horario-imprimible');
    if (!input || !alumnoInfo) return;

    Swal.fire({ 
      title: 'Generando PDF', 
      text: 'Procesando paginación...', 
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    const originalClasses = input.className;
    const originalStyle = input.getAttribute('style') || '';
    const scrollableDiv = input.querySelector('.overflow-x-auto');
    const originalOverflowX = scrollableDiv ? scrollableDiv.style.overflowX : '';

    try {
      window.scrollTo(0, 0);
      input.className = input.className.replace('overflow-hidden', '');
      if (scrollableDiv) scrollableDiv.style.overflowX = 'visible';

      await new Promise(resolve => setTimeout(resolve, 300));

      const exactWidth = input.scrollWidth;
      const exactHeight = input.scrollHeight + 20;
      
      input.style.width = `${exactWidth}px`;
      input.style.height = `${exactHeight}px`;
      input.style.maxHeight = 'none';

      const dataUrl = await toJpeg(input, { 
        quality: 0.9, 
        backgroundColor: '#ffffff', 
        pixelRatio: 2,
        width: exactWidth,
        height: exactHeight
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const imgScaledHeight = (exactHeight * contentWidth) / exactWidth;
      
      const headerAreaHeight = 58; 
      const footerAreaHeight = 15; 
      const contentHeightPerPage = pdfHeight - headerAreaHeight - footerAreaHeight;
      
      let heightLeft = imgScaledHeight;
      let position = 0;
      let pageNumber = 1;

      const renderizarHeader = (doc) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pdfWidth, headerAreaHeight - 2, 'F');

        doc.setFillColor(15, 23, 42);
        doc.roundedRect(15, 15, 14, 14, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("U", 22, 24.5, { align: "center" });

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(22);
        doc.text("UNID", 33, 22);

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Universidad Interamericana para el Desarrollo", 33, 27);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text("HORARIO ESCOLAR OFICIAL", pdfWidth - 15, 25, { align: "right" });

        doc.setDrawColor(242, 169, 0);
        doc.setLineWidth(1.5);
        doc.line(15, 36, pdfWidth - 15, 36);

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "normal");
        doc.text(`Alumno: ${alumnoInfo.nombre} | Matrícula: ${alumnoInfo.matricula}`, 15, 45);
        doc.text(`Periodo: 2026-1 | Carrera: ${alumnoInfo.carrera}`, 15, 50);
      };

      const renderizarFooter = (doc, pNum) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, pdfHeight - footerAreaHeight, pdfWidth, footerAreaHeight, 'F');
        
        doc.setFontSize(8); 
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "italic");
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 15, pdfHeight - 8);
        doc.text(`Página ${pNum}`, pdfWidth - 15, pdfHeight - 8, { align: "right" });
      };

      while (heightLeft > 0) {
        if (pageNumber > 1) pdf.addPage();

        pdf.addImage(
          dataUrl, 'JPEG', 
          margin, headerAreaHeight - position, 
          contentWidth, imgScaledHeight
        );

        renderizarHeader(pdf);
        renderizarFooter(pdf, pageNumber);

        heightLeft -= contentHeightPerPage;
        position += contentHeightPerPage;
        pageNumber++;
      }

      pdf.save(`Horario_${alumnoInfo.matricula}.pdf`);
      
    } catch (error) { 
      console.error(error);
      Swal.fire('Error', 'No se pudo generar el archivo segmentado.', 'error'); 
    } finally {
      input.className = originalClasses;
      input.setAttribute('style', originalStyle);
      if (scrollableDiv) scrollableDiv.style.overflowX = originalOverflowX;
      Swal.close();
    }
  };

  // componente para mostrar cada materia con sus grupos disponibles, indicando si es recursamiento , tronco comun o carrera
  const TarjetaMateria = ({ materia, isRetake, isAdelanto = false }) => {
    let colorEtiqueta = 'bg-blue-100 text-blue-800 border-blue-200'; 
    
    if (isRetake) {
      colorEtiqueta = 'bg-red-100 text-red-800 border-red-200'; 
    } else if (materia.tipo === 'Tronco Común') {
      colorEtiqueta = 'bg-amber-100 text-amber-800 border-amber-300'; 
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4 hover:border-blue-300 transition-colors">
        <div className="flex justify-between items-start mb-3 border-b pb-2">
          <div>
            <h4 className="font-bold text-gray-800 text-sm">{materia.nombre}</h4>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block border ${colorEtiqueta}`}>
              {isAdelanto ? 'Adelanto Extra' : materia.tipo}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-mono">{materia.subject_id}</span>
        </div>

        <div className="space-y-2">
          {/* mostrar informacion del grupo no disponible*/}
          {materia.grupos_disponibles.length === 0 ? (
            <div 
              className="bg-gray-50 border border-gray-200 border-dashed rounded-md p-4 text-center cursor-help"
              title="Por el momento no hay grupos abiertos para esta materia. Dirígete con la coordinadora académica."
            >
              <p className="text-xs text-gray-400 font-medium">
                Sin grupos disponibles en este periodo
              </p>
            </div>
          ) : (
            materia.grupos_disponibles.map((grupo) => {
              const isLleno = grupo.cupo_disponible === 0;
              const isSelected = seleccion[materia.subject_id]?.group_id === grupo.group_id;

              return (
                <div 
                  key={grupo.group_id} 
                  onClick={() => {
                    if (!isLleno) {
                      handleSeleccionGrupo(materia.subject_id, grupo.group_id, isRetake, isAdelanto);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${isLleno ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'bg-blue-50 border-[#1A237E] ring-1 ring-[#1A237E]' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 text-[#1A237E] focus:ring-[#1A237E] pointer-events-none"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-800">Grupo {grupo.nombre}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {grupo.horario}
                      </p>
                      {grupo.aula && (
                        <p className="text-xs text-gray-400 mt-0.5">Aula: {grupo.aula}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${isLleno ? 'text-red-500' : 'text-green-600'}`}>
                      {isLleno ? 'Cupo Lleno' : `${grupo.cupo_disponible} lugares`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const materiasTronco = materiasRegulares.filter(m => m.tipo === 'Tronco Común');
  const materiasCarrera = materiasRegulares.filter(m => m.tipo !== 'Tronco Común');

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">
           Inicio &gt; 
           <button onClick={() => ejecutarConProteccion(() => navigate('/alumnos/listado'))} className="mx-1 hover:text-[#1A237E] hover:underline transition-colors focus:outline-none">
             Alumnos
           </button> 
           &gt; <span className="text-[#1A237E] ml-1 font-bold">Asignación de Horarios</span>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
              <button 
                onClick={() => ejecutarConProteccion(() => navigate('/alumnos/listado'))}
                className="flex items-center text-sm text-gray-600 hover:text-[#1A237E] font-medium mb-4 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                Volver al listado
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Asignación de Horarios y Grupos</h1>
              <p className="text-gray-500 text-sm">Gestiona la carga académica, recursamientos y validación de cupos.</p>
            </div>

            {alumnoInfo && (
              <div className="flex bg-gray-200 p-1 rounded-lg shadow-inner">
                <button onClick={() => ejecutarConProteccion(() => setVistaActual('asignacion'))} className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${vistaActual === 'asignacion' ? 'bg-white shadow text-[#1A237E]' : 'text-gray-500 hover:text-gray-700'}`}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Asignar Carga
                </button>
                <button onClick={() => ejecutarConProteccion(() => setVistaActual('horario'))} className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${vistaActual === 'horario' ? 'bg-white shadow text-[#1A237E]' : 'text-gray-500 hover:text-gray-700'}`}>
                  Ver Horario <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Buscar Alumno por Matrícula</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={matriculaBuscada}
                  maxLength={8}
                  onChange={handleCambioInput}
                  onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                  placeholder="Ej. 20240001 (Escribe al menos 3 números...)" 
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#1A237E] font-mono"
                />
                
                {mostrarSugerencias && sugerencias.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-xl max-h-60 overflow-auto divide-y divide-gray-100">
                    {sugerencias.map(s => (
                      <li 
                        key={s.matricula}
                        onMouseDown={() => handleSeleccionarSugerencia(s.matricula)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <span className="font-bold text-[#1A237E] font-mono">{s.matricula}</span>
                        <span className="text-xs text-gray-600 truncate ml-3 uppercase font-medium">{s.nombre}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button 
              onClick={() => ejecutarConProteccion(() => buscarAlumno())}
              disabled={cargando || matriculaBuscada.length !== 8}
              className="bg-[#1A237E] text-white px-6 py-2.5 rounded-md text-sm font-bold hover:bg-[#283593] disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
            >
              {cargando ? 'Buscando...' : 'Cargar Catálogo'}
            </button>
          </div>

          {alumnoInfo && vistaActual === 'asignacion' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#1A237E] p-3 rounded-full text-white">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900">{alumnoInfo.nombre}</h3>
                      <p className="text-xs text-blue-700 font-medium">
                        Matrícula: {alumnoInfo.matricula} | {alumnoInfo.carrera} | Cuatrimestre: {alumnoInfo.cuatrimestre}
                      </p>
                    </div>
                  </div>
                </div>

                {materiasRecursamiento.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-3 border-b border-red-200 pb-2">
                      <AlertTriangle className="w-4 h-4" /> Materias Pendientes (Recursamiento)
                    </h3>
                    {materiasRecursamiento.map(mat => (
                      <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={true} />
                    ))}
                  </div>
                )}

                {materiasTronco.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                      <Layers className="w-4 h-4 text-amber-600" /> Materias de Tronco Común
                    </h3>
                    {materiasTronco.map(mat => (
                      <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />
                    ))}
                  </div>
                )}

                {materiasCarrera.length > 0 && (
                  <div className={materiasTronco.length > 0 ? "mt-8" : ""}>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                      <BookOpen className="w-4 h-4 text-blue-600" /> Materias de Especialidad (Carrera)
                    </h3>
                    {materiasCarrera.map(mat => (
                      <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} />
                    ))}
                  </div>
                )}

                {materiasAdelanto.length > 0 && (
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-bold text-purple-700 flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4" /> Materias Disponibles para Adelanto (Costo Extra)
                    </h3>
                    {materiasAdelanto.map(mat => (
                      <TarjetaMateria key={mat.subject_id} materia={mat} isRetake={false} isAdelanto={true} />
                    ))}
                  </div>
                )}

              </div> 

              <div className="lg:col-span-4">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm sticky top-6">
                  
                  {alumnoInfo.cuatrimestre === 1 && Object.keys(seleccion).length === 0 && (
                    <div className="p-4 border-b border-gray-200 bg-green-50 rounded-t-lg">
                      <button 
                        onClick={handleCargaAutomatica}
                        className="w-full bg-green-600 text-white py-2.5 rounded-md text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Zap className="w-4 h-4" /> Asignación Automática
                      </button>
                      <p className="text-[10px] text-green-700 text-center mt-2 leading-tight">Implementación de algoritmo restrictivo para cruce de vectores de tiempo.</p>
                    </div>
                  )}

                  <div className={`p-4 border-b border-gray-200 bg-gray-50 ${alumnoInfo.cuatrimestre !== 1 || Object.keys(seleccion).length > 0 ? 'rounded-t-lg' : ''}`}>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#1A237E]" />
                      Resumen de Inscripción
                    </h3>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4 text-sm">
                      <span className="text-gray-500">Materias seleccionadas:</span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                        {Object.keys(seleccion).length}
                      </span>
                    </div>

                    {Object.keys(seleccion).length === 0 ? (
                      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No hay materias seleccionadas</p>
                      </div>
                    ) : (
                      <div className="space-y-3 mb-6 max-h-60 overflow-auto pr-1">
                        {Object.entries(seleccion).map(([subId, data]) => (
                          <div key={subId} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded border border-gray-100">
                            <span className="font-bold text-gray-700 truncate w-32">{subId}</span>
                            <span className="bg-[#1A237E] text-white px-2 py-0.5 rounded font-mono">ID Grupo: {data.group_id}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button 
                      onClick={handleGuardarCarga}
                      disabled={guardando || Object.keys(seleccion).length === 0 || !hayCambios}
                      className="w-full bg-[#1A237E] text-white py-3 rounded-md text-sm font-bold hover:bg-[#283593] flex justify-center items-center gap-2 disabled:opacity-50 disabled:bg-gray-400 shadow-sm transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {guardando ? 'Guardando...' : (!hayCambios ? 'Carga Actualizada' : 'Confirmar Inscripción')}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3">
                      La confirmación procesa la transacción de persistencia de datos relacionales en backend.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {alumnoInfo && vistaActual === 'horario' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between min-w-[200px] shadow-sm">
                    <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Asignaturas</p><p className="text-3xl font-bold text-gray-800">{new Set(horarioReal.map(c => c.materia)).size}</p></div>
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><BookOpen className="w-6 h-6" /></div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between min-w-[200px] shadow-sm">
                    <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Hrs semanales</p><p className="text-3xl font-bold text-gray-800">{horarioReal.reduce((sum, clase) => sum + (clase.duracion || 0), 0)}</p></div>
                    <div className="bg-green-100 p-3 rounded-lg text-green-600"><Clock className="w-6 h-6" /></div>
                  </div>
                </div>
                <button onClick={handleDownloadPDF} disabled={horarioReal.length === 0} className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm w-full md:w-auto justify-center"><Download className="w-4 h-4 mr-2" /> Descargar PDF</button>
              </div>

              <div id="horario-imprimible" className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
                <div className="mb-6 border-b pb-4"><h2 className="text-2xl font-bold text-[#1A237E]">Horario de Clases - {alumnoInfo.nombre}</h2><p className="text-gray-500 text-sm">Periodo 2026-1 | {alumnoInfo.carrera}</p></div>
                
                {horarioReal.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Calendar className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-base font-semibold">No hay materias asignadas</p>
                    <p className="text-sm mt-1">Regresa a la pestaña de asignación para inscribir materias.</p>
                  </div>
                ) : alumnoInfo.esMaestria ? (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-[#1A237E] mb-4 uppercase tracking-wider">Estructura Modular (Bloques de 5 Semanas)</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {[1, 2, 3].map(numModulo => {
                        const clasesDelModulo = horarioReal.filter((_, index) => (index % 3) + 1 === numModulo);
                        if (clasesDelModulo.length === 0) return null;

                        return (
                          <div key={numModulo} className="border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-gray-200">
                              <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Módulo Secuencial {numModulo}</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                              {clasesDelModulo.map((clase, idx) => (
                                <div key={idx} className="flex hover:bg-slate-50 transition-colors">
                                  <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: clase.color || '#2563EB' }}></div>
                                  <div className="p-4 w-full">
                                    <h4 className="font-bold text-gray-800 mb-2">{clase.materia}</h4>
                                    <div className="flex justify-between items-center text-xs text-gray-600">
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {clase.dia} {clase.hora}</span>
                                      <span className="bg-white px-2 py-1 rounded border border-gray-200 font-mono text-[10px]">Aula: {clase.aula || 'S/A'}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 truncate">{clase.profe}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[1000px] table-fixed">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold text-center">
                        <tr><th className="py-3 px-4 w-28 border border-gray-200 bg-gray-100">Hora</th>{DIAS_SEMANA.map(dia => (<th key={dia} className="py-3 px-4 border border-gray-200 w-1/6">{dia}</th>))}</tr>
                      </thead>
                      <tbody>
                        {HORAS_CLASE.map((hora, idx) => {
                          const rowHour = parseInt(hora.split(':')[0]);
                          return (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-4 px-2 font-medium text-gray-500 text-center border-r border-gray-200 bg-gray-50">{hora}</td>
                              {DIAS_SEMANA.map(dia => {
                                const claseInicia = horarioReal.find(c => c.dia === dia && c.hora_inicio === rowHour);
                                const claseContinua = horarioReal.find(c => c.dia === dia && c.hora_inicio < rowHour && (c.hora_inicio + c.duracion) > rowHour);
                                if (claseContinua) return null;
                                if (claseInicia) {
                                  return (
                                    <td key={`${dia}-${hora}`} rowSpan={claseInicia.duracion} className="p-2 border-r border-gray-200 align-top">
                                      <div className="text-white rounded-md p-3 flex flex-col shadow-sm transition-transform hover:scale-[1.02]" style={{ backgroundColor: claseInicia.color, height: '100%', minHeight: `${claseInicia.duracion * 4.5}rem` }}>
                                        <span className="font-bold text-xs leading-tight uppercase mb-1">{claseInicia.materia}</span>
                                        <div className="mt-auto border-t border-white/20 pt-2">
                                          <span className="block text-[10px] opacity-90 truncate">{claseInicia.profe}</span>
                                          <span className="block text-[10px] font-mono mt-1 bg-black/10 inline-block px-1.5 py-0.5 rounded">{claseInicia.aula || 'S/A'}</span>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }
                                return <td key={`${dia}-${hora}`} className="p-2 border-r border-gray-200 align-top"></td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GroupAndSchedule;