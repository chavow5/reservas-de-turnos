import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TenantProvider } from './context/TenantContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ReservaTurno from './components/ReservaTurno'

// Lazy loading para páginas secundarias
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Success = lazy(() => import('./pages/Success'))
const Sorteo = lazy(() => import('./pages/Sorteo'))

const LoadingFallback = () => (
  <div className="flex justify-center items-center h-64 text-slate-500 font-medium">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
    Cargando...
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <Layout>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Rutas directas para un solo negocio */}
                <Route path="/" element={<ReservaTurno />} />
                <Route path="/success" element={<Success />} />
                <Route path="/sorteo" element={<Sorteo />} />
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Compatibilidad con enlaces previos que contenían slug */}
                <Route path="/:slug" element={<ReservaTurno />} />
                <Route path="/:slug/success" element={<Success />} />
                <Route path="/:slug/sorteo" element={<Sorteo />} />
                <Route path="/:slug/admin" element={<AdminLogin />} />
                <Route path="/:slug/dashboard" element={<Dashboard />} />

                {/* 404 Wildcard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  )
}