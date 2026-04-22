import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { 
  Upload, CheckCircle, Database, X, AlertCircle, 
  FileSpreadsheet, ArrowLeft, Settings, Download
} from 'lucide-react';
import client from '../../lib/axios'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/AuthContext';

const ImportStudents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [datos, setDatos] = useState([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [fileObject, setFileObject] = useState(null); 
  const [cargando, setCargando] = useState(false);
  const [notificacion, setNotificacion] = useState({ mostrar: false, mensaje: "", tipo: "" });
  
  const [mensajeErrorBD, setMensajeErrorBD] = useState(""); 
  const [erroresDetalle, setErroresDetalle] = useState([]); 
  
  const [idBase, setIdBase] = useState("");
  const [guardandoId, setGuardandoId] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (notificacion.mostrar) {
      const timer = setTimeout(() => {
        setNotificacion({ ...notificacion, mostrar: false });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notificacion]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setNotificacion({ mostrar: true, mensaje: "Solo se permiten archivos .xlsx", tipo: "error" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if(file.size > 5 * 1024 * 1024){
      setNotificacion({ mostrar: true, mensaje: "El archivo supera los 5MB permitidos", tipo: "error" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setArchivoNombre(file.name);
    setFileObject(file); 
    setMensajeErrorBD(""); 
    setErroresDetalle([]); 

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const buffer = evt.target.result;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      const headers = [];
      const jsonData = [];

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString().replace(':', '').trim() : "";
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            let val = cell.value;
            if (val && typeof val === 'object') {
                if (val instanceof Date) {
                    val = val.toLocaleDateString();
                } else {
                    val = val.result !== undefined ? val.result : 
                          val.text !== undefined ? val.text : 
                          val.richText ? val.richText.map(t => t.text).join('') : 
                          JSON.stringify(val);
                }
            }
            rowData[header] = val;
          }
        });
        jsonData.push(rowData);
      });

      setDatos(jsonData);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const generarPDFCredenciales = (usuarios) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Credenciales de Acceso - Alumnos Importados", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Sistema de Evaluación y Seguimiento Académico (SESA)", 14, 28);

    const tableColumn = ["Nombre Alumno", "Usuario (Matrícula)", "Clave Temporal", "Correo Institucional"];
    const tableRows = usuarios.map(u => [u.nombre, u.usuario, u.password, u.correo]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126] },
      didDrawPage: (data) => {
        const finalY = data.cursor.y + 15; 
        doc.setFontSize(10);
        doc.setTextColor(255, 0, 0); 
        doc.setFont("helvetica", "bold");
        doc.text("AVISO DE SEGURIDAD IMPORTANTE:", 14, finalY);
        doc.setFontSize(9);
        doc.setTextColor(60); 
        doc.setFont("helvetica", "normal");
        const aviso = "Las contraseñas proporcionadas en este documento son de carácter temporal. " +
                      "Por políticas de seguridad del sistema SESA, se le solicitará obligatoriamente " +
                      "cambiar su contraseña al realizar su primer inicio de sesión.";
        const splitAviso = doc.splitTextToSize(aviso, 180);
        doc.text(splitAviso, 14, finalY + 7);
      }
    });

    doc.save(`Credenciales_Seguras_${new Date().getTime()}.pdf`);
  };

  const handleGuardarEnBaseDeDatos = async () => {
    if (!fileObject) return;
    setCargando(true);
    setMensajeErrorBD("");
    setErroresDetalle([]); 

    const formData = new FormData();
    formData.append('file', fileObject); 
    formData.append('usuario_id', user?.identifier || user?.email || "Admin Local");

    try {
      const response = await client.post('/alumnos/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { message, data } = response.data;
      setNotificacion({ mostrar: true, mensaje: message, tipo: "exito" });

      if (data && data.length > 0) {
        generarPDFCredenciales(data);
      }
      handleCancelar();
      
    } catch (error) {
      const responseData = error.response?.data;
      
      if (responseData?.errores_detalle) {
          setErroresDetalle(responseData.errores_detalle);
          setMensajeErrorBD(responseData.detail);
      } else {
          setMensajeErrorBD(responseData?.detail || "Error al conectar con el servidor");
      }
      setNotificacion({ mostrar: true, mensaje: "Importación detenida. Revise los errores generados.", tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  
  const generarReporteErroresPDF = () => {
    if (erroresDetalle.length === 0) return;

    
    const doc = new jsPDF('landscape'); 
    
    
    doc.setFontSize(18);
    doc.setTextColor(220, 38, 38); 
    doc.text("Reporte de Errores de Validación de Importación", 14, 20);

    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Sistema de Evaluación y Seguimiento Académico (SESA)", 14, 28);
    doc.text(`Fecha del escaneo: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 14, 34);

    
    const tableColumn = ["Fila Excel", "Matrícula", "Nombre Alumno", "Campos Afectados", "Detalle del Error"];
    const tableRows = erroresDetalle.map(err => [
      `Fila ${err.fila}`,
      err.matricula,
      err.nombre,
      err.campos.join(', '),
      err.mensajes.join(' | ')
    ]);

    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [229, 57, 53] }, 
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 50 },
        3: { cellWidth: 45 },
        4: { cellWidth: 'auto' } 
      }
    });

    doc.save(`Reporte_Errores_Importacion_${new Date().getTime()}.pdf`);
  };

  const handleActualizarIdBase = async () => {
    // Exigimos que sean exactamente 8 números para evitar problemas de formato en la matrícula
    if (!idBase || !/^\d{8}$/.test(idBase)) {
      setNotificacion({ mostrar: true, mensaje: "Ingresa una matrícula de exactamente 8 números.", tipo: "error" });
      return;
    }

    setGuardandoId(true);
    const formData = new FormData();
    formData.append('nueva_matricula', idBase);

    try {
      const response = await client.post('/alumnos/set-base-id', formData);
      setNotificacion({ mostrar: true, mensaje: response.data.message, tipo: "exito" });
      setIdBase("");
    } catch (error) {
      setNotificacion({ 
        mostrar: true, 
        mensaje: error.response?.data?.detail || "Error al actualizar la ID", 
        tipo: "error" 
      });
    } finally {
      setGuardandoId(false);
    }
  };

  const descargarPlantilla = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plantilla SESA');
    sheet.addRow([
      "Matrícula", "Nombre", "Apellido Paterno", "Apellido Materno", 
      "Procedencia", "Promedio General", "Curp", "Calle", 
      "Colonia", "Código Postal", "Estado", "Número de domicilio", 
      "Municipio", "Carrera", "Correo Personal", "Correo Institucional", "Cuatrimestre"
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla_oficial_sesa.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCancelar = () => {
      setDatos([]);
      setArchivoNombre("");
      setFileObject(null);
      setMensajeErrorBD("");
      setErroresDetalle([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans">
      
      {notificacion.mostrar && (
        <div className={`fixed top-5 right-5 z-50 flex items-center p-4 rounded-md shadow-lg transition-all border-l-4 ${notificacion.tipo === 'exito' ? 'bg-green-50 text-green-800 border-green-500' : 'bg-red-50 text-red-800 border-red-500'}`}>
          {notificacion.tipo === 'exito' ? <CheckCircle className="w-5 h-5 mr-3" /> : <AlertCircle className="w-5 h-5 mr-3" />}
          <p className="font-semibold text-sm mr-8">{notificacion.mensaje}</p>
          <button onClick={() => setNotificacion({ ...notificacion, mostrar: false })}>
            <X className="w-4 h-4 hover:scale-125 transition" />
          </button>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center text-sm text-gray-500">
           Inicio &gt; 
           <button 
             onClick={() => navigate('/alumnos/listado')} 
             className="mx-1 hover:text-[#1A237E] hover:underline transition-colors focus:outline-none"
           >
             Alumnos
           </button> 
           &gt; <span className="text-[#1A237E] ml-1 font-bold">Importación Masiva</span>
        </div>
      </header>

      <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
              
              <button 
                onClick={() => navigate('/alumnos/listado')}
                className="flex items-center text-sm text-gray-600 hover:text-[#1A237E] font-medium mb-4 transition-colors group focus:outline-none"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                Volver al listado
              </button>

              <div className="flex justify-between items-end mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Importación Masiva</h1>
                  <p className="text-gray-500 text-sm">Carga alumnos vía Excel o configura la matrícula base para el registro manual.</p>
                </div>
              </div>

              {mensajeErrorBD && (
                  <div className="bg-red-50 border border-red-300 text-red-900 p-5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between mb-6 shadow-sm">
                      <div className="flex items-start">
                        <AlertCircle className="w-6 h-6 mr-3 mt-0.5 shrink-0 text-red-600" />
                        <div>
                            <h4 className="font-bold text-base">La importación se ha detenido por errores de validación</h4>
                            <p className="text-sm mt-1">{mensajeErrorBD}</p>
                        </div>
                      </div>
                      <button 
                        onClick={generarReporteErroresPDF}
                        className="mt-4 md:mt-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                      >
                        <Download className="w-4 h-4" /> Descargar Reporte PDF
                      </button>
                  </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  <div className="lg:col-span-8 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-[650px] overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                          <h2 className="text-sm font-bold text-gray-800">Vista Previa de Datos</h2>
                      </div>

                      <div className="flex-1 overflow-auto">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-[#F8F9FA] sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                  <tr className="text-gray-500 font-semibold uppercase tracking-wider">
                                      <th className="p-3">Fila Excel</th>
                                      <th className="p-3">Matrícula</th>
                                      <th className="p-3">Nombre</th>
                                      <th className="p-3">Apellido Paterno</th>
                                      <th className="p-3">Apellido Materno</th>
                                      <th className="p-3">Procedencia</th>
                                      <th className="p-3">Promedio</th>
                                      <th className="p-3">CURP</th>
                                      <th className="p-3">Carrera</th>
                                      <th className="p-3">Cuatrimestre</th>
                                      <th className="p-3">Correo Personal</th>
                                      <th className="p-3">Correo Inst.</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {datos.length > 0 ? (
                                      datos.map((alumno, index) => {
                                          const matActual = String(alumno["Matrícula"] || alumno["Matrícula:"] || '');
                                          const filaActual = index + 2; 
                                          const errorFila = erroresDetalle.find(err => err.fila === filaActual);
                                          const errorCampos = errorFila ? errorFila.campos : [];
                                          const mensajeError = errorFila ? errorFila.mensajes.join(" | ") : "";

                                          return (
                                              <tr key={index} className={`transition-colors ${errorFila ? 'bg-red-50/80 border-l-4 border-l-red-500' : 'hover:bg-blue-50/30'}`}>
                                                  
                                                  <td className="p-3 font-bold text-gray-400">#{filaActual}</td>

                                                  <td className={`p-3 font-mono font-medium ${errorCampos.includes("Matrícula") ? 'text-red-700 bg-red-100 rounded shadow-sm border border-red-200 cursor-help' : 'text-gray-700'}`} title={errorCampos.includes("Matrícula") ? mensajeError : ""}>
                                                      {matActual}
                                                  </td>
                                                  <td className={`p-3 font-semibold ${errorCampos.includes("Nombre") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-900'}`} title={errorCampos.includes("Nombre") ? mensajeError : ""}>
                                                      {String(alumno["Nombre"] || alumno["Nombre:"] || '---')}
                                                  </td>
                                                  <td className={`p-3 ${errorCampos.includes("Apellido Paterno") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help font-semibold' : 'text-gray-600'}`} title={errorCampos.includes("Apellido Paterno") ? mensajeError : ""}>
    {String(alumno["Apellido Paterno"] || alumno["Apellido Paterno:"] || '---')}
</td>

<td className={`p-3 ${errorCampos.includes("Apellido Materno") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help font-semibold' : 'text-gray-600'}`} title={errorCampos.includes("Apellido Materno") ? mensajeError : ""}>
    {String(alumno["Apellido Materno"] || alumno["Apellido Materno:"] || '---')}
</td>

<td className={`p-3 font-medium ${errorCampos.includes("Procedencia") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-600'}`} title={errorCampos.includes("Procedencia") ? mensajeError : ""}>
    {String(alumno["Procedencia"] || alumno["Procedencia:"] || '---')}
</td>

<td className={`p-3 font-bold ${errorCampos.includes("Promedio General") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-700'}`} title={errorCampos.includes("Promedio General") ? mensajeError : ""}>
    {alumno["Promedio General"] != null && alumno["Promedio General"] !== '' ? String(alumno["Promedio General"]) : (alumno["Promedio General:"] != null ? String(alumno["Promedio General:"]) : '---')}
</td>
                                                  
                                                  <td className={`p-3 font-mono ${errorCampos.includes("Curp") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-500'}`} title={errorCampos.includes("Curp") ? mensajeError : ""}>
                                                      {String(alumno["Curp"] || alumno["Curp:"] || '---')}
                                                  </td>
                                                  
                                                  <td className={`p-3 font-bold ${errorCampos.includes("Carrera") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-600'}`} title={errorCampos.includes("Carrera") ? mensajeError : ""}>
                                                      {String(alumno["Carrera"] || alumno["Carrera:"] || '---')}
                                                  </td>
                                                  
                                                  <td className={`p-3 text-center font-bold ${errorCampos.includes("Cuatrimestre") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-700'}`} title={errorCampos.includes("Cuatrimestre") ? mensajeError : ""}>
                                                      {String(alumno["Cuatrimestre"] ?? alumno["Cuatrimestre:"] ?? '---').replace('.0', '')}
                                                  </td>
                                                  <td className={`p-3 italic ${errorCampos.includes("Correo Personal") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-500'}`} title={errorCampos.includes("Correo Personal") ? mensajeError : ""}>
                                                      {String(alumno["Correo Personal"] || alumno["Correo Personal:"] || '---')}
                                                  </td>
                                                  <td className={`p-3 italic ${errorCampos.includes("Correo Institucional") ? 'text-red-700 bg-red-100 rounded border border-red-200 cursor-help' : 'text-gray-500'}`} title={errorCampos.includes("Correo Institucional") ? mensajeError : ""}>
                                                      {String(alumno["Correo Institucional"] || alumno["Correo Institucional:"] || '---')}
                                                  </td>
                                              </tr>
                                          );
                                      })
                                  ) : (
                                      <tr>
                                          <td colSpan="12" className="p-20 text-center text-gray-400">
                                              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                              <p className="font-medium text-gray-500">Sin datos para mostrar</p>
                                              <p className="text-xs mt-1">Sube un archivo Excel para iniciar la validación.</p>
                                          </td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      
                      <div className="p-3 border-t border-gray-200 bg-white text-xs text-gray-500 flex justify-between items-center">
                          <span>Mostrando {datos.length > 0 ? `1-${datos.length}` : '0'} de {datos.length} registros analizados.</span>
                      </div>
                  </div>

                  <div className="lg:col-span-4 flex flex-col gap-6">
                      
                      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
                          <h3 className="text-sm font-bold text-gray-800 mb-4 text-left border-b pb-2">1. Cargar Archivo</h3>
                          <div className="border-2 border-dashed border-[#B0BEC5] bg-[#F8F9FA] rounded-lg p-8 flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors">
                              <Upload className="w-10 h-10 text-blue-500 mb-3" />
                              <p className="text-sm text-gray-700 font-medium mb-1">Arrastra tu Excel aquí o</p>
                              
                              <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" id="excel-upload" ref={fileInputRef} />
                              <label htmlFor="excel-upload" className="mt-3 bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-xs font-bold cursor-pointer hover:bg-gray-50 shadow-sm transition-colors">
                                  Examinar Archivos
                              </label>
                          </div>
                          
                          {archivoNombre && (
                              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-left flex items-center justify-between">
                                  <div className="truncate pr-2">
                                      <p className="text-xs font-bold text-blue-900 truncate">{archivoNombre}</p>
                                      <p className="text-[10px] text-blue-600 mt-0.5 font-medium">Análisis de validación completado</p>
                                  </div>
                                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                              </div>
                          )}

                          <div className="flex gap-2 mt-4">
                              <button 
                                  onClick={handleCancelar}
                                  disabled={datos.length === 0}
                                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-md text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                  Limpiar
                              </button>
                              <button 
                                  onClick={handleGuardarEnBaseDeDatos}
                                  disabled={cargando || datos.length === 0 || erroresDetalle.length > 0}
                                  className="flex-1 bg-[#1A237E] text-white py-2.5 rounded-md text-sm font-bold hover:bg-[#283593] flex justify-center items-center disabled:opacity-50 disabled:bg-gray-400 shadow-sm transition-colors"
                              >
                                  {cargando ? <Database className="w-4 h-4 animate-bounce" /> : 'Importar a BD'}
                              </button>
                          </div>
                          <button onClick={descargarPlantilla} className="w-full mt-3 flex items-center justify-center gap-2 text-[#00AEEF] hover:text-blue-700 py-2 rounded text-xs font-bold transition-colors">
                              <FileSpreadsheet className="w-4 h-4" /> Descargar Plantilla Oficial
                          </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-gray-500" />
                            2. Configurar Matrícula Base
                          </h3>
                          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            Ingresa el último número de matrícula oficial. El sistema lo usará como punto de partida para sumar +1 en las altas manuales.
                          </p>
                          
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Ej. 20240001" 
                              value={idBase}
                              onChange={(e) => setIdBase(e.target.value.replace(/\D/g, ''))}
                              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A237E] focus:border-transparent font-mono"
                            />
                            <button 
                              onClick={handleActualizarIdBase}
                              disabled={guardandoId || !idBase}
                              className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                            >
                              {guardandoId ? 'Guardando...' : 'Fijar ID'}
                            </button>
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      </main>
    </div>
  );
};

export default ImportStudents;
