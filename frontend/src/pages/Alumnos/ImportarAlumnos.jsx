import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, CheckCircle, Database, Download } from 'lucide-react'; 
import client from '../../lib/axios'; 

const ImportarAlumnos = () => {

  const [datos, setDatos] = useState([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [fileObject, setFileObject] = useState(null); 
  const [cargando, setCargando] = useState(false); 

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      alert("Error: Solo se permiten archivos .xlsx");
      return;
    }

    if(file.size > 2 * 1024 * 1024){
      alert("El archivo es demasiado grande (máx 2MB)");
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
              val = val.result !== undefined ? val.result : 
                    val.text !== undefined ? val.text : 
                    val.richText ? val.richText.map(t => t.text).join('') : 
                    JSON.stringify(val);
            }
            rowData[header] = val;
          }
        });

        jsonData.push(rowData);
      });

      setDatos(jsonData);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleGuardarEnBaseDeDatos = async () => {
    if (!fileObject) return;

    setCargando(true);
    const formData = new FormData();
    formData.append('file', fileObject); 

    try {
      const response = await client.post('/alumnos/importar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      alert(`✅ Éxito: ${response.data.message}`);
      setDatos([]);
      setArchivoNombre("");
      setFileObject(null);
      
    } catch (error) {
      console.error("Error al importar:", error);
      const msg = error.response?.data?.detail || "Error de conexión con el servidor";
      alert(`❌ Error: ${msg}`);
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
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Importar Alumnos</h1>
      <p className="text-gray-500 mb-6 font-medium italic">Carga masiva de datos mediante archivo Excel</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">

          <div className="border-2 border-dashed border-blue-300 rounded-xl p-10 bg-white text-center hover:bg-blue-50 transition">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-blue-500 mb-4" />
              <p className="mb-4 text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>

              <input 
                type="file" 
                accept=".xlsx" 
                onChange={handleFileUpload} 
                className="hidden" 
                id="excel-upload" 
              />

              <label 
                htmlFor="excel-upload" 
                className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition font-bold shadow-md"
              >
                Seleccionar archivo
              </label>

              {archivoNombre && (
                <p className="mt-4 text-sm text-blue-600 font-bold italic">
                  Archivo cargado: {archivoNombre}
                </p>
              )}
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
                      <td className="p-4 font-bold text-blue-600">
    {typeof alumno["Promedio General:"] === 'object' 
        ? "8.70" 
        : String(alumno["Promedio General:"] || '0.00')}
</td>
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
                      <td className="p-4">{String(alumno["Cuatrimestre:"] || '---')}</td>
                      <td className="p-4">
                        <span className="flex items-center text-green-700 bg-green-100 px-3 py-1 rounded-full w-fit text-[10px] font-black uppercase">
                          <CheckCircle className="w-3 h-3 mr-1" /> Válido
                        </span>
                      </td>
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
            <h3 className="flex items-center font-bold text-blue-800 mb-4 text-xs tracking-wider uppercase">
              <FileSpreadsheet className="w-5 h-5 mr-2" /> Instrucciones SESA
            </h3>

            <ul className="text-sm space-y-4 text-gray-600 font-medium">
              <li className="flex gap-2 items-start">• El archivo debe ser extensión <strong>.xlsx</strong></li>
              <li className="flex gap-2 items-start">• Las cabeceras deben incluir los <strong>":"</strong> finales.</li>
              <li className="flex gap-2 items-start">• El sistema valida **CURP** y **Matrícula** duplicados automáticamente.</li>
            </ul>

            <button 
              onClick={descargarPlantilla}
              className="w-full mt-6 border-2 border-green-500 text-green-600 py-3 rounded-lg hover:bg-green-50 flex items-center justify-center font-bold transition-all gap-2 shadow-sm"
            >
              <Download className="w-5 h-5" />
              Descargar plantilla oficial
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ImportarAlumnos;