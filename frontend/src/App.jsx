import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { UserPlus, FileSpreadsheet } from 'lucide-react';
import ManualRegister from './components/form/ManualRegister';
import ImportarAlumnos from './pages/Alumnos/ImportarAlumnos';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardAlumnos />} />
        <Route path="/students/import" element={<ImportarAlumnos />} />
      </Routes>
    </BrowserRouter>
  );
}

function DashboardAlumnos() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-10 font-sans">
      
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Alumnos</h1>
          <p className="text-sm text-gray-500">Administra, registra e importa estudiantes</p>
        </div>

        <div className="flex gap-3">
          <Link 
            to="/students/import" 
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
          >
            <FileSpreadsheet size={20} />
            Importar Excel
          </Link>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm"
          >
            <UserPlus size={20} />
            Nuevo Ingreso
          </button>
        </div>
      </div>

      <div className="bg-white h-96 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-400">
        <div className="p-4 bg-gray-50 rounded-full mb-4">
          <UserPlus size={40} className="text-gray-300" />
        </div>
        <p className="font-medium">Tabla de alumnos</p>
      </div>

      <ManualRegister isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default App;