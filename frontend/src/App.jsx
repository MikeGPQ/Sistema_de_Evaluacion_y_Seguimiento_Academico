import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import client from './lib/axios'
import ImportarAlumnos from './pages/Alumnos/ImportarAlumnos'

function App() {
  const [message, setMessage] = useState("Conectando...")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/')
      .then((response) => {
        
        const msg = response.data?.message || "Conectado al servidor";
        setMessage(msg);
      })
      .catch((error) => {
        setMessage("Error de conexión con el servidor.");
        console.error("Error:", error);
      })
      .finally(() => setLoading(false));
  }, [])

  
  const isError = typeof message === 'string' && message.includes('Error');

  return (
    <Router>

      <Routes>
        <Route path="/" element={<Navigate to="/alumnos/importar" />} />
        <Route path="/alumnos/importar" element={<ImportarAlumnos />} />
      </Routes>
    </Router>
  )
}

export default App