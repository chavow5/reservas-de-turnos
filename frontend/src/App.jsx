import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReservaTurno from './components/ReservaTurno'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Success from './pages/Success'
import Layout from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ReservaTurno />} />
          <Route path="/success" element={<Success />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}