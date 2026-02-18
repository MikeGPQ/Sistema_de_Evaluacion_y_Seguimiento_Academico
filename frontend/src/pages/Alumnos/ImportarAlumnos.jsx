import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, CheckCircle, Database, Download, X, AlertCircle } from 'lucide-react'; 
import client from '../../lib/axios'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ImportarAlumnos = () => {
  const [datos, setDatos] = useState([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [fileObject, setFileObject] = useState(null); 
  const [cargando, setCargando] = useState(false);
  const [notificacion, setNotificacion] = useState({ mostrar: false, mensaje: "", tipo: "" });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (notificacion.mostrar) {
      const timer = setTimeout(() => {
        setNotificacion({ ...notificacion, mostrar: false });
      }, 5000);
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

    if(file.size > 2 * 1024 * 1024){
      setNotificacion({ mostrar: true, mensaje: "El archivo supera los 2MB", tipo: "error" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setArchivoNombre(file.name);
    setFileObject(file); 

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const buffer = evt.target.result;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      const headers = [];
      const jsonData = [];

      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString().trim() : "";
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
  
  // Título y encabezado
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
    headStyles: { fillColor: [37, 99, 235] },
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

    const formData = new FormData();
    formData.append('file', fileObject); 

    try {
      const response = await client.post('/alumnos/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { message, data } = response.data;
      setNotificacion({ mostrar: true, mensaje: message, tipo: "exito" });

      if (data && data.length > 0) {
        generarPDFCredenciales(data);
      }

      setDatos([]);
      setArchivoNombre("");
      setFileObject(null);
      
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Error al conectar con el servidor";
      setNotificacion({ mostrar: true, mensaje: errorMsg, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plantilla SESA');
    
    sheet.addRow([
      "Matrícula:", "Nombre:", "Apellido Paterno:", "Apellido Materno:", 
      "Procedencia:", "Promedio General:", "Curp:", "Calle:", 
      "Colonia:", "Código Postal:", "Estado:", "Número de domicilio:", 
      "Municipio:", "Carrera:", "Correo Personal:", "Correo Institucional:", "Cuatrimestre:"
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla_alumnos_sesa.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">
      {notificacion.mostrar && (
        <div className={`fixed top-5 right-5 z-50 flex items-center p-4 rounded-lg shadow-2xl transition-all border-l-4 ${notificacion.tipo === 'exito' ? 'bg-green-100 text-green-800 border-green-500' : 'bg-red-100 text-red-800 border-red-500'}`}>
          {notificacion.tipo === 'exito' ? <CheckCircle className="w-5 h-5 mr-3" /> : <AlertCircle className="w-5 h-5 mr-3" />}
          <p className="font-bold mr-8">{notificacion.mensaje}</p>
          <button onClick={() => setNotificacion({ ...notificacion, mostrar: false })}>
            <X className="w-4 h-4 hover:scale-125 transition" />
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-2">Importar Alumnos</h1>
      <p className="text-gray-500 mb-6 font-medium italic">Carga masiva de datos mediante archivo Excel</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="border-2 border-dashed border-blue-300 rounded-xl p-10 bg-white text-center hover:bg-blue-50 transition">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-blue-500 mb-4" />
              <p className="mb-4 text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>
              <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" id="excel-upload" ref={fileInputRef} />
              <label htmlFor="excel-upload" className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition font-bold shadow-md">
                Seleccionar archivo
              </label>
              {archivoNombre && <p className="mt-4 text-sm text-blue-600 font-bold italic">Archivo cargado: {archivoNombre}</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="font-bold text-gray-700 text-lg tracking-tight">Vista previa de registros</h2>
                <p className="text-sm text-gray-500 font-medium">{datos.length} registros detectados</p>
              </div>
              {datos.length > 0 && (
                <button 
                  onClick={handleGuardarEnBaseDeDatos}
                  disabled={cargando}
                  className={`flex items-center gap-2 text-white px-6 py-2 rounded-lg transition font-bold shadow-lg ${cargando ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
                >
                  <Database className="w-4 h-4" />
                  {cargando ? 'Guardando en BD...' : 'Confirmar e Importar'}
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-125">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-100 border-b sticky top-0">
                  <tr className="text-gray-600 font-bold uppercase tracking-wider">
                    <th className="p-4">Matrícula</th>
                    <th className="p-4">Nombre</th>
                    <th className="p-4">Apellido Paterno</th>
                    <th className="p-4">Apellido Materno</th>
                    <th className="p-4">Procedencia</th>
                    <th className="p-4">Promedio General</th>
                    <th className="p-4">CURP</th>
                    <th className="p-4">Calle</th>
                    <th className="p-4">Colonia</th>
                    <th className="p-4">Código Postal</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Número Domicilio</th>
                    <th className="p-4">Municipio</th>
                    <th className="p-4">Carrera</th>
                    <th className="p-4">Correo Personal</th>
                    <th className="p-4">Correo Institucional</th>
                    <th className="p-4">Cuatrimestre</th>
                    <th className="p-4">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {datos.map((alumno, index) => (
                    <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 font-mono text-gray-600">{String(alumno["Matrícula:"] || '---')}</td>
                      <td className="p-4 font-bold text-gray-800">{String(alumno["Nombre:"] || '---')}</td>
                      <td className="p-4 text-gray-700">{String(alumno["Apellido Paterno:"] || '---')}</td>
                      <td className="p-4 text-gray-700">{String(alumno["Apellido Materno:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Procedencia:"] || '---')}</td>
                      <td className="p-4 font-bold text-blue-600">{String(alumno["Promedio General:"] || '0.00')}</td>
                      <td className="p-4 font-mono text-xs">{String(alumno["Curp:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Calle:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Colonia:"] || '---')}</td>
                      <td className="p-4 font-bold text-blue-800">{String(alumno["Código Postal:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Estado:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Número de domicilio:"] || '---')}</td>
                      <td className="p-4">{String(alumno["Municipio:"] || '---')}</td>
                      <td className="p-4 font-bold text-gray-600">{String(alumno["Carrera:"] || '---')}</td>
                      <td className="p-4 text-gray-500 italic">{String(alumno["Correo Personal:"] || '---')}</td>
                      <td className="p-4 text-gray-500 italic">{String(alumno["Correo Institucional:"] || '---')}</td>
                      <td className="p-4 font-bold text-purple-600">{String(alumno["Cuatrimestre:"] || '1')}</td>
                      <td className="p-4"><CheckCircle className="w-3 h-3 text-green-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {datos.length === 0 && (
                <div className="p-16 text-center text-gray-400 italic">
                  No hay datos en la vista previa. Sube un archivo de Excel para comenzar.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
            <h3 className="flex items-center font-bold text-blue-800 mb-4 text-xs uppercase tracking-wider">
              <FileSpreadsheet className="w-5 h-5 mr-2" /> Instrucciones SESA
            </h3>
            <ul className="text-sm space-y-4 text-gray-600 font-medium leading-relaxed">
              <li>• Solo archivos <strong>.xlsx</strong>.</li>
              <li>• Se generarán claves aleatorias seguras automáticamente.</li>
              <li>• El sistema no permite matrículas duplicadas.</li>
            </ul>
            <button onClick={descargarPlantilla} className="w-full mt-6 border-2 border-green-500 text-green-600 py-3 rounded-lg hover:bg-green-50 flex items-center justify-center font-bold transition-all gap-2 shadow-sm">
              <Download className="w-5 h-5" /> Descargar plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarAlumnos;