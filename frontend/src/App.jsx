import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ListadoAlumnos from './pages/Alumnos/ListadoAlumnos'


function App() {
  return (
    <Router>
      <Routes>
        {/* Redirigir al nuevo listado al iniciar */}
        <Route path="/" element={<Navigate to="/alumnos/listado" replace />} />
        
        {/* Rutas de Alumnos */}
        <Route path="/alumnos/listado" element={<ListadoAlumnos />} />
     
      </Routes>
    </Router>
  )
}

export default App
