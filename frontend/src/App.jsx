import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TenantProvider } from './context/TenantContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ReservaTurno from './components/ReservaTurno'

// Lazy loading para páginas secundarias y SuperAdmin
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Success = lazy(() => import('./pages/Success'))
const Sorteo = lazy(() => import('./pages/Sorteo'))
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'))
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'))

const LoadingFallback = () => (
  <div className="flex justify-center items-center h-64 text-slate-500 font-medium">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
    Cargando...
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* SUPER ADMIN (Rutas Globales Maestras) */}
            <Route path="/superadmin" element={<SuperAdminLogin />} />
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />

            {/* RUTAS MULTI-TENANT CON TENANT PROVIDER */}
            {/* Ruta raíz por defecto redirige al negocio real */}
            <Route path="/" element={<Navigate to="/reservas-futbol" replace />} />


            {/* Rutas con Slug de Negocio */}
            <Route
              path="/:slug"
              element={
                <TenantProvider>
                  <Layout>
                    <ReservaTurno />
                  </Layout>
                </TenantProvider>
              }
            />

            <Route
              path="/:slug/admin"
              element={
                <TenantProvider>
                  <Layout>
                    <AdminLogin />
                  </Layout>
                </TenantProvider>
              }
            />

            <Route
              path="/:slug/dashboard"
              element={
                <TenantProvider>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </TenantProvider>
              }
            />

            <Route
              path="/:slug/success"
              element={
                <TenantProvider>
                  <Layout>
                    <Success />
                  </Layout>
                </TenantProvider>
              }
            />

            <Route
              path="/:slug/sorteo"
              element={
                <TenantProvider>
                  <Layout>
                    <Sorteo />
                  </Layout>
                </TenantProvider>
              }
            />

            {/* Fallbacks para URLs directas sin slug */}
            <Route path="/admin" element={<Navigate to="/pruebas-reservas/admin" replace />} />
            <Route path="/dashboard" element={<Navigate to="/pruebas-reservas/dashboard" replace />} />
            <Route path="/sorteo" element={<Navigate to="/pruebas-reservas/sorteo" replace />} />
            <Route path="/success" element={<Navigate to="/pruebas-reservas/success" replace />} />

            {/* 404 Wildcard */}
            <Route path="*" element={<Navigate to="/pruebas-reservas" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}