import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, AlertCircle, ArrowLeft, CheckCircle, Lock, Users, ChevronRight } from 'lucide-react';
import client from '../../lib/axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { useAuth } from '../../hooks/AuthContext';
import LeafMinutes from '../../components/Reports/LeafMinutes'; 

// pagina para generar las actas de calificaciones
const ReportCards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [grupos, setGrupos] = useState([]);
  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [actaData, setActaData] = useState(null);
  const [cargandoActa, setCargandoActa] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Lógica de paginación
  // Funcion que calcula en base a la cantidad de alumnos cuantas hojas se necesitan renderizar
  const paginasCalculadas = useMemo(() => {
    if (!actaData || !actaData.alumnos) return [];
    
    const alumnos = actaData.alumnos;
    const paginas = [];
    let currentIndex = 0;
    let isFirst = true;

    while (currentIndex < alumnos.length || isFirst) {
      let capacidadFila;
      let isLast = false;

      if (isFirst) {
        capacidadFila = 8;
        if (alumnos.length - currentIndex <= capacidadFila) isLast = true;
        else capacidadFila = 15;
      } else {
        capacidadFila = 18;
        if (alumnos.length - currentIndex <= capacidadFila) isLast = true;
        else capacidadFila = 28;
      }

      paginas.push({
        startIndex: currentIndex,
        endIndex: isLast ? alumnos.length : currentIndex + capacidadFila,
        isFirstPage: isFirst,
        isLastPage: isLast,
        chunk: alumnos.slice(currentIndex, isLast ? alumnos.length : currentIndex + capacidadFila)
      });

      currentIndex += capacidadFila;
      isFirst = false;

      if (isLast) break;
    }
    return paginas;
  }, [actaData]);

  // memorizacion de folio y fecha para evitar cambios en cada renderizado del acta
  const memoizedFolio = useMemo(() => `UNID-ACT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`, [actaData]);
  const memoizedDate = useMemo(() => {
    const d = new Date();
    return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}. ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs.`;
  }, [actaData]);

  // carga de grupos asignados al docente
  useEffect(() => {
    let isMounted = true;
    const fetchGruposDocente = async () => {
      try {
        // Peticion GET al backend para consultar los grupos disponibles de este docente
        const response = await client.get(`/docentes/${user?.identifier}/grupos`);
        if (isMounted) setGrupos(response.data);
      } catch (error) {
        if (isMounted) {
          Swal.fire({
            icon: 'error',
            title: 'Error de Consulta',
            text: 'No se pudieron cargar los grupos asignados.',
            confirmButtonColor: '#00205B'
          });
        }
      } finally {
        if (isMounted) setCargandoGrupos(false);
      }
    };

    if (user?.identifier) {
      fetchGruposDocente();
    }
    return () => { isMounted = false; };
  }, [user]);

  // funcion para seleccionar el grupo y cargar los datos del acta
  const handleSeleccionarGrupo = async (grupoId) => {
    setGrupoSeleccionado(grupoId);
    setCargandoActa(true);
    setActaData(null);

    try {
      // Peticion GET al backend que valida y retorna los datos detallados del acta a previsualizar
      const response = await client.get(`/actas/${grupoId}/validar`);
      setActaData(response.data);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar acta',
        text: error.response?.data?.detail || 'No se pudo generar la vista previa del acta.',
        confirmButtonColor: '#00205B'
      });
      setGrupoSeleccionado(null);
    } finally {
      setCargandoActa(false);
    }
  };

  // Funcion auxiliar que encapsula la tarea de tomar capturas PNG y armar el archivo PDF
  const construirYDescargarPDF = async () => {
    window.scrollTo(0, 0);

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'letter'
    });

    for (let i = 0; i < paginasCalculadas.length; i++) {
      const input = document.getElementById(`acta-page-${i}`);
      
      const dataUrl = await toPng(input, { 
        quality: 1.0, 
        backgroundColor: '#ffffff', 
        pixelRatio: 2, 
        width: 816,
        height: 1056
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, 0, 215.9, 279.4);
    }

    pdf.save(`Acta_Final_${actaData.codigo_materia}_${actaData.grupo}.pdf`);
  };

  // funcion para generar el acta y descargar el pdf la primera vez
  const handleGenerarActa = async () => {
    if (!actaData.captura_completa) {
      Swal.fire({
        icon: 'warning',
        title: 'Captura Incompleta',
        text: 'El sistema requiere el 100% de las calificaciones capturadas para generar el acta oficial.',
        confirmButtonColor: '#00205B'
      });
      return;
    }

    const confirmacion = await Swal.fire({
      title: '¿Generar Acta Definitiva?',
      text: 'Al emitir este documento, las calificaciones quedarán CERRADAS y no podrán ser modificadas. ¿Desea proceder?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, generar y cerrar acta',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    setProcesando(true);
    
    Swal.fire({ 
      title: 'Procesando Acta', 
      text: 'Renderizando documento seguro y congelando calificaciones...', 
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    try {
      // Peticion POST al backend para cambiar el estado del acta y generar un log 
      await client.post(`/actas/${grupoSeleccionado}/cerrar`, {
        docente_id: user?.identifier
      });

      await construirYDescargarPDF();

      setActaData(prev => ({ ...prev, acta_status: 'cerrada' }));

      Swal.fire({
        icon: 'success',
        title: 'Acta Generada',
        text: 'El documento ha sido descargado y el grupo se encuentra oficialmente cerrado.',
        confirmButtonColor: '#00205B'
      });

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Procesamiento',
        text: error.response?.data?.detail || 'Ocurrió un error al intentar congelar el acta.',
        confirmButtonColor: '#00205B'
      });
    } finally {
      setProcesando(false);
    }
  };

  // funcion para re-descargar el pdf en caso de que el acta ya este en estado cerrado
  const handleReDescargarPDF = async () => {
    setProcesando(true);
    
    Swal.fire({ 
      title: 'Descargando Copia', 
      text: 'Generando el PDF nuevamente...', 
      allowOutsideClick: false, 
      didOpen: () => Swal.showLoading() 
    });

    try {
      await construirYDescargarPDF();
      Swal.close();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar la copia del documento.',
        confirmButtonColor: '#00205B'
      });
    } finally {
      setProcesando(false);
    }
  };

  const VolverALista = () => {
    setGrupoSeleccionado(null);
    setActaData(null);
  };

  // renderizado vista de grupos academicos
  if (!grupoSeleccionado) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0 shadow-sm pr-4 print:hidden">
          <div className="flex items-center text-sm text-gray-500">
             Docentes &gt; <span className="text-[#00205B] ml-1 font-bold">Generación de Actas</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 pr-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Emisión de Actas Finales</h1>
              <p className="text-gray-500 text-sm">Seleccione un grupo para previsualizar y generar el acta oficial de calificaciones.</p>
            </div>

            {cargandoGrupos ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00205B]"></div>
              </div>
            ) : grupos.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-700">Sin grupos asignados</h3>
                <p className="text-sm text-gray-500 mt-2">No tienes grupos activos en este periodo académico.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grupos.map((grupo) => (
                  <div 
                    key={grupo.id}
                    onClick={() => handleSeleccionarGrupo(grupo.id)}
                    className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:border-[#00205B] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="font-bold text-gray-800 text-base">{grupo.materia_nombre}</h3>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-[#00205B] text-[10px] font-bold rounded border border-blue-100 uppercase">
                          Grupo {grupo.identificador}
                        </span>
                      </div>
                      {grupo.acta_status === 'cerrada' && (
                        <Lock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center"><Users className="w-3.5 h-3.5 mr-1" /> {grupo.total_alumnos} Alumnos</span>
                      <span className="flex items-center text-[#00205B] font-medium group-hover:underline">
                        Ver Acta <ChevronRight className="w-4 h-4 ml-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  const estaCerrada = actaData?.acta_status === 'cerrada';

  // previsualizacion del acta
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 font-sans overflow-x-auto">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 shrink-0 shadow-sm pr-4 print:hidden">
        <div className="flex items-center text-sm text-gray-500">
           Docentes &gt; Generación de Actas &gt; <span className="text-[#00205B] ml-1 font-bold">Vista Previa Oficial</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="w-[816px] max-w-none flex flex-col gap-12 pb-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-2 gap-4 print:hidden pr-4">
            <div>
              <button 
                onClick={VolverALista}
                className="flex items-center text-sm text-gray-600 hover:text-[#00205B] font-medium mb-4 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                Volver a grupos
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Previsualización de Acta</h1>
            </div>

            <div className="flex gap-3">
              {cargandoActa ? null : estaCerrada ? (
                <>
                  <div className="flex items-center px-4 py-2.5 bg-gray-200 text-gray-700 rounded-md text-sm font-bold border border-gray-300 shadow-sm">
                    <Lock className="w-4 h-4 mr-2" /> Acta Cerrada
                  </div>
                  <button
                    onClick={handleReDescargarPDF}
                    disabled={procesando}
                    className="flex items-center px-6 py-2.5 bg-white text-[#00205B] rounded-md text-sm font-bold border-2 border-[#00205B] hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4 mr-2" /> 
                    {procesando ? 'Procesando...' : 'Re-descargar PDF'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGenerarActa}
                  disabled={procesando || !actaData?.captura_completa}
                  className="flex items-center px-6 py-2.5 bg-[#00205B] text-white rounded-md text-sm font-bold hover:bg-[#00153D] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" /> 
                  {procesando ? 'Procesando...' : `Generar Acta PDF (${paginasCalculadas.length} Hoja${paginasCalculadas.length > 1 ? 's' : ''})`}
                </button>
              )}
            </div>
          </div>

          {cargandoActa ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00205B]"></div>
            </div>
          ) : actaData ? (
            <>
              <div className="print:hidden">
                {!actaData.captura_completa && !estaCerrada && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-2 rounded-r-md shadow-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-orange-800">Captura Incompleta</h3>
                      <p className="text-xs text-orange-700 mt-1">El sistema requiere el 100% de calificaciones para emitir este documento oficial.</p>
                    </div>
                  </div>
                )}
                {estaCerrada && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-2 rounded-r-md shadow-sm flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-green-800">Acta Cerrada Oficialmente</h3>
                      <p className="text-xs text-green-700 mt-1">Este documento ha sido sellado en el sistema y no admite modificaciones.</p>
                    </div>
                  </div>
                )}
              </div>
          

          {/* Renderizado de las páginas del acta  */}
              <div className="flex flex-col gap-12 pb-12">
                {paginasCalculadas.map((page, index) => (
                  <LeafMinutes 
                    key={`page-${index}`}
                    pageId={`acta-page-${index}`}
                    actaData={actaData}
                    alumnosChunk={page.chunk}
                    startIndex={page.startIndex}
                    isFirstPage={page.isFirstPage}
                    isLastPage={page.isLastPage}
                    pageIndex={index + 1}
                    totalPages={paginasCalculadas.length}
                    folio={memoizedFolio}
                    fecha={memoizedDate}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default ReportCards;