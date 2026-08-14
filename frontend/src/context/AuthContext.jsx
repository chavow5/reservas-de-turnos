import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken'))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('adminUser')
    try {
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (token) {
      localStorage.setItem('adminToken', token)
    } else {
      localStorage.removeItem('adminToken')
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem('adminUser', JSON.stringify(user))
    } else {
      localStorage.removeItem('adminUser')
    }
  }, [user])

  const login = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
  }

  const value = {
    token,
    user,
    isAuthenticated: !!token,
    isSuperAdmin: user?.rol === 'superadmin',
    isAdmin: user?.rol === 'admin' || user?.rol === 'superadmin',
    isColaborador: user?.rol === 'colaborador',
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}
