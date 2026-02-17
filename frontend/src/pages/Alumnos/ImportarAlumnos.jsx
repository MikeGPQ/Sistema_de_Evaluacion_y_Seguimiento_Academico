import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, CheckCircle, Database, Download, AlertTriangle, XCircle } from 'lucide-react'; 
import client from '../../lib/axios'; 

const ImportarAlumnos = () => {
  const [datos, setDatos] = useState([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [fileObject, setFileObject] = useState(null); 
  const [cargando, setCargando] = useState(false);
  const [reporte, setReporte] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReporte(null);

    if (!file.name.endsWith('.xlsx')) {
      alert("Error: Solo se permiten archivos .xlsx");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if(file.size > 2 * 1024 * 1024){
      alert("El archivo es demasiado grande (máx 2MB)");
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
                    val = val.toISOString().split('T')[0];
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

  const handleGuardarEnBaseDeDatos = async () => {
    if (!fileObject) return;

    setCargando(true);
    setReporte(null);
    const formData = new FormData();
    formData.append('file', fileObject); 

    try {
      const response = await client.post('/students/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setReporte({
        status: 'success',
        message: response.data.message,
        errores: response.data.errores || []
      });

      if (!response.data.errores || response.data.errores.length === 0) {
        setDatos([]);
        setArchivoNombre("");
        setFileObject(null);
      }
      
    } catch (error) {
      console.error("Error al importar:", error);
      const msg = error.response?.data?.detail || "Error de conexión con el servidor";
      setReporte({
        status: 'error',
        message: `Fallo crítico: ${msg}`,
        errores: []
      });
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plantilla SESA');
    
    sheet.addRow([
      "Matrícula", "Nombre", "Apellido Paterno", "Apellido Materno", 
      "Procedencia", "Promedio General", "Curp", "Calle", 
      "Colonia", "Código Postal", "Estado", "Número de domicilio", 
      "Municipio", "Carrera", "Correo Personal", "Correo Institucional", "Cuatrimestre", "Estatus"
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
    <div className="p-8 bg-gray-50 min-h-screen">

      <div className="mb-6">
        <a href="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 font-bold transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Volver al Tablero
        </a>
      </div>

      <h1 className="text-2xl font-bold mb-2 text-gray-800">Importar Alumnos</h1>
      <p className="text-gray-500 mb-6 font-medium italic">Carga masiva de datos mediante archivo Excel</p>

      {reporte && (
        <div className={`mb-6 p-4 rounded-lg border ${reporte.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {reporte.status === 'success' ? <CheckCircle className="text-green-600"/> : <XCircle className="text-red-600"/>}
            <h3 className={`font-bold ${reporte.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {reporte.message}
            </h3>
          </div>
          
          {reporte.errores.length > 0 && (
            <div className="mt-2 bg-white p-3 rounded border border-orange-200">
              <p className="text-orange-700 font-bold flex items-center gap-2 text-sm mb-2">
                <AlertTriangle className="w-4 h-4"/> Algunos registros no se pudieron guardar:
              </p>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {reporte.errores.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {!datos.length && (
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-10 bg-white text-center hover:bg-blue-50 transition animate-fade-in">
              <div className="flex flex-col items-center">
                <Upload className="w-12 h-12 text-blue-500 mb-4" />
                <p className="mb-4 text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>

                <input 
                  type="file" 
                  accept=".xlsx" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  id="excel-upload" 
                  ref={fileInputRef}
                />

                <label 
                  htmlFor="excel-upload" 
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition font-bold shadow-md"
                >
                  Seleccionar archivo .xlsx
                </label>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="font-bold text-gray-700 text-lg tracking-tight">Vista previa</h2>
                <p className="text-xs text-gray-500 font-medium">{datos.length} filas leídas</p>
              </div>
              
              <div className="flex gap-2">
                 {datos.length > 0 && (
                    <button
                        onClick={() => { setDatos([]); setFileObject(null); setArchivoNombre(""); }}
                        className="text-gray-500 hover:text-red-500 px-3 py-2 text-sm font-semibold transition"
                    >
                        Cancelar
                    </button>
                 )}
                 {datos.length > 0 && (
                    <button 
                      onClick={handleGuardarEnBaseDeDatos}
                      disabled={cargando}
                      className={`flex items-center gap-2 text-white px-6 py-2 rounded-lg transition font-bold shadow-lg ${cargando ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
                    >
                      {cargando ? (
                          <>Procesando...</>
                      ) : (
                          <><Database className="w-4 h-4" /> Importar a BD</>
                      )}
                    </button>
                  )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-100 border-b sticky top-0 z-10">
                  <tr className="text-gray-600 font-bold uppercase tracking-wider">
                    {datos.length > 0 ? Object.keys(datos[0]).map((head) => (
                        <th key={head} className="p-3 bg-gray-100">{head}</th>
                    )) : (
                        <th className="p-4">Sin datos...</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {datos.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                      {Object.values(row).map((val, i) => (
                          <td key={i} className="p-3 border-r border-gray-50 last:border-0 max-w-[200px] truncate" title={String(val)}>
                              {String(val || '')}
                          </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {datos.length === 0 && (
                <div className="p-16 text-center text-gray-400 italic">
                  No hay datos para previsualizar.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
            <h3 className="flex items-center font-bold text-blue-800 mb-4 text-xs tracking-wider uppercase">
              <FileSpreadsheet className="w-5 h-5 mr-2" /> Instrucciones SESA
            </h3>
            <ul className="text-sm space-y-4 text-gray-600 font-medium">
              <li className="flex gap-2 items-start">• El archivo debe ser extensión <strong>.xlsx</strong>.</li>
              <li className="flex gap-2 items-start">• Las columnas pueden tener o no los dos puntos ":" al final.</li>
              <li className="flex gap-2 items-start">• El sistema genera automáticamente el <strong>Usuario</strong> (Matrícula) y <strong>Contraseña</strong> (Matrícula temporal).</li>
            </ul>
            <button 
              onClick={descargarPlantilla}
              className="w-full mt-6 border-2 border-green-500 text-green-600 py-3 rounded-lg hover:bg-green-50 flex items-center justify-center font-bold transition-all gap-2 shadow-sm"
            >
              <Download className="w-5 h-5" />
              Descargar plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarAlumnos;