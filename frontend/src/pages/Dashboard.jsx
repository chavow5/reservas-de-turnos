import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { ALL_POSSIBLE_HOURS, DEFAULT_HOURS, todayISO } from '../utils/dateUtils'
import SelectorCancha from '../components/SelectorCancha'
import Calendario from '../components/Calendario'
import SelectorHorario from '../components/SelectorHorario'
import * as XLSX from 'xlsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Dashboard() {
  const { 
    negocio,
    nombreNegocio, 
    telefono: tenantTelefono,
    direccion: tenantDireccion,
    montoSena: tenantMontoSena,
    precioTotal: tenantPrecioTotal,
    canchas: tenantCanchas = [], 
    horarios: tenantHorarios = [], 
    refreshTenant, 
    updateLocalConfig 
  } = useTenant()
  const { token, user, isAdmin, isColaborador, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('turnos') // 'turnos' | 'canchas' | 'config' | 'colaboradores'
  const [filterPeriodo, setFilterPeriodo] = useState('hoy') // 'hoy' | 'proximos' | 'historial' | 'todos'
  const [filterCancha, setFilterCancha] = useState('todas') // 'todas' | cancha.id
  const [filterPago, setFilterPago] = useState('todos') // 'todos' | 'pagado' | 'señado' | 'sin_pago'
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [nuevaReserva, setNuevaReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Gestión de Canchas y Disponibilidad (Admin y Colaboradores)
  const [canchas, setCanchas] = useState(
    tenantCanchas && tenantCanchas.length > 0
      ? tenantCanchas
      : [
          { id: '1', nombre: 'Cancha 1', activa: true },
          { id: '2', nombre: 'Cancha 2', activa: true }
        ]
  )
  const [togglingCanchaId, setTogglingCanchaId] = useState(null)
  const [modalNuevaCancha, setModalNuevaCancha] = useState(false)
  const [nuevaCanchaForm, setNuevaCanchaForm] = useState({ nombre: '', password: '', precio: '' })
  const [canchaError, setCanchaError] = useState('')
  const [guardandoCancha, setGuardandoCancha] = useState(false)

  const [modalEliminarCancha, setModalEliminarCancha] = useState(null)
  const [eliminarPassword, setEliminarPassword] = useState('')
  const [eliminandoCancha, setEliminandoCancha] = useState(false)
  const [eliminarError, setEliminarError] = useState('')

  // Config del Negocio (Admin)
  const [config, setConfig] = useState(() => {
    let cached = null
    try {
      const c = localStorage.getItem('cached_business_config')
      if (c) cached = JSON.parse(c)
    } catch (e) {}

    return {
      nombre: cached?.nombre || negocio?.nombre || nombreNegocio || 'ChavoF651',
      telefono: cached?.telefono !== undefined && cached?.telefono !== null ? cached.telefono : (negocio?.telefono || tenantTelefono || '3804201334'),
      direccion: cached?.direccion !== undefined && cached?.direccion !== null ? cached.direccion : (negocio?.direccion || tenantDireccion || 'san martin'),
      monto_sena: cached?.monto_sena ?? negocio?.monto_sena ?? tenantMontoSena ?? 100,
      precio_total: cached?.precio_total ?? negocio?.precio_total ?? tenantPrecioTotal ?? 100,
      horarios: (cached?.horarios && cached.horarios.length > 0)
        ? cached.horarios
        : (negocio?.horarios && negocio.horarios.length > 0)
          ? negocio.horarios
          : (tenantHorarios && tenantHorarios.length > 0 ? tenantHorarios : DEFAULT_HOURS),
      mp_access_token: '',
      tiene_mp_token: false
    }
  })
  const [configSaved, setConfigSaved] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Colaboradores (Admin)
  const [colaboradores, setColaboradores] = useState([])
  const [nuevoColab, setNuevoColab] = useState({ nombre: '', email: '', password: '' })
  const [colabMsg, setColabMsg] = useState('')

  // Sincronizar canchas y configuración cuando el contexto del negocio se cargue o actualice
  useEffect(() => {
    if (tenantCanchas && tenantCanchas.length > 0) {
      setCanchas(tenantCanchas)
    }
  }, [tenantCanchas])

  useEffect(() => {
    if (negocio) {
      setConfig(prev => ({
        ...prev,
        nombre: negocio.nombre || prev.nombre,
        telefono: (negocio.telefono !== undefined && negocio.telefono !== null) ? negocio.telefono : prev.telefono,
        direccion: (negocio.direccion !== undefined && negocio.direccion !== null) ? negocio.direccion : prev.direccion,
        monto_sena: negocio.monto_sena !== undefined ? negocio.monto_sena : prev.monto_sena,
        precio_total: negocio.precio_total !== undefined ? negocio.precio_total : prev.precio_total,
        horarios: (negocio.horarios && negocio.horarios.length > 0) ? negocio.horarios : prev.horarios
      }))
    }
  }, [negocio])

  const getAuthHeaders = useCallback(() => {
    const currentToken = token || localStorage.getItem('adminToken')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`
    }
  }, [token])

  const handleUnauthorized = useCallback(() => {
    logout()
    navigate('/admin')
  }, [logout, navigate])

  // Cargar reservas
  const fetchReservas = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/admin/reservas`, {
        headers: getAuthHeaders()
      })

      if (res.status === 401 || res.status === 403) {
        handleUnauthorized()
        return
      }

      const data = await res.json()
      const normalized = (data || []).map(r => ({
        ...r,
        cancha: r.cancha ?? '1',
        estado_pago: r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago'),
        creado_por: r.creado_por || (r.payment_id && String(r.payment_id).startsWith('manual_') ? 'Admin (Manual)' : 'Cliente (Online)')
      }))
      setReservas(normalized)
    } catch (err) {
      console.error('Error fetching reservas:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, handleUnauthorized])

  // Cargar Configuración (Solo Admin)
  const fetchConfig = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(prev => ({
          ...prev,
          ...data,
          nombre: data.nombre || prev.nombre,
          telefono: (data.telefono !== undefined && data.telefono !== null) ? data.telefono : prev.telefono,
          direccion: (data.direccion !== undefined && data.direccion !== null) ? data.direccion : prev.direccion,
          monto_sena: data.monto_sena !== undefined ? data.monto_sena : prev.monto_sena,
          precio_total: data.precio_total !== undefined ? data.precio_total : prev.precio_total,
          horarios: data.horarios && data.horarios.length > 0 ? data.horarios : (prev.horarios || DEFAULT_HOURS),
          tiene_mp_token: !!data.tiene_mp_token
        }))
        if (updateLocalConfig) {
          updateLocalConfig(data)
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    }
  }, [isAdmin, getAuthHeaders, updateLocalConfig])

  // Cargar Canchas y su Disponibilidad (Admin y Colaborador)
  const fetchCanchas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/canchas`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCanchas(data)
        }
      }
    } catch (err) {
      console.error('Error fetching canchas:', err)
    }
  }, [getAuthHeaders])

  // Alternar disponibilidad de una cancha (Admin y Colaborador)
  const toggleDisponibilidadCancha = async (canchaId, estadoActual) => {
    setTogglingCanchaId(canchaId)
    try {
      const nuevoEstado = !estadoActual
      const res = await fetch(`${API_URL}/admin/canchas/${canchaId}/disponibilidad`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ activa: nuevoEstado })
      })

      if (res.ok) {
        const data = await res.json()
        setCanchas(data.canchas || [])
        refreshTenant()
      } else {
        const err = await res.json()
        alert(`Error al actualizar estado de la cancha: ${err.error}`)
      }
    } catch (err) {
      console.error('Error cambiando disponibilidad:', err)
      alert('Error de conexión al cambiar disponibilidad de la cancha')
    } finally {
      setTogglingCanchaId(null)
    }
  }

  // Agregar nueva cancha (Solo Admin con validación de clave)
  const handleAgregarCancha = async (e) => {
    e.preventDefault()
    setCanchaError('')
    if (!nuevaCanchaForm.nombre.trim()) {
      setCanchaError('Ingresá el nombre de la cancha.')
      return
    }
    if (!nuevaCanchaForm.password) {
      setCanchaError('Ingresá la contraseña del administrador.')
      return
    }
    setGuardandoCancha(true)
    try {
      const res = await fetch(`${API_URL}/admin/canchas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nombre: nuevaCanchaForm.nombre.trim(),
          password: nuevaCanchaForm.password,
          precio: nuevaCanchaForm.precio ? Number(nuevaCanchaForm.precio) : (Number(config.precio_total) || 100)
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setCanchaError(data.error || 'Error al agregar la cancha')
        return
      }
      setCanchas(data.canchas || [])
      if (refreshTenant) refreshTenant()
      setModalNuevaCancha(false)
      setNuevaCanchaForm({ nombre: '', password: '', precio: '' })
      alert(`¡${data.mensaje || 'Cancha agregada exitosamente'}!`)
    } catch (err) {
      console.error('Error al agregar cancha:', err)
      setCanchaError('Error de conexión al agregar la cancha.')
    } finally {
      setGuardandoCancha(false)
    }
  }

  // Eliminar cancha (Solo Admin con validación de clave)
  const handleEliminarCancha = async (e) => {
    e.preventDefault()
    if (!modalEliminarCancha) return
    setEliminarError('')
    if (!eliminarPassword) {
      setEliminarError('Ingresá la contraseña del administrador.')
      return
    }
    setEliminandoCancha(true)
    try {
      const res = await fetch(`${API_URL}/admin/canchas/${modalEliminarCancha.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password: eliminarPassword
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setEliminarError(data.error || 'Error al eliminar la cancha')
        return
      }
      setCanchas(data.canchas || [])
      if (refreshTenant) refreshTenant()
      setModalEliminarCancha(null)
      setEliminarPassword('')
      alert(`¡${data.mensaje || 'Cancha eliminada exitosamente'}!`)
    } catch (err) {
      console.error('Error al eliminar cancha:', err)
      setEliminarError('Error de conexión al eliminar la cancha.')
    } finally {
      setEliminandoCancha(false)
    }
  }

  // Cargar Colaboradores (Solo Admin)
  const fetchColaboradores = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch(`${API_URL}/admin/colaboradores`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setColaboradores(data || [])
      }
    } catch (err) {
      console.error('Error fetching colaboradores:', err)
    }
  }, [isAdmin, getAuthHeaders])

  useEffect(() => {
    const currentToken = token || localStorage.getItem('adminToken')
    if (!currentToken) {
      navigate('/admin')
      return
    }
    fetchReservas()
    fetchCanchas()
    if (isAdmin) {
      fetchConfig()
      fetchColaboradores()
    }
  }, [token, navigate, isAdmin, fetchReservas, fetchCanchas, fetchConfig, fetchColaboradores])

  // Formateador de fecha
  const formatearTurno = (fecha, hora) => {
    if (!fecha) return ''
    const [year, month, day] = fecha.split('-')
    const date = new Date(year, month - 1, day)
    const diaTexto = date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    const horaTexto = hora?.split(':')[0] || hora
    return `${diaTexto} - ${horaTexto}hs`
  }

  // Cambiar estado de pago rápido desde la tabla o tarjetas
  const cambiarEstadoPago = async (id, nuevoEstado) => {
    const res = await fetch(`${API_URL}/admin/reservas/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        estado_pago: nuevoEstado,
        pagado: ['pagado', 'señado'].includes(nuevoEstado)
      })
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    if (res.ok) {
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado_pago: nuevoEstado, pagado: ['pagado', 'señado'].includes(nuevoEstado) } : r))
    }
  }

  // Eliminar reserva
  const eliminarReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva definitivamente?')) return

    const res = await fetch(`${API_URL}/admin/reservas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    fetchReservas()
  }

  // Guardar edición completa
  const guardarEdicion = async () => {
    const res = await fetch(`${API_URL}/admin/reservas/${editando.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...editando,
        pagado: ['pagado', 'señado'].includes(editando.estado_pago)
      })
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    if (!res.ok) {
      const errorData = await res.json()
      alert(`Error al guardar: ${errorData.error || 'Ocurrió un error inesperado'}`)
      return
    }

    setEditando(null)
    fetchReservas()
  }

  // Crear reserva manual
  const crearReserva = async () => {
    if (!nuevaReserva) return
    if (!nuevaReserva.nombre?.trim()) {
      return alert('Por favor, ingresá el nombre del jugador.')
    }
    if (!nuevaReserva.fecha) {
      return alert('Por favor, seleccioná una fecha en el calendario.')
    }
    if (!nuevaReserva.hora) {
      return alert('Por favor, seleccioná un horario disponible.')
    }

    const montoCalculado = nuevaReserva.estado_pago === 'pagado'
      ? (config.precio_total || config.monto_sena || 100)
      : nuevaReserva.estado_pago === 'señado'
        ? (config.monto_sena || 100)
        : 0

    const autor = user?.nombre || user?.email || (isAdmin ? 'Admin' : 'Colaborador')
    const payload = {
      ...nuevaReserva,
      nombre: nuevaReserva.nombre.trim(),
      monto_pagado: nuevaReserva.monto_pagado !== undefined ? nuevaReserva.monto_pagado : montoCalculado,
      creado_por: autor
    }

    try {
      const res = await fetch(`${API_URL}/admin/reservas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        alert(`Error al crear: ${errorData.error || 'Ocurrió un error inesperado'}`)
        return
      }

      setNuevaReserva(null)
      fetchReservas()
    } catch (err) {
      console.error('Error al crear reserva manual:', err)
      alert('Error de conexión al intentar guardar la reserva manual.')
    }
  }

  // Guardar Configuración
  const guardarConfig = async (e) => {
    e.preventDefault()
    setConfigSaved(false)
    setSavingConfig(true)

    // Actualización inmediata en la UI de todo el sistema
    if (updateLocalConfig) {
      updateLocalConfig({
        nombre: config.nombre,
        telefono: config.telefono,
        direccion: config.direccion,
        monto_sena: Number(config.monto_sena),
        precio_total: Number(config.precio_total),
        horarios: config.horarios
      })
    }

    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      })

      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setConfig(prev => ({
            ...prev,
            ...data.config,
            mp_access_token: config.mp_access_token || prev.mp_access_token
          }))
          if (updateLocalConfig) {
            updateLocalConfig(data.config)
          }
        }
        setConfigSaved(true)
        refreshTenant()
        alert('¡Cambios guardados correctamente!')
        setTimeout(() => setConfigSaved(false), 4000)
      } else {
        const err = await res.json()
        alert(`Error al guardar configuración: ${err.error}`)
      }
    } catch (err) {
      console.error('Error guardando config:', err)
      alert('Error de conexión al guardar configuración')
    } finally {
      setSavingConfig(false)
    }
  }

  // Presets y gestión de horarios para el negocio
  const aplicarPresetHorarios = (preset) => {
    let nuevos = []
    if (preset === 'tarde_noche') {
      nuevos = ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00']
    } else if (preset === 'completo') {
      nuevos = [
        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
        '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00'
      ]
    } else if (preset === 'nocturno') {
      nuevos = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00']
    } else if (preset === 'matutino_tarde') {
      nuevos = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']
    }
    setConfig({ ...config, horarios: nuevos })
  }

  const toggleHorarioSlot = (hora) => {
    const current = config.horarios || []
    if (current.includes(hora)) {
      if (current.length <= 1) {
        alert('Debe haber al menos 1 horario disponible configurado.')
        return
      }
      setConfig({ ...config, horarios: current.filter(h => h !== hora) })
    } else {
      const updated = [...current, hora].sort(
        (a, b) => ALL_POSSIBLE_HOURS.indexOf(a) - ALL_POSSIBLE_HOURS.indexOf(b)
      )
      setConfig({ ...config, horarios: updated })
    }
  }

  // Crear Colaborador
  const crearColaborador = async (e) => {
    e.preventDefault()
    setColabMsg('')

    const res = await fetch(`${API_URL}/admin/colaboradores`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(nuevoColab)
    })

    const data = await res.json()

    if (res.ok) {
      setNuevoColab({ nombre: '', email: '', password: '' })
      setColabMsg('Colaborador agregado con éxito')
      fetchColaboradores()
      setTimeout(() => setColabMsg(''), 3000)
    } else {
      alert(`Error: ${data.error}`)
    }
  }

  // Eliminar Colaborador
  const eliminarColaborador = async (id) => {
    if (!confirm('¿Eliminar acceso a este colaborador?')) return

    const res = await fetch(`${API_URL}/admin/colaboradores/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (res.ok) {
      fetchColaboradores()
    } else {
      const data = await res.json()
      alert(`Error: ${data.error}`)
    }
  }

  // Cálculo de fechas y grupos temporales
  const hoy = todayISO()
  const fechaHoyObj = new Date()
  const diaHoyTexto = fechaHoyObj.toLocaleDateString('es-AR', { weekday: 'long' })
  const diaHoyNumero = fechaHoyObj.getDate()
  const mesHoyTexto = fechaHoyObj.toLocaleDateString('es-AR', { month: 'long' })

  const reservasHoy = useMemo(() => {
    return reservas.filter(r => r.fecha === hoy).sort((a, b) => a.hora.localeCompare(b.hora))
  }, [reservas, hoy])

  const reservasProximos = useMemo(() => {
    return reservas.filter(r => r.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
  }, [reservas, hoy])

  const reservasHistorial = useMemo(() => {
    return reservas.filter(r => r.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))
  }, [reservas, hoy])

  const reservasSemana = useMemo(() => {
    return reservas.filter(r => {
      const fecha = new Date(r.fecha)
      const diff = (fecha - fechaHoyObj) / (1000 * 60 * 60 * 24)
      return diff >= -1 && diff <= 7
    })
  }, [reservas, fechaHoyObj])

  // Horarios de turnos disponibles del negocio
  const businessHorarios = config.horarios && config.horarios.length > 0
    ? config.horarios
    : (tenantHorarios && tenantHorarios.length > 0 ? tenantHorarios : DEFAULT_HOURS)

  // Filtrado compuesto para la tabla y tarjetas móviles
  const reservasFiltradas = useMemo(() => {
    let lista = reservas

    if (filterPeriodo === 'hoy') lista = reservasHoy
    else if (filterPeriodo === 'proximos') lista = reservasProximos
    else if (filterPeriodo === 'historial') lista = reservasHistorial

    if (filterCancha !== 'todas') {
      lista = lista.filter(r => String(r.cancha) === String(filterCancha))
    }

    if (filterPago !== 'todos') {
      lista = lista.filter(r => r.estado_pago === filterPago)
    }

    if (searchTerm.trim()) {
      lista = lista.filter(r => r.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    return lista
  }, [reservas, reservasHoy, reservasProximos, reservasHistorial, filterPeriodo, filterCancha, filterPago, searchTerm])

  const totalPages = Math.max(1, Math.ceil(reservasFiltradas.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const reservasPaginadas = reservasFiltradas.slice(startIndex, startIndex + itemsPerPage)

  const copiarWhatsApp = (lista, titulo) => {
    let texto = `*${titulo.toUpperCase()} - ${nombreNegocio}*\n\n`
    if (lista.length === 0) {
      texto += `No hay turnos registrados en este período.\n`
    } else {
      lista.forEach(r => {
        const nombreCancha = canchas.find(c => String(c.id) === String(r.cancha))?.nombre || `Cancha ${r.cancha}`
        const estadoTxt = r.estado_pago === 'pagado' ? '[PAGADO]' : r.estado_pago === 'señado' ? '[SEÑADO]' : '[SIN PAGO]'
        texto += `*${r.hora}hs* - ${nombreCancha}\n`
        texto += `  Jugador: *${r.nombre}*\n`
        texto += `  Estado: ${estadoTxt}\n\n`
      })
    }
    navigator.clipboard.writeText(texto)
    alert('Lista de turnos copiada para WhatsApp')
  }

  // Exportar lista actual de turnos a archivo Excel (.xlsx)
  const exportarExcel = () => {
    if (reservasFiltradas.length === 0) {
      return alert('No hay turnos para exportar con los filtros seleccionados.')
    }

    const datos = reservasFiltradas.map(r => {
      const canchaObj = canchas.find(c => String(c.id) === String(r.cancha))
      const estadoTexto = r.estado_pago === 'pagado'
        ? 'Pagado Total'
        : r.estado_pago === 'señado'
          ? 'Señado'
          : 'Sin Pago'

      const creadorTexto = r.creado_por || (r.payment_id && String(r.payment_id).startsWith('manual_') ? 'Admin (Manual)' : 'Cliente (Online)')

      return {
        'Jugador': r.nombre || 'Sin nombre',
        'Cancha': canchaObj?.nombre || `Cancha ${r.cancha}`,
        'Fecha': r.fecha || '',
        'Hora': r.hora ? `${r.hora} hs` : '',
        'Estado de Pago': estadoTexto,
        'Monto Pagado ($)': Number(r.monto_pagado) || 0,
        'Registrado Por': creadorTexto
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(datos)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas')

    // Ancho de columnas óptimo
    worksheet['!cols'] = [
      { wch: 26 }, // Jugador
      { wch: 15 }, // Cancha
      { wch: 15 }, // Fecha
      { wch: 12 }, // Hora
      { wch: 16 }, // Estado de Pago
      { wch: 16 }, // Monto Pagado
      { wch: 24 }  // Registrado Por
    ]

    const nombreComplejo = (config.nombre || nombreNegocio || 'Complejo').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filtroNombre = filterPeriodo || 'turnos'
    const fileName = `Reservas_${nombreComplejo}_${filtroNombre}_${todayISO()}.xlsx`

    XLSX.writeFile(workbook, fileName)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16 overflow-x-hidden w-full max-w-full">
      
      {/* HEADER DASHBOARD RESPONSIVE */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 sticky top-0 z-20 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
          
          <div className="flex justify-between items-center">
            <Link to="/" className="text-base sm:text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate max-w-[180px] sm:max-w-none">
              {config.nombre || nombreNegocio}
            </Link>
            
            <div className="flex items-center gap-2 sm:hidden">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isAdmin 
                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {isAdmin ? 'Admin' : 'Colab'}
              </span>

              <button
                onClick={handleUnauthorized}
                className="bg-rose-50 text-rose-600 font-bold px-2 py-1 rounded-lg text-xs"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          </div>

          {/* NAVEGACIÓN DE PESTAÑAS (SCROLLABLE EN CELULAR) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto touch-pan-x">
            <button
              onClick={() => setActiveTab('turnos')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 active:scale-95 ${
                activeTab === 'turnos'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Turnos
            </button>

            <button
              onClick={() => setActiveTab('canchas')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
                activeTab === 'canchas'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Canchas ({canchas.length})
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 active:scale-95 ${
                    activeTab === 'config'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Horarios & Config
                </button>
                <button
                  onClick={() => setActiveTab('colaboradores')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 active:scale-95 ${
                    activeTab === 'colaboradores'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Equipo
                </button>
              </>
            )}

            <button
              onClick={handleUnauthorized}
              className="hidden sm:block bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shrink-0 ml-1"
            >
              Cerrar sesión
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 pt-4 sm:pt-8 w-full overflow-hidden">
        
        {/* ======================================================== */}
        {/* PESTAÑA 1: GESTIÓN DE TURNOS                            */}
        {/* ======================================================== */}
        {activeTab === 'turnos' && (
          <div className="animate-fade-in space-y-5 sm:space-y-8 w-full">
            
            {/* TARJETAS DE MÉTRICAS RÁPIDAS (ADAPTADAS A CELULAR) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full">
              
              <button
                onClick={() => setFilterPeriodo('hoy')}
                className={`text-left p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all active:scale-95 min-w-0 ${
                  filterPeriodo === 'hoy'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 ring-2 ring-blue-400'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <p className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wider ${filterPeriodo === 'hoy' ? 'text-blue-100' : 'text-slate-400'}`}>
                    Turnos Hoy
                  </p>
                </div>
                <p className="text-xl sm:text-3xl font-black">{reservasHoy.length}</p>
                <p className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${filterPeriodo === 'hoy' ? 'text-blue-100' : 'text-slate-500'}`}>
                  {diaHoyTexto} {diaHoyNumero}
                </p>
              </button>

              <button
                onClick={() => setFilterPeriodo('proximos')}
                className={`text-left p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all active:scale-95 min-w-0 ${
                  filterPeriodo === 'proximos'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200 ring-2 ring-indigo-400'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <p className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wider ${filterPeriodo === 'proximos' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Próximos
                  </p>
                </div>
                <p className="text-xl sm:text-3xl font-black">{reservasProximos.length}</p>
                <p className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${filterPeriodo === 'proximos' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  Desde mañana
                </p>
              </button>

              <button
                onClick={() => setFilterPeriodo('historial')}
                className={`text-left p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all active:scale-95 min-w-0 ${
                  filterPeriodo === 'historial'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200 ring-2 ring-purple-400'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-purple-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <p className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wider ${filterPeriodo === 'historial' ? 'text-purple-100' : 'text-slate-400'}`}>
                    Historial
                  </p>
                </div>
                <p className="text-xl sm:text-3xl font-black">{reservasHistorial.length}</p>
                <p className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${filterPeriodo === 'historial' ? 'text-purple-100' : 'text-slate-500'}`}>
                  Finalizados
                </p>
              </button>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between min-w-0">
                <div>
                  <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">Canchas / Seña</p>
                  <p className="text-lg sm:text-2xl font-black text-emerald-600">${config.monto_sena || 100}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
                  {canchas.filter(c => c.activa !== false).length}/{canchas.length} activas
                </p>
              </div>

            </div>

            {/* SECCIÓN DESTACADA: CANCHAS DEL DÍA DE HOY */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 text-white shadow-xl w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 border-b border-slate-700/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                      Turnos de Hoy por Cancha
                    </h2>
                  </div>
                  <p className="text-amber-300 text-xs sm:text-sm font-medium mt-0.5 capitalize">
                    {diaHoyTexto}, {diaHoyNumero} de {mesHoyTexto} ({reservasHoy.length} turnos)
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => copiarWhatsApp(reservasHoy, `Turnos de Hoy (${diaHoyTexto} ${diaHoyNumero})`)}
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    Copiar Hoy (WhatsApp)
                  </button>
                  <button
                    onClick={() => {
                      if (nuevaReserva) {
                        setNuevaReserva(null)
                      } else {
                        setNuevaReserva({
                          nombre: '',
                          cancha: canchas[0]?.id || '1',
                          fecha: hoy,
                          hora: '',
                          estado_pago: 'señado',
                          monto_pagado: config.monto_sena || 100
                        })
                      }
                    }}
                    className={`w-full sm:w-auto text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 ${
                      nuevaReserva 
                        ? 'bg-purple-800 hover:bg-purple-900 text-white ring-2 ring-purple-400' 
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {nuevaReserva ? '✕ Cerrar Reserva' : '+ Nueva Reserva Manual'}
                  </button>
                </div>
              </div>

              {/* GRILLA DE TARJETAS DE CADA CANCHA PARA HOY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
                {canchas.map(cancha => {
                  const turnosCanchaHoy = reservasHoy.filter(r => String(r.cancha) === String(cancha.id))
                  const isActiva = cancha.activa !== false

                  return (
                    <div
                      key={cancha.id}
                      className="bg-slate-900/90 border border-slate-700/70 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between backdrop-blur-md w-full min-w-0"
                    >
                      <div>
                        {/* CABECERA CANCHA */}
                        <div className="flex justify-between items-center mb-2.5 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <h3 className="font-bold text-white text-sm sm:text-base truncate">{cancha.nombre}</h3>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {cancha.id}</span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            isActiva
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border-rose-800'
                          }`}>
                            {isActiva ? 'Visible' : 'Pausada'}
                          </span>
                        </div>

                        {/* LISTA DE TURNOS DE HOY DE ESTA CANCHA */}
                        {turnosCanchaHoy.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60 p-2.5">
                            <p className="text-xs font-semibold text-slate-300">Cancha disponible hoy</p>
                            <p className="text-[10px] text-slate-500">Sin turnos reservados para hoy.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {turnosCanchaHoy.map(t => (
                              <div
                                key={t.id}
                                className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex justify-between items-center gap-1.5 hover:border-slate-700 transition-colors min-w-0"
                              >
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <span className="bg-blue-950 text-blue-300 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-blue-800 shrink-0">
                                    {t.hora} hs
                                  </span>
                                  <p className="font-bold text-xs text-white truncate max-w-[100px] sm:max-w-[140px]">
                                    {t.nombre}
                                  </p>
                                </div>

                                <div className="shrink-0">
                                  <select
                                    value={t.estado_pago || (t.pagado ? 'pagado' : 'sin_pago')}
                                    onChange={e => cambiarEstadoPago(t.id, e.target.value)}
                                    className={`text-[10px] font-bold px-1.5 py-1 rounded-lg border cursor-pointer outline-none ${
                                      t.estado_pago === 'pagado'
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                        : t.estado_pago === 'señado'
                                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                                        : 'bg-rose-950 text-rose-300 border-rose-800'
                                    }`}
                                  >
                                    <option value="pagado" className="bg-slate-900 text-emerald-300">Pagado</option>
                                    <option value="señado" className="bg-slate-900 text-amber-300">Señado</option>
                                    <option value="sin_pago" className="bg-slate-900 text-rose-300">Sin Pago</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                        <span>Total hoy:</span>
                        <strong className="text-amber-300 font-bold">{turnosCanchaHoy.length} turnos</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* FORMULARIO NUEVA RESERVA MANUAL (INTERACTIVO CON CALENDARIO Y CANCHAS) */}
            {nuevaReserva && (
              <div className="bg-white p-4 sm:p-7 shadow-lg rounded-2xl sm:rounded-3xl border border-purple-200 border-l-4 border-l-purple-600 mb-6 animate-fade-in w-full">
                
                {/* Cabecera del formulario */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
                      Nueva Reserva Manual
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Seleccioná la cancha, el día en el calendario y el horario disponible para agendar el turno.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNuevaReserva(null)}
                    className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Cerrar formulario"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 1. Nombre y Estado de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Nombre del Jugador <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                      value={nuevaReserva.nombre}
                      onChange={e => setNuevaReserva({ ...nuevaReserva, nombre: e.target.value })}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Estado de Pago
                    </label>
                    <select
                      className="w-full border border-slate-300 px-3 py-2.5 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50 cursor-pointer"
                      value={nuevaReserva.estado_pago}
                      onChange={e => {
                        const nuevoEstado = e.target.value
                        const canchaObj = canchas.find(c => String(c.id) === String(nuevaReserva.cancha))
                        const precioCompleto = Number(canchaObj?.precio) || Number(config.precio_total) || 100
                        let nuevoMonto = 0
                        if (nuevoEstado === 'pagado') nuevoMonto = precioCompleto
                        else if (nuevoEstado === 'señado') nuevoMonto = Number(config.monto_sena) || 100
                        setNuevaReserva({
                          ...nuevaReserva,
                          estado_pago: nuevoEstado,
                          monto_pagado: nuevoMonto
                        })
                      }}
                    >
                      <option value="señado">Señado (${config.monto_sena || 100})</option>
                      <option value="pagado">Pagado Total (${canchas.find(c => String(c.id) === String(nuevaReserva.cancha))?.precio || config.precio_total || 100})</option>
                      <option value="sin_pago">Sin Pago ($0)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Selector de Cancha */}
                <div className="mb-4">
                  <SelectorCancha
                    canchas={canchas}
                    selectedCancha={nuevaReserva.cancha}
                    onSelect={canchaId => {
                      setNuevaReserva(prev => ({
                        ...prev,
                        cancha: canchaId,
                        hora: ''
                      }))
                    }}
                  />
                </div>

                {/* 3. Calendario con disponibilidad visual */}
                <div className="mb-4">
                  <Calendario
                    formFecha={nuevaReserva.fecha}
                    formCancha={nuevaReserva.cancha}
                    reservas={reservas}
                    horarios={businessHorarios}
                    allowAllDates={true}
                    onSelectDay={fechaIso => {
                      setNuevaReserva(prev => ({
                        ...prev,
                        fecha: fechaIso,
                        hora: ''
                      }))
                    }}
                  />
                </div>

                {/* 4. Selector de Horarios */}
                <div className="mb-6">
                  <SelectorHorario
                    formFecha={nuevaReserva.fecha}
                    formCancha={nuevaReserva.cancha}
                    formHora={nuevaReserva.hora}
                    reservas={reservas}
                    horarios={businessHorarios}
                    allowPastHours={true}
                    onSelectHour={hora => {
                      setNuevaReserva(prev => ({
                        ...prev,
                        hora
                      }))
                    }}
                  />
                </div>

                {/* 5. Resumen del turno y Botones de Acción */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs sm:text-sm text-slate-700 font-medium text-center sm:text-left">
                    <p className="font-bold text-slate-800 text-sm sm:text-base">
                      {nuevaReserva.nombre?.trim() ? nuevaReserva.nombre : 'Jugador por confirmar'}
                    </p>
                    <p className="text-slate-500">
                      Cancha: <span className="font-semibold text-slate-800">{canchas.find(c => String(c.id) === String(nuevaReserva.cancha))?.nombre || `Cancha ${nuevaReserva.cancha}`}</span>
                      {' • '}
                      Fecha: <span className="font-semibold text-slate-800">{nuevaReserva.fecha || 'Sin fecha'}</span>
                      {' • '}
                      Hora: <span className="font-semibold text-blue-600">{nuevaReserva.hora ? `${nuevaReserva.hora} hs` : 'Sin horario seleccionado'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setNuevaReserva(null)}
                      className="flex-1 sm:flex-none bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-xl border border-slate-300 text-xs sm:text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={crearReserva}
                      disabled={!nuevaReserva.nombre?.trim() || !nuevaReserva.fecha || !nuevaReserva.hora}
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white font-bold py-2.5 px-6 rounded-xl text-xs sm:text-sm transition-all shadow-sm shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirmar Reserva
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* BARRA DE FILTROS: PERÍODO, CANCHAS, PAGO Y BUSCADOR */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 space-y-3 w-full overflow-hidden">
              
              {/* FILA 1: FILTROS DE PERÍODO TEMPORAL (SCROLLABLE) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                <div className="overflow-x-auto no-scrollbar py-0.5 w-full touch-pan-x">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <button
                      onClick={() => { setFilterPeriodo('hoy'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                        filterPeriodo === 'hoy'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Hoy ({reservasHoy.length})
                    </button>

                    <button
                      onClick={() => { setFilterPeriodo('proximos'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                        filterPeriodo === 'proximos'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Próximos ({reservasProximos.length})
                    </button>

                    <button
                      onClick={() => { setFilterPeriodo('historial'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                        filterPeriodo === 'historial'
                          ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Historial ({reservasHistorial.length})
                    </button>

                    <button
                      onClick={() => { setFilterPeriodo('todos'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                        filterPeriodo === 'todos'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({reservas.length})
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    onClick={exportarExcel}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    title="Exportar los turnos visibles a archivo Excel (.xlsx)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar a Excel
                  </button>
                  <button
                    onClick={() => copiarWhatsApp(reservasSemana, 'Turnos de la SEMANA')}
                    className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    Copiar Semana
                  </button>
                </div>
              </div>

              {/* FILA 2: FILTRO POR CANCHA Y ESTADO DE PAGO */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                
                {/* FILTRO POR CANCHA (SCROLLABLE) */}
                <div className="overflow-x-auto no-scrollbar py-0.5 w-full touch-pan-x">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Cancha:
                    </span>
                    <button
                      onClick={() => { setFilterCancha('todas'); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                        filterCancha === 'todas'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todas
                    </button>
                    {canchas.map(c => {
                      const totalEnCancha = reservas.filter(r => String(r.cancha) === String(c.id)).length
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setFilterCancha(c.id); setCurrentPage(1); }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                            String(filterCancha) === String(c.id)
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {c.nombre} ({totalEnCancha})
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* FILTRO PAGO Y BUSCADOR */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                  <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold justify-between sm:justify-start">
                    <button
                      onClick={() => { setFilterPago('todos'); setCurrentPage(1); }}
                      className={`px-2 py-1 rounded-lg transition-all text-center flex-1 sm:flex-none ${filterPago === 'todos' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500'}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => { setFilterPago('pagado'); setCurrentPage(1); }}
                      className={`px-2 py-1 rounded-lg transition-all text-center flex-1 sm:flex-none ${filterPago === 'pagado' ? 'bg-emerald-500 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                    >
                      Pagados
                    </button>
                    <button
                      onClick={() => { setFilterPago('señado'); setCurrentPage(1); }}
                      className={`px-2 py-1 rounded-lg transition-all text-center flex-1 sm:flex-none ${filterPago === 'señado' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                    >
                      Señados
                    </button>
                    <button
                      onClick={() => { setFilterPago('sin_pago'); setCurrentPage(1); }}
                      className={`px-2 py-1 rounded-lg transition-all text-center flex-1 sm:flex-none ${filterPago === 'sin_pago' ? 'bg-rose-500 text-white shadow-sm font-bold' : 'text-slate-500'}`}
                    >
                      Sin Pago
                    </button>
                  </div>

                  <div className="relative w-full sm:w-52">
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                    <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

              </div>

            </div>

            {/* ======================================================== */}
            {/* VISTA MÓVIL: TARJETAS DE RESERVAS (PANTALLAS PEQUEÑAS)  */}
            {/* ======================================================== */}
            <div className="block md:hidden space-y-2.5 w-full overflow-hidden">
              {loading ? (
                <div className="bg-white p-6 rounded-2xl text-center text-slate-400 shadow-sm border border-slate-100 text-xs">
                  Cargando reservas...
                </div>
              ) : reservasPaginadas.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl text-center text-slate-400 shadow-sm border border-slate-100 text-xs">
                  No se encontraron reservas con los filtros aplicados ({filterPeriodo.toUpperCase()}).
                </div>
              ) : (
                reservasPaginadas.map(r => {
                  const nombreCancha = canchas.find(c => String(c.id) === String(r.cancha))?.nombre || `Cancha ${r.cancha}`
                  const isEdicionActual = editando?.id === r.id

                  if (isEdicionActual) {
                    return (
                      <div key={r.id} className="bg-white p-3.5 rounded-2xl border-2 border-blue-500 shadow-md space-y-2.5 animate-fade-in w-full">
                        <p className="text-xs font-bold text-blue-600 uppercase">Editando Reserva</p>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nombre</label>
                          <input
                            className="w-full border border-slate-300 p-2 rounded-xl text-xs font-medium"
                            value={editando.nombre}
                            onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cancha</label>
                            <select
                              className="w-full border border-slate-300 p-2 rounded-xl text-xs font-medium"
                              value={editando.cancha}
                              onChange={e => setEditando({ ...editando, cancha: e.target.value })}
                            >
                              {canchas.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Hora</label>
                            <select
                              className="w-full border border-slate-300 p-2 rounded-xl text-xs font-medium"
                              value={editando.hora}
                              onChange={e => setEditando({ ...editando, hora: e.target.value })}
                            >
                              {businessHorarios.map(h => <option key={h} value={h}>{h} hs</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Fecha</label>
                          <input
                            type="date"
                            className="w-full border border-slate-300 p-2 rounded-xl text-xs"
                            value={editando.fecha}
                            onChange={e => setEditando({ ...editando, fecha: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Estado de Pago</label>
                          <select
                            className="w-full border border-slate-300 p-2 rounded-xl text-xs font-bold"
                            value={editando.estado_pago}
                            onChange={e => setEditando({ ...editando, estado_pago: e.target.value })}
                          >
                            <option value="pagado">Pagado Total</option>
                            <option value="señado">Señado</option>
                            <option value="sin_pago">Sin Pago</option>
                          </select>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl text-[11px] text-slate-600 flex justify-between items-center border border-slate-200">
                          <span>Registrado por:</span>
                          <strong className="text-slate-800">
                            {editando.creado_por || (editando.payment_id && String(editando.payment_id).startsWith('manual_') ? 'Admin (Manual)' : 'Cliente (Online)')}
                          </strong>
                          <span className="text-[9px] text-slate-400 font-medium">(No editable)</span>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={guardarEdicion}
                            className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            className="bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-xl text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={r.id}
                      className="bg-white p-3 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 space-y-2 transition-all w-full min-w-0"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{r.nombre}</h4>
                            {r.fecha === hoy && (
                              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-extrabold rounded-full shrink-0">
                                HOY
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                            {nombreCancha}
                          </span>
                        </div>

                        <select
                          value={r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago')}
                          onChange={e => cambiarEstadoPago(r.id, e.target.value)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer outline-none shrink-0 ${
                            r.estado_pago === 'pagado'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : r.estado_pago === 'señado'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          <option value="pagado">Pagado</option>
                          <option value="señado">Señado</option>
                          <option value="sin_pago">Sin Pago</option>
                        </select>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-xl flex items-center justify-between text-xs text-slate-700">
                        <span className="font-medium capitalize text-[11px] sm:text-xs truncate">
                          {formatearTurno(r.fecha, r.hora)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          {r.creado_por || (r.payment_id && String(r.payment_id).startsWith('manual_') ? 'Admin (Manual)' : 'Online')}
                        </span>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-50">
                        <button
                          onClick={() => setEditando(r)}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg text-xs font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarReserva(r.id)}
                          className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-xs font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ======================================================== */}
            {/* VISTA ESCRITORIO: TABLA PRINCIPAL DE RESERVAS (MD+)     */}
            {/* ======================================================== */}
            <div className="hidden md:block bg-white shadow-sm border border-slate-100 rounded-3xl overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Jugador</th>
                      <th className="px-6 py-4 text-center">Cancha</th>
                      <th className="px-6 py-4">Turno (Fecha y Hora)</th>
                      <th className="px-6 py-4 text-center">Estado de Pago</th>
                      <th className="px-6 py-4 text-center">Registrado Por</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                          Cargando reservas...
                        </td>
                      </tr>
                    ) : reservasPaginadas.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                          No se encontraron reservas con los filtros aplicados ({filterPeriodo.toUpperCase()}).
                        </td>
                      </tr>
                    ) : (
                      reservasPaginadas.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          
                          {/* NOMBRE */}
                          <td className="px-6 py-4">
                            {editando?.id === r.id ? (
                              <input
                                className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={editando.nombre}
                                onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                              />
                            ) : (
                              <div>
                                <span className="font-bold text-slate-800">{r.nombre}</span>
                                {r.fecha === hoy && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                                    HOY
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* CANCHA */}
                          <td className="px-6 py-4 text-center">
                            {editando?.id === r.id ? (
                              <select
                                className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                                value={editando.cancha}
                                onChange={e => setEditando({ ...editando, cancha: e.target.value })}
                              >
                                {canchas.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.nombre}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                {canchas.find(c => String(c.id) === String(r.cancha))?.nombre || `Cancha ${r.cancha}`}
                              </span>
                            )}
                          </td>

                          {/* TURNO */}
                          <td className="px-6 py-4 text-slate-600 capitalize">
                            {editando?.id === r.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  className="border border-slate-300 p-1.5 rounded-lg text-xs"
                                  value={editando.fecha}
                                  onChange={e => setEditando({ ...editando, fecha: e.target.value })}
                                />
                                <select
                                  className="border border-slate-300 p-1.5 rounded-lg text-xs"
                                  value={editando.hora}
                                  onChange={e => setEditando({ ...editando, hora: e.target.value })}
                                >
                                  {businessHorarios.map(h => <option key={h} value={h}>{h} hs</option>)}
                                </select>
                              </div>
                            ) : (
                              <span className="font-medium text-slate-700">
                                {formatearTurno(r.fecha, r.hora)}
                              </span>
                            )}
                          </td>

                          {/* ESTADO DE PAGO */}
                          <td className="px-6 py-4 text-center">
                            {editando?.id === r.id ? (
                              <select
                                className="border border-slate-300 p-2 rounded-lg text-xs font-bold"
                                value={editando.estado_pago}
                                onChange={e => setEditando({ ...editando, estado_pago: e.target.value })}
                              >
                                <option value="pagado">Pagado Total</option>
                                <option value="señado">Señado</option>
                                <option value="sin_pago">Sin Pago</option>
                              </select>
                            ) : (
                              <div className="inline-flex items-center">
                                <select
                                  value={r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago')}
                                  onChange={e => cambiarEstadoPago(r.id, e.target.value)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${
                                    r.estado_pago === 'pagado'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                      : r.estado_pago === 'señado'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                      : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                  }`}
                                >
                                  <option value="pagado">Pagado</option>
                                  <option value="señado">Señado</option>
                                  <option value="sin_pago">Sin Pago</option>
                                </select>
                              </div>
                            )}
                          </td>

                          {/* REGISTRADO POR */}
                          <td className="px-6 py-4 text-center">
                            {editando?.id === r.id ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                  {r.creado_por || (r.payment_id && String(r.payment_id).startsWith('manual_') ? 'Admin (Manual)' : 'Cliente (Online)')}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">(No editable)</span>
                              </div>
                            ) : (
                              r.payment_id && String(r.payment_id).startsWith('manual_') || (r.creado_por && !r.creado_por.includes('Online')) ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Reserva manual">
                                  <svg className="w-3.5 h-3.5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  {r.creado_por || 'Admin (Manual)'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Reserva online del cliente">
                                  <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                                  </svg>
                                  Cliente (Online)
                                </span>
                              )
                            )}
                          </td>

                          {/* ACCIONES */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {editando?.id === r.id ? (
                                <>
                                  <button
                                    onClick={guardarEdicion}
                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditando(null)}
                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditando(r)}
                                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => eliminarReserva(r.id)}
                                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2 w-full">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 text-xs sm:text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong>
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 text-xs sm:text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA: GESTIÓN DE CANCHAS Y DISPONIBILIDAD (ADMIN Y COLABORADOR) */}
        {/* ======================================================== */}
        {activeTab === 'canchas' && (
          <div className="max-w-4xl mx-auto space-y-5 animate-fade-in w-full">
            
            <div className="bg-white p-3.5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 w-full overflow-hidden">
              <div className="flex flex-wrap justify-between items-center gap-2.5 mb-3">
                <div>
                  <h2 className="text-lg sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                    Canchas y Disponibilidad
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                    Controlá qué canchas están visibles y disponibles para que los clientes reserven turnos online.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200">
                    Total: {canchas.length}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setCanchaError('')
                        setNuevaCanchaForm({
                          nombre: `Cancha ${canchas.length + 1}`,
                          password: '',
                          precio: config.precio_total || tenantPrecioTotal || ''
                        })
                        setModalNuevaCancha(true)
                      }}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      + Agregar Cancha
                    </button>
                  )}
                </div>
              </div>

              {/* AVISO DE ROLES Y PERMISOS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 text-xs text-slate-600 flex items-start gap-2">
                <div>
                  <p className="font-bold text-slate-700 mb-0.5">Gestión Operativa de Canchas</p>
                  <p>
                    Tanto colaboradores como administradores pueden <strong>activar o pausar</strong> la disponibilidad de cada cancha en cualquier momento.
                    {isAdmin ? ' Como administrador, podés agregar más canchas autorizando la operación con tu contraseña de administrador.' : ' Solo el administrador puede agregar nuevas canchas.'}
                  </p>
                </div>
              </div>

              {/* LISTA DE TARJETAS DE CANCHAS */}
              {canchas.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="font-semibold text-xs sm:text-sm">Cargando canchas del negocio...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
                  {canchas.map(c => {
                    const isActiva = c.activa !== false && c.disponible !== false
                    const isToggling = togglingCanchaId === c.id

                    return (
                      <div
                        key={c.id}
                        className={`p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between w-full min-w-0 ${
                          isActiva
                            ? 'bg-white border-emerald-200 shadow-sm shadow-emerald-50'
                            : 'bg-slate-50 border-slate-200 opacity-90'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black shrink-0 ${
                                isActiva ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {c.id}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-xs sm:text-base truncate">{c.nombre}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] sm:text-xs text-slate-400 font-mono">ID: {c.id}</span>
                                  <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    ${c.precio || config.precio_total || tenantPrecioTotal || 100} completa
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border ${
                                isActiva
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {isActiva ? 'Disponible' : 'Pausada'}
                              </span>

                              {isAdmin && canchas.length > 1 && (
                                <button
                                  type="button"
                                  title="Eliminar cancha"
                                  onClick={() => {
                                    setEliminarError('')
                                    setEliminarPassword('')
                                    setModalEliminarCancha(c)
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] sm:text-xs text-slate-500 mb-3">
                            {isActiva
                              ? 'Visible para clientes en la página web. Permite seleccionar y reservar turnos online.'
                              : 'Oculta para clientes. No aparecerá en el selector de turnos online hasta que se reactive.'}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => toggleDisponibilidadCancha(c.id, isActiva)}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 border ${
                            isActiva
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                          } disabled:opacity-50`}
                        >
                          {isToggling ? (
                            'Guardando...'
                          ) : isActiva ? (
                            'Pausar Cancha'
                          ) : (
                            'Habilitar Cancha'
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {/* MODAL: AGREGAR NUEVA CANCHA (SOLO ADMIN CON CONTRASEÑA) */}
            {modalNuevaCancha && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-black">
                        +
                      </span>
                      Agregar Nueva Cancha
                    </h3>
                    <button
                      onClick={() => setModalNuevaCancha(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">
                    Solo el administrador puede incorporar canchas al complejo ingresando su contraseña de acceso.
                  </p>

                  {canchaError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl mb-4">
                      {canchaError}
                    </div>
                  )}

                  <form onSubmit={handleAgregarCancha} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Nombre de la Cancha
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        value={nuevaCanchaForm.nombre}
                        onChange={e => setNuevaCanchaForm({ ...nuevaCanchaForm, nombre: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Precio de la Cancha Completa ($ ARS)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 sm:top-3 text-slate-400 font-bold text-xs sm:text-sm">$</span>
                        <input
                          type="number"
                          min="1"
                          className="w-full border border-slate-200 pl-7 pr-3 py-2.5 sm:py-3 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          value={nuevaCanchaForm.precio}
                          onChange={e => setNuevaCanchaForm({ ...nuevaCanchaForm, precio: e.target.value })}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Si se deja vacío, utilizará el precio general del negocio (${config.precio_total || tenantPrecioTotal || 100}).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Contraseña de Administrador
                      </label>
                      <input
                        type="password"
                        required
                        className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        value={nuevaCanchaForm.password}
                        onChange={e => setNuevaCanchaForm({ ...nuevaCanchaForm, password: e.target.value })}
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Requerida por seguridad para autorizar la creación.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={guardandoCancha}
                        onClick={() => setModalNuevaCancha(false)}
                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={guardandoCancha}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {guardandoCancha ? 'Guardando...' : 'Agregar Cancha'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: ELIMINAR CANCHA (SOLO ADMIN CON CONTRASEÑA) */}
            {modalEliminarCancha && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-black">
                        ✕
                      </span>
                      Eliminar {modalEliminarCancha.nombre}
                    </h3>
                    <button
                      onClick={() => setModalEliminarCancha(null)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">
                    ¿Estás seguro de que deseás eliminar esta cancha? Para confirmar esta acción ingresá tu contraseña de administrador.
                  </p>

                  {eliminarError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl mb-4">
                      {eliminarError}
                    </div>
                  )}

                  <form onSubmit={handleEliminarCancha} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Contraseña de Administrador
                      </label>
                      <input
                        type="password"
                        required
                        className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        value={eliminarPassword}
                        onChange={e => setEliminarPassword(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={eliminandoCancha}
                        onClick={() => setModalEliminarCancha(null)}
                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={eliminandoCancha}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {eliminandoCancha ? 'Eliminando...' : 'Eliminar Cancha'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: CONFIGURACIÓN DEL NEGOCIO (SOLO ADMIN)       */}
        {/* ======================================================== */}
        {activeTab === 'config' && isAdmin && (
          <div className="max-w-3xl mx-auto bg-white p-3.5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 animate-fade-in w-full overflow-hidden">
            
            <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-1 flex items-center gap-2">
              Configuración de {config.nombre || nombreNegocio}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mb-5">
              Ajustá datos de contacto, valor de la seña y los horarios de atención y turnos disponibles para tu complejo.
            </p>

            {configSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl mb-5 text-xs sm:text-sm font-semibold animate-fade-in">
                Configuración guardada correctamente.
              </div>
            )}

            <form onSubmit={guardarConfig} className="space-y-4 sm:space-y-6 w-full">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nombre de la Cancha / Complejo
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium text-xs sm:text-base"
                  value={config.nombre || ''}
                  onChange={e => setConfig({ ...config, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Teléfono / WhatsApp de Contacto
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium text-xs sm:text-base"
                    value={config.telefono || ''}
                    onChange={e => setConfig({ ...config, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Ubicación / Dirección del Complejo
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium text-xs sm:text-base"
                    value={config.direccion || ''}
                    onChange={e => setConfig({ ...config, direccion: e.target.value })}
                  />
                </div>
              </div>

              {/* SECCIÓN: CONFIGURACIÓN DE HORARIOS DE ATENCIÓN */}
              <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 w-full overflow-hidden">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Horarios de Atención / Turnos Disponibles
                    </label>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      Marcá qué horas están disponibles para reservar en tus canchas.
                    </p>
                  </div>

                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {(config.horarios || []).length} activos
                  </span>
                </div>

                {/* PRESETS RÁPIDOS */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => aplicarPresetHorarios('tarde_noche')}
                    className="bg-white hover:bg-blue-50 text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Tarde/Noche
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetHorarios('completo')}
                    className="bg-white hover:bg-blue-50 text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetHorarios('nocturno')}
                    className="bg-white hover:bg-blue-50 text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Nocturno
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetHorarios('matutino_tarde')}
                    className="bg-white hover:bg-blue-50 text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    Día
                  </button>
                </div>

                {/* CHIPS DE HORARIOS ACTIVOS */}
                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2 w-full">
                  {ALL_POSSIBLE_HOURS.map(hora => {
                    const isSelected = (config.horarios || []).includes(hora)
                    return (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => toggleHorarioSlot(hora)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-0.5 active:scale-95 min-h-[36px] w-full truncate ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-1 ring-blue-400'
                            : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{hora}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Precio de la Cancha Completa ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 sm:top-3 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full border border-slate-200 pl-7 pr-3 py-2.5 sm:py-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-bold text-xs sm:text-base"
                      value={config.precio_total || ''}
                      onChange={e => setConfig({ ...config, precio_total: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Valor total del alquiler de la cancha por turno.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Monto de la Seña por Reserva ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 sm:top-3 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full border border-slate-200 pl-7 pr-3 py-2.5 sm:py-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-bold text-xs sm:text-base"
                      value={config.monto_sena || ''}
                      onChange={e => setConfig({ ...config, monto_sena: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Monto que abona el cliente para asegurar y reservar el turno online.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Access Token de Mercado Pago (Privado)
                </label>
                <input
                  type="password"
                  className="w-full border border-slate-200 p-2.5 sm:p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-mono text-xs"
                  value={config.mp_access_token || ''}
                  onChange={e => setConfig({ ...config, mp_access_token: e.target.value })}
                />
              </div>

              {configSaved && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-center text-xs sm:text-sm font-bold animate-fade-in flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ¡Cambios guardados correctamente!
                </div>
              )}

              <button
                type="submit"
                disabled={savingConfig}
                className={`w-full py-3 active:scale-95 text-white font-bold rounded-xl transition-all shadow-sm text-xs sm:text-base flex items-center justify-center gap-2 ${
                  configSaved 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {savingConfig ? (
                  'Guardando cambios...'
                ) : configSaved ? (
                  '✓ ¡Cambios Guardados!'
                ) : (
                  'Guardar Configuración y Horarios'
                )}
              </button>

            </form>

          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 3: GESTIÓN DE COLABORADORES (SOLO ADMIN)        */}
        {/* ======================================================== */}
        {activeTab === 'colaboradores' && isAdmin && (
          <div className="max-w-4xl mx-auto space-y-5 animate-fade-in w-full">
            
            {/* AGREGAR COLABORADOR */}
            <div className="bg-white p-3.5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 w-full overflow-hidden">
              <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-1 flex items-center gap-2">
                + Agregar Nuevo Colaborador
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mb-4">
                Los colaboradores pueden ver turnos, crear reservas manuales y cambiar estados de pago.
              </p>

              {colabMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl mb-4 text-xs sm:text-sm font-semibold">
                  {colabMsg}
                </div>
              )}

              <form onSubmit={crearColaborador} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end w-full">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.nombre}
                    onChange={e => setNuevoColab({ ...nuevoColab, nombre: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario / Email</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.email}
                    onChange={e => setNuevoColab({ ...nuevoColab, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                  <input
                    type="password"
                    className="w-full border border-slate-200 p-2 rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.password}
                    onChange={e => setNuevoColab({ ...nuevoColab, password: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-sm"
                  >
                    Crear Colaborador
                  </button>
                </div>
              </form>
            </div>

            {/* LISTADO DE COLABORADORES */}
            <div className="bg-white p-3.5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 w-full overflow-hidden">
              <h3 className="text-base sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">
                Equipo de Trabajo ({colaboradores.length})
              </h3>

              {colaboradores.length === 0 ? (
                <p className="text-slate-400 text-xs sm:text-sm italic">
                  Aún no has agregado colaboradores a tu equipo.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {colaboradores.map(c => (
                    <div key={c.id} className="py-3 flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">{c.nombre}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.email} • <span className="capitalize text-purple-600 font-semibold">{c.rol}</span></p>
                      </div>

                      {c.rol !== 'admin' && (
                        <button
                          onClick={() => eliminarColaborador(c.id)}
                          className="text-[11px] text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg font-semibold transition-colors border border-rose-100 shrink-0"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  )
}