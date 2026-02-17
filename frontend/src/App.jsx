import { useState } from 'react';
import ManualRegister from './components/form/ManualRegister';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      {/* Simulación del Dashboard Header */}
      <div className="bg-white p-6 rounded-lg shadow mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Alumnos</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          + Agregar Alumno
        </button>
      </div>

      {/* Aquí va la tabla de alumnos (tu compañero la hará) */}
      <div className="bg-white h-64 rounded-lg shadow flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
        Tabla de Alumnos (Placeholder)
      </div>

      {/* EL MODAL DE REGISTRO */}
      <ManualRegister isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}

export default App