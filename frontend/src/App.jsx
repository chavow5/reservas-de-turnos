import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ReservaTurno from './components/ReservaTurno'

// Lazy loading: las páginas secundarias se cargan solo cuando se navega a ellas
// Esto reduce el bundle inicial y mejora el tiempo de carga de la página principal
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Success = lazy(() => import('./pages/Success'))
const Sorteo = lazy(() => import('./pages/Sorteo'))

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={
          <div className="flex justify-center items-center h-64 text-gray-500">
            Cargando...
          </div>
        }>
          <Routes>
            <Route path="/" element={<ReservaTurno />} />
            <Route path="/success" element={<Success />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sorteo" element={<Sorteo />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}