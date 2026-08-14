import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function AdminLogin() {
  const { slug, nombreNegocio } = useTenant()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          email,
          password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      // Guardar token y usuario en AuthContext
      login(data.token, data.user)

      // Redirigir al dashboard de este negocio
      navigate(`/${slug}/dashboard`)

    } catch (err) {
      setError('No se pudo conectar con el servidor. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 w-full max-w-md">
        
        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">🔐</span>
          <h2 className="text-2xl font-black text-slate-800">
            Acceso Administración
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestión de turnos para <span className="font-bold text-slate-700">{nombreNegocio}</span>
          </p>
        </div>

        {error && (
          <div className="text-rose-600 text-sm mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email / Usuario
            </label>
            <input
              type="text"
              placeholder="ej: admin@cancha.com"
              className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl transition-all shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Verificando...' : 'Ingresar al Panel'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center flex flex-col items-center gap-2 text-sm text-slate-500">
          <Link to={`/${slug}`} className="hover:text-blue-600 transition-colors font-medium">
            ← Volver a Reservas de {nombreNegocio}
          </Link>
          <Link to="/superadmin" className="text-slate-300 hover:text-slate-500 text-xs mt-2 transition-colors" title="Acceso">
            🔒
          </Link>
        </div>


      </div>
    </div>
  )
}