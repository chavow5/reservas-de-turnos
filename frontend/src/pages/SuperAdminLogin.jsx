import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function SuperAdminLogin() {
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
      const res = await fetch(`${API_URL}/api/superadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Credenciales de SuperAdmin inválidas')
        return
      }

      login(data.token, data.user)
      navigate('/superadmin/dashboard')
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-700 w-full max-w-md text-white">
        
        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">⚡</span>
          <h2 className="text-2xl font-black text-white">
            Super Administrador
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Control maestro de la plataforma SaaS
          </p>
        </div>

        {error && (
          <div className="text-rose-400 text-sm mb-4 bg-rose-950/50 border border-rose-800 rounded-xl px-4 py-3 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Usuario Maestro
            </label>
            <input
              type="text"
              placeholder="chavow5@superadmin"
              className="w-full border border-slate-700 p-3 rounded-xl bg-slate-900 focus:bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-700 p-3 rounded-xl bg-slate-900 focus:bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Validando...' : 'Acceder al Panel Maestro'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
          <Link to="/" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
            ← Volver a la App Principal
          </Link>
        </div>

      </div>
    </div>
  )
}
