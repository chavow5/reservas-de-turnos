import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from './middleware/auth.js'
import { requireAdmin, requireColaboradorOrAdmin } from './middleware/roles.js'

const app = express()

// ============================
// CORS
// ============================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://reservas-de-turnos.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean)

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.use(express.json())

console.log('⚡ Servidor de Reservas Activo ⚡')

// ============================
// CLIENTES EXTERNOS
// ============================
const SUPABASE_FALLBACK_URL = 'https://bizozpwupwcaspgghjgp.supabase.co'
const SUPABASE_FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpem96cHd1cHdjYXNwZ2doamdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg3MDMwOSwiZXhwIjoyMDgyNDQ2MzA5fQ.mhqqc32nYlVCof4CbDWfCVJM_AcaE7Mm6w64gAk_N5g'

const supabase = createClient(
  process.env.SUPABASE_URL || SUPABASE_FALLBACK_URL,
  process.env.SUPABASE_SERVICE_ROLE || SUPABASE_FALLBACK_KEY
)

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'
const DEFAULT_MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

// Helper para normalizar estructura de canchas
export const normalizarCanchas = (raw) => {
  if (!raw) {
    return [
      { id: '1', nombre: 'Cancha 1', activa: true },
      { id: '2', nombre: 'Cancha 2', activa: true }
    ]
  }

  if (typeof raw === 'number') {
    const total = Math.max(1, Math.min(raw, 50))
    return Array.from({ length: total }, (_, i) => ({
      id: String(i + 1),
      nombre: `Cancha ${i + 1}`,
      activa: true
    }))
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return [{ id: '1', nombre: 'Cancha 1', activa: true }]
    }
    return raw.map((item, index) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const str = String(item).trim()
        const nombre = str.toLowerCase().startsWith('cancha') ? str : `Cancha ${str}`
        return {
          id: str,
          nombre,
          activa: true
        }
      }
      if (typeof item === 'object' && item !== null) {
        const id = String(item.id || item.numero || index + 1).trim()
        const nombre = item.nombre ? String(item.nombre).trim() : (id.toLowerCase().startsWith('cancha') ? id : `Cancha ${id}`)
        const precio = (item.precio !== undefined && item.precio !== null && !isNaN(Number(item.precio)) && Number(item.precio) > 0)
          ? Number(item.precio)
          : undefined
        return {
          id,
          nombre,
          activa: item.activa !== false && item.disponible !== false,
          ...(precio !== undefined ? { precio } : {})
        }
      }
      return { id: String(index + 1), nombre: `Cancha ${index + 1}`, activa: true }
    })
  }

  return [
    { id: '1', nombre: 'Cancha 1', activa: true },
    { id: '2', nombre: 'Cancha 2', activa: true }
  ]
}

// Helper para normalizar estructura de horarios disponibles
export const normalizarHorarios = (raw) => {
  const DEFAULT_HORARIOS = [
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00'
  ]

  if (!raw) return DEFAULT_HORARIOS

  if (Array.isArray(raw)) {
    if (raw.length === 0) return DEFAULT_HORARIOS
    const valid = raw
      .map(h => String(h).trim())
      .filter(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))

    if (valid.length === 0) return DEFAULT_HORARIOS
    return Array.from(new Set(valid))
  }

  return DEFAULT_HORARIOS
}

// Persistencia local resiliente de canchas y horarios
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const EXTRAS_FILE = path.join(DATA_DIR, 'business_extras.json')

export const getBusinessExtras = () => {
  try {
    if (fs.existsSync(EXTRAS_FILE)) {
      const raw = fs.readFileSync(EXTRAS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return {
        canchas: normalizarCanchas(parsed.canchas),
        horarios: normalizarHorarios(parsed.horarios)
      }
    }
  } catch (err) {
    console.warn('Aviso leyendo business_extras.json:', err.message)
  }
  return {
    canchas: normalizarCanchas(null),
    horarios: normalizarHorarios(null)
  }
}

export const saveBusinessExtras = (data) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    const current = getBusinessExtras()
    const updated = {
      canchas: data.canchas !== undefined ? normalizarCanchas(data.canchas) : current.canchas,
      horarios: data.horarios !== undefined ? normalizarHorarios(data.horarios) : current.horarios
    }
    fs.writeFileSync(EXTRAS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  } catch (err) {
    console.warn('Aviso guardando business_extras.json:', err.message)
    return {
      canchas: normalizarCanchas(data.canchas),
      horarios: normalizarHorarios(data.horarios)
    }
  }
}

// Helper para instanciar cliente de Mercado Pago
const getMPClient = (customAccessToken) => {
  const token = customAccessToken || DEFAULT_MP_ACCESS_TOKEN
  return new MercadoPagoConfig({ accessToken: token })
}

// ============================
// GESTIÓN DE HOLDS (BLOQUEO TEMPORAL DE 3 MINUTOS)
// ============================
export const HOLD_EXPIRY_MS = 3 * 60 * 1000 // 3 minutos

export const limpiarHoldsExpirados = async () => {
  try {
    const ahora = Date.now()
    const { data: holds, error } = await supabase
      .from('reservas')
      .select('id, payment_id, created_at')
      .ilike('payment_id', 'hold_%')
      .eq('pagado', false)

    if (error) {
      console.warn('Aviso consultando holds para limpieza:', error.message)
      return
    }

    if (holds && holds.length > 0) {
      const idsAEliminar = []
      for (const h of holds) {
        const parts = String(h.payment_id || '').split('_')
        const expiracion = Number(parts[1])
        if (expiracion && ahora > expiracion) {
          idsAEliminar.push(h.id)
        } else if (!expiracion && h.created_at) {
          const diffMs = ahora - new Date(h.created_at).getTime()
          if (diffMs > HOLD_EXPIRY_MS) {
            idsAEliminar.push(h.id)
          }
        }
      }

      if (idsAEliminar.length > 0) {
        const { error: delError } = await supabase.from('reservas').delete().in('id', idsAEliminar)
        if (!delError) {
          console.log(`🧹 ${idsAEliminar.length} holds de reserva expirados fueron liberados`)
        }
      }
    }
  } catch (err) {
    console.warn('Error en limpiarHoldsExpirados:', err.message)
  }
}

const holdCleanupTimer = setInterval(limpiarHoldsExpirados, 30 * 1000)
if (holdCleanupTimer.unref) holdCleanupTimer.unref()

// ============================
// KEEP-ALIVE — Supabase (cada 4 días)
// ============================
const CUATRO_DIAS_MS = 4 * 24 * 60 * 60 * 1000

const keepAliveTimer = setInterval(async () => {
  try {
    const { error } = await supabase.from('reservas').select('id').limit(1)
    if (error) console.error('⚠️ Keep-alive Supabase error:', error.message)
    else console.log('✅ Supabase keep-alive OK —', new Date().toISOString())
  } catch (e) {
    console.error('⚠️ Keep-alive excepción:', e.message)
  }
}, CUATRO_DIAS_MS)
if (keepAliveTimer.unref) keepAliveTimer.unref()

// ============================
// HEALTH CHECK DE BASE DE DATOS
// ============================
app.get(['/api/health/db', '/health/db'], async (req, res) => {
  const startTime = Date.now()
  const TIMEOUT_MS = 5000

  try {
    const queryPromise = supabase.from('reservas').select('id').limit(1)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: La base de datos tardó más de 5s')), TIMEOUT_MS)
    )

    const result = await Promise.race([queryPromise, timeoutPromise])
    const tiempoMs = Date.now() - startTime

    if (result.error && !result.error.message.includes('schema cache')) {
      return res.status(503).json({
        activa: false,
        tiempoMs,
        error: result.error.message
      })
    }

    res.json({
      activa: true,
      tiempoMs,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    const tiempoMs = Date.now() - startTime
    console.warn('⚠️ /health/db falló o timed out:', e.message)
    res.status(503).json({
      activa: false,
      tiempoMs,
      error: e.message
    })
  }
})

app.get(['/api/health', '/health'], async (req, res) => {
  try {
    const { error } = await supabase.from('reservas').select('id').limit(1)
    if (error) return res.status(500).json({ status: 'error', db: error.message })
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message })
  }
})

// ============================
// CACHÉ EN MEMORIA PARA CONFIG
// ============================
let cachedConfig = null
let cachedConfigExpiry = 0
const CONFIG_CACHE_TTL_MS = 60 * 1000 // 60 segundos de caché

export const invalidateConfigCache = () => {
  cachedConfig = null
  cachedConfigExpiry = 0
}

// ============================
// ENDPOINTS PÚBLICOS DEL NEGOCIO
// ============================

// Obtener configuración pública del negocio (Ultra rápido: < 5ms con caché)
app.get(['/api/config', '/config'], async (req, res) => {
  try {
    const now = Date.now()
    if (cachedConfig && now < cachedConfigExpiry) {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
      return res.json(cachedConfig)
    }

    let negocio = null
    const selectColsBasic = 'id, nombre, telefono, direccion, plan, activo, monto_sena, precio_total, mp_access_token'
    const selectColsWithExtras = `${selectColsBasic}, canchas, horarios`

    let resSup = await supabase
      .from('negocios')
      .select(selectColsWithExtras)
      .limit(1)
      .maybeSingle()

    if (resSup.error) {
      resSup = await supabase
        .from('negocios')
        .select(selectColsBasic)
        .limit(1)
        .maybeSingle()
    }
    negocio = resSup?.data

    const extras = getBusinessExtras()

    if (!negocio) {
      negocio = {
        id: '1',
        nombre: 'Cancha Fútbol',
        telefono: '3804201334',
        direccion: 'Av. San Martín 1234',
        activo: true,
        monto_sena: 100,
        precio_total: 100
      }
    }

    const canchasFinales = (negocio?.canchas && Array.isArray(negocio.canchas) && negocio.canchas.length > 0)
      ? normalizarCanchas(negocio.canchas)
      : extras.canchas

    const horariosFinales = (negocio?.horarios && Array.isArray(negocio.horarios) && negocio.horarios.length > 0)
      ? normalizarHorarios(negocio.horarios)
      : extras.horarios

    const responsePayload = {
      ...negocio,
      telefono: negocio.telefono || '3804201334',
      direccion: negocio.direccion || '',
      canchas: canchasFinales,
      horarios: horariosFinales
    }

    cachedConfig = responsePayload
    cachedConfigExpiry = now + CONFIG_CACHE_TTL_MS

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
    res.json(responsePayload)
  } catch (err) {
    console.error('Error obteniendo /api/config:', err)
    res.status(500).json({ error: 'Error del servidor al obtener configuración' })
  }
})

// Obtener turnos ocupados públicos para el calendario
app.get(['/api/turnos-ocupados', '/turnos-ocupados'], async (req, res) => {
  const { desde, hasta } = req.query

  try {
    await limpiarHoldsExpirados()

    let query = supabase
      .from('reservas')
      .select('fecha, hora, cancha, estado_pago, pagado, payment_id')

    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar turnos ocupados:', error)
      return res.status(500).json({ error: error.message })
    }

    const ahora = Date.now()
    const ocupados = (data || [])
      .filter(r => {
        // Filtrar holds que ya hayan superado su timestamp de expiración
        if (String(r.payment_id || '').startsWith('hold_') && !r.pagado) {
          const parts = String(r.payment_id).split('_')
          const exp = Number(parts[1])
          if (exp && ahora > exp) return false
        }
        return true
      })
      .map(r => ({
        fecha: r.fecha,
        hora: r.hora,
        cancha: r.cancha,
        estado_pago: r.estado_pago,
        pagado: r.pagado,
        en_proceso: String(r.payment_id || '').startsWith('hold_') && !r.pagado
      }))

    res.json(ocupados)
  } catch (err) {
    console.error('Error en /api/turnos-ocupados:', err)
    res.status(500).json({ error: 'Error al consultar disponibilidad' })
  }
})

// ============================
// MERCADO PAGO: CREATE PREFERENCE
// ============================
app.post(['/api/create-preference', '/create-preference'], async (req, res) => {
  let holdRowId = null
  try {
    const { nombre, fecha, hora, cancha } = req.body
    const canchaFinal = cancha || '1'

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    // Limpiar holds expirados previamente
    await limpiarHoldsExpirados()

    // Buscar configuración del negocio
    let mpAccessToken = DEFAULT_MP_ACCESS_TOKEN
    let montoSena = 100
    let nombreNegocio = 'Reserva Cancha'

    const { data: neg } = await supabase
      .from('negocios')
      .select('id, nombre, mp_access_token, monto_sena, activo')
      .limit(1)
      .maybeSingle()

    if (neg) {
      if (!neg.activo) return res.status(403).json({ error: 'El negocio se encuentra suspendido o inactivo' })
      nombreNegocio = neg.nombre || nombreNegocio
      if (neg.mp_access_token) mpAccessToken = neg.mp_access_token
      if (neg.monto_sena) montoSena = Number(neg.monto_sena)
    }

    if (!mpAccessToken) {
      return res.status(400).json({
        error: `El negocio aún no ha configurado sus credenciales de Mercado Pago. Configúrelas en el panel de administración.`
      })
    }

    // Verificar disponibilidad exacta
    const { data: existingSlots } = await supabase
      .from('reservas')
      .select('id, pagado, estado_pago, payment_id, created_at')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)

    if (existingSlots && existingSlots.length > 0) {
      // 1. ¿Está ocupado por reserva ya confirmada?
      const slotConfirmado = existingSlots.find(s =>
        s.pagado === true ||
        ['pagado', 'señado'].includes(s.estado_pago) ||
        !String(s.payment_id || '').startsWith('hold_')
      )
      if (slotConfirmado) {
        return res.status(400).json({ error: 'El turno ya se encuentra reservado.' })
      }

      // 2. ¿Hay un hold activo?
      const holdActivo = existingSlots.find(s => String(s.payment_id || '').startsWith('hold_') && !s.pagado)
      if (holdActivo) {
        const parts = String(holdActivo.payment_id).split('_')
        const expTime = Number(parts[1])
        if (expTime && Date.now() < expTime) {
          const minutosRestantes = Math.max(1, Math.ceil((expTime - Date.now()) / 60000))
          return res.status(400).json({
            error: `El turno está siendo reservado y abonado por otro jugador en este momento. Si no completa el pago, se liberará en aprox. ${minutosRestantes} minutos.`
          })
        }
      }
    }

    const externalReference = `RES-${Date.now()}`
    const expiryTimestamp = Date.now() + HOLD_EXPIRY_MS // 3 minutos
    const holdPaymentId = `hold_${expiryTimestamp}_${externalReference}`

    // Bloquear temporalmente el turno en base de datos (HOLD)
    const { data: insertedHold, error: holdError } = await supabase
      .from('reservas')
      .insert([{
        nombre: `[En proceso de pago] ${nombre}`,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: false,
        estado_pago: 'sin_pago',
        payment_id: holdPaymentId,
        monto_pagado: 0
      }])
      .select()

    if (holdError || !insertedHold?.[0]) {
      console.error('❌ Error creando hold de reserva:', holdError)
      return res.status(500).json({ error: 'No se pudo reservar temporalmente el turno.' })
    }

    holdRowId = insertedHold[0].id

    // Doble verificación de concurrencia: si dos personas insertaron a la vez, sobrevive la primera
    const { data: concurrencyCheck } = await supabase
      .from('reservas')
      .select('id, created_at')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .order('created_at', { ascending: true })

    if (concurrencyCheck && concurrencyCheck.length > 1) {
      if (concurrencyCheck[0].id !== holdRowId) {
        await supabase.from('reservas').delete().eq('id', holdRowId)
        return res.status(400).json({
          error: 'El turno acaba de ser tomado por otro usuario hace un instante. Por favor elija otro turno.'
        })
      }
    }

    const client = getMPClient(mpAccessToken)
    const preference = new Preference(client)

    // Determinar la URL base de retorno (Mercado Pago requiere estrictamente HTTPS para activar auto_return)
    let baseUrl = 'https://reservas-de-turnos.vercel.app'
    let isLocalOrigin = false
    let localPort = '5173'

    const clientOrigin = req.headers.origin || req.headers.referer
    if (clientOrigin) {
      try {
        const parsed = new URL(clientOrigin)
        if (parsed.protocol === 'https:') {
          baseUrl = parsed.origin
        } else if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          isLocalOrigin = true
          localPort = parsed.port || '5173'
        }
      } catch {}
    }

    if (!baseUrl.startsWith('https://') && process.env.FRONTEND_URL && process.env.FRONTEND_URL.startsWith('https://')) {
      baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '')
    }

    const localRedirectParam = isLocalOrigin ? `&local_redirect=${localPort}` : ''
    const successUrl = `${baseUrl}/success?nombre=${encodeURIComponent(nombre)}&fecha=${fecha}&hora=${hora}&cancha=${canchaFinal}&external_reference=${externalReference}${localRedirectParam}`

    let notificationUrl = process.env.WEBHOOK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/webhook` : 'https://reservas-de-turnos.onrender.com/webhook')
    if (!notificationUrl.startsWith('https://')) {
      notificationUrl = 'https://reservas-de-turnos.vercel.app/api/webhook'
    }

    const preferenceBody = {
      external_reference: externalReference,
      items: [
        {
          title: `Seña Cancha ${canchaFinal} ${hora}hs - ${nombreNegocio}`,
          description: `Seña de reserva cancha ${canchaFinal} el ${fecha} a las ${hora} hs`,
          category_id: 'sports',
          quantity: 1,
          unit_price: montoSena,
          currency_id: 'ARS'
        }
      ],
      binary_mode: true,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(expiryTimestamp).toISOString(),
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
        installments: 1
      },
      statement_descriptor: 'Reserva Cancha',
      metadata: {
        nombre,
        cancha: canchaFinal,
        fecha,
        hora,
        monto_sena: montoSena,
        external_reference: externalReference,
        hold_id: holdRowId
      },
      back_urls: {
        success: successUrl,
        failure: `${baseUrl}`,
        pending: `${baseUrl}`
      },
      auto_return: 'approved',
      notification_url: notificationUrl
    }

    const response = await preference.create({ body: preferenceBody })

    console.log('✅ Preference creada y turno bloqueado por 3 min — Ref:', externalReference)
    res.json({
      init_point: response.init_point,
      external_reference: externalReference
    })
  } catch (error) {
    console.error('❌ Error create-preference:', error)
    if (holdRowId) {
      await supabase.from('reservas').delete().eq('id', holdRowId)
    }
    const errorMsg = error?.message || error?.cause?.description || 'Error al procesar la reserva'
    res.status(500).json({ error: errorMsg, message: errorMsg })
  }
})

// ============================
// MERCADO PAGO: WEBHOOK
// ============================
const verifyMPSignature = (req) => {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true

  const signatureHeader = req.headers['x-signature']
  const requestId = req.headers['x-request-id']
  if (!signatureHeader || !requestId) return false

  const parts = signatureHeader.split(',')
  let ts = ''
  let v1 = ''
  for (const part of parts) {
    const [key, val] = part.trim().split('=')
    if (key === 'ts') ts = val
    if (key === 'v1') v1 = val
  }

  const dataId = req.body?.data?.id
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return expected === v1
}

app.post(['/api/webhook', '/webhook'], async (req, res) => {
  try {
    console.log('📩 Webhook recibido:', req.body)

    if (!verifyMPSignature(req)) {
      console.warn('⚠️ Firma de webhook inválida')
      return res.sendStatus(401)
    }

    if (req.body.type !== 'payment') {
      return res.sendStatus(200)
    }

    const paymentId = req.body.data?.id
    if (!paymentId) return res.sendStatus(200)

    let mpPayment = null
    try {
      const defaultClient = getMPClient(DEFAULT_MP_ACCESS_TOKEN)
      const payment = new Payment(defaultClient)
      mpPayment = await payment.get({ id: paymentId })
    } catch (mpErr) {
      console.warn('⚠️ No se pudo consultar payment.get en MP:', mpErr.message)
    }

    if (!mpPayment) {
      return res.sendStatus(200)
    }

    console.log('💰 Estado del pago:', mpPayment.status)
    if (mpPayment.status !== 'approved') {
      return res.sendStatus(200)
    }

    const { nombre, fecha, hora, cancha, monto_sena, external_reference, hold_id } = mpPayment.metadata || {}
    const canchaFinal = cancha || '1'
    const externalRef = external_reference || mpPayment.external_reference

    // Verificar si ya existe por payment_id
    const { data: existingByPid } = await supabase
      .from('reservas')
      .select('id')
      .eq('payment_id', String(paymentId))
      .limit(1)

    if (existingByPid && existingByPid.length > 0) {
      console.log('⚠️ Reserva ya existía por payment_id en webhook:', paymentId)
      return res.sendStatus(200)
    }

    // Buscar si hay hold o reserva existente para ese slot
    const { data: existingSlots } = await supabase
      .from('reservas')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)

    // 1. Buscar si hay un HOLD correspondiente a esta operación
    const holdSlot = existingSlots?.find(s =>
      String(s.payment_id || '').startsWith('hold_') &&
      (!externalRef || String(s.payment_id).includes(externalRef))
    ) || (hold_id ? existingSlots?.find(s => s.id === hold_id) : null)

    if (holdSlot) {
      const { error: updateErr } = await supabase
        .from('reservas')
        .update({
          nombre: nombre || holdSlot.nombre.replace(/^\[En proceso de pago\]\s*/, ''),
          pagado: true,
          estado_pago: 'señado',
          monto_pagado: monto_sena || mpPayment.transaction_amount || 100,
          payment_id: String(paymentId)
        })
        .eq('id', holdSlot.id)

      if (updateErr) {
        console.error('Error actualizando hold en webhook:', updateErr)
      } else {
        console.log('✅ Hold convertido a reserva confirmada en webhook:', paymentId)
      }
      return res.sendStatus(200)
    }

    // 2. Si ya está ocupado por otra persona con otro pago confirmado -> CONFLICTO DE DOBLE RESERVA
    const confirmedSlot = existingSlots?.find(s =>
      s.pagado === true &&
      !String(s.payment_id || '').startsWith('hold_') &&
      s.payment_id !== String(paymentId)
    )

    if (confirmedSlot) {
      console.error('🚨 ALERTA: Doble reserva detectada en webhook. Ya existía reserva:', confirmedSlot.id, 'Nuevo pago:', paymentId)
      await supabase.from('reservas').insert([{
        nombre: `[CONFLICTO PAGO DUPLICADO] ${nombre}`,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: true,
        estado_pago: 'señado',
        monto_pagado: monto_sena || mpPayment.transaction_amount || 100,
        payment_id: `conflict_${paymentId}`
      }])
      return res.sendStatus(200)
    }

    // 3. Si no existía hold ni reserva confirmada, insertar normal
    const { error: insertError } = await supabase
      .from('reservas')
      .insert([
        {
          nombre,
          fecha,
          hora,
          cancha: canchaFinal,
          pagado: true,
          estado_pago: 'señado',
          monto_pagado: monto_sena || mpPayment.transaction_amount || 100,
          payment_id: String(paymentId)
        }
      ])

    if (insertError) {
      console.error('Error insertando reserva desde webhook:', insertError)
    } else {
      console.log('✅ Reserva creada por webhook con éxito')
    }
    res.sendStatus(200)
  } catch (error) {
    console.error('Webhook error:', error)
    res.sendStatus(200)
  }
})

// ============================
// MERCADO PAGO: CONFIRMAR PAGO (FALLBACK FRONTEND)
// ============================
app.post(['/api/confirmar-pago', '/confirmar-pago'], async (req, res) => {
  try {
    const {
      payment_id,
      collection_id,
      status,
      collection_status,
      nombre,
      fecha,
      hora,
      cancha,
      external_reference
    } = req.body

    const pid = String(payment_id || collection_id || '').trim()
    const finalStatus = status || collection_status

    if (finalStatus !== 'approved') {
      return res.status(400).json({ error: 'El pago no figura como aprobado.' })
    }

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Faltan datos obligatorios de la reserva (nombre, fecha, hora).' })
    }

    const canchaFinal = String(cancha || '1')

    // 1. Idempotencia: Verificar si ya existe reserva confirmada por payment_id
    if (pid) {
      const { data: existingByPid } = await supabase
        .from('reservas')
        .select('*')
        .eq('payment_id', pid)
        .limit(1)

      if (existingByPid && existingByPid.length > 0) {
        console.log('✅ Pago ya registrado previamente (idempotente):', pid)
        return res.json({ ok: true, ya_registrada: true, reserva: existingByPid[0] })
      }
    }

    // Obtener monto_sena
    let montoSena = 100
    try {
      const { data: neg } = await supabase
        .from('negocios')
        .select('monto_sena')
        .limit(1)
        .maybeSingle()
      if (neg && typeof neg.monto_sena === 'number') {
        montoSena = neg.monto_sena
      }
    } catch (e) {
      console.warn('No se pudo obtener monto_sena:', e.message)
    }

    // 2. Buscar si hay slots existentes en esa fecha/hora/cancha
    const { data: existingSlots } = await supabase
      .from('reservas')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)

    // Buscar si hay un HOLD correspondiente a esta operación
    const holdSlot = existingSlots?.find(s =>
      String(s.payment_id || '').startsWith('hold_') &&
      (!external_reference || String(s.payment_id).includes(external_reference))
    )

    if (holdSlot) {
      const { data: updated, error: updErr } = await supabase
        .from('reservas')
        .update({
          nombre: String(nombre).trim(),
          pagado: true,
          estado_pago: 'señado',
          monto_pagado: montoSena,
          payment_id: pid || `mp_${Date.now()}`
        })
        .eq('id', holdSlot.id)
        .select()

      if (!updErr && updated?.[0]) {
        console.log('🎉 Hold convertido a reserva confirmada vía confirmar-pago:', updated[0].id)
        return res.json({ ok: true, reserva: updated[0] })
      }
    }

    // Verificar si ya está ocupado por OTRA persona con OTRO pago confirmado
    const slotOcupadoPorOtro = existingSlots?.find(s =>
      s.pagado === true &&
      s.payment_id !== pid &&
      !String(s.payment_id || '').startsWith('hold_')
    )

    if (slotOcupadoPorOtro) {
      console.error('🚨 CONFLICTO DOBLE RESERVA en confirmar-pago:', {
        nuevoPid: pid,
        ocupadoPorPid: slotOcupadoPorOtro.payment_id,
        nombreNuevo: nombre,
        nombreExistente: slotOcupadoPorOtro.nombre,
        slot: `${fecha} ${hora} C${canchaFinal}`
      })

      // Registrar el pago duplicado para que el administrador lo vea inmediatamente en su panel
      await supabase.from('reservas').insert([{
        nombre: `[CONFLICTO PAGO DUPLICADO] ${nombre}`,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: true,
        estado_pago: 'señado',
        monto_pagado: montoSena,
        payment_id: `conflict_${pid}`
      }])

      return res.status(409).json({
        ok: false,
        conflicto: true,
        error: 'TURNO_DUPLICADO',
        message: 'El turno ya fue asignado a otro jugador simultáneamente.',
        payment_id: pid,
        nombre,
        fecha,
        hora,
        cancha: canchaFinal
      })
    }

    // 3. Si no existía ni hold ni reserva previa, insertar nueva reserva
    const nuevaReserva = {
      nombre: String(nombre).trim(),
      fecha,
      hora,
      cancha: canchaFinal,
      pagado: true,
      estado_pago: 'señado',
      monto_pagado: montoSena,
      payment_id: pid || `mp_${Date.now()}`
    }

    let { data: inserted, error: insertError } = await supabase
      .from('reservas')
      .insert([nuevaReserva])
      .select()

    if (insertError) {
      console.error('❌ Error final al guardar reserva confirmada:', insertError)
      return res.status(500).json({ error: 'Error guardando reserva: ' + insertError.message })
    }

    console.log('🎉 Reserva online Mercado Pago confirmada y guardada con éxito:', inserted?.[0]?.id)
    return res.json({ ok: true, reserva: inserted?.[0] })
  } catch (error) {
    console.error('❌ Error en /api/confirmar-pago:', error)
    return res.status(500).json({ error: error.message || 'Error confirmando el pago' })
  }
})

// ============================
// AUTENTICACIÓN ADMIN / COLABORADOR
// ============================
app.post(['/api/admin/login', '/admin/login'], async (req, res) => {
  const { email, password } = req.body
  const ADMIN_PASSWORD_GLOBAL = process.env.ADMIN_PASSWORD || 'admin123'

  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida' })
  }

  try {
    // 1. Buscar usuario en tabla usuarios
    if (email) {
      const { data: usuario, error: userErr } = await supabase
        .from('usuarios')
        .select('id, email, password, nombre, rol, activo')
        .eq('email', email)
        .single()

      if (!userErr && usuario) {
        if (!usuario.activo) {
          return res.status(403).json({ error: 'Usuario inactivo o suspendido' })
        }

        if (usuario.password === password) {
          const token = jwt.sign(
            {
              usuario_id: usuario.id,
              rol: usuario.rol,
              nombre: usuario.nombre,
              email: usuario.email
            },
            JWT_SECRET,
            { expiresIn: '8h' }
          )

          return res.json({
            token,
            user: {
              id: usuario.id,
              nombre: usuario.nombre,
              email: usuario.email,
              rol: usuario.rol
            }
          })
        }
      }
    }

    // 2. Fallback con contraseña maestra
    if (password === ADMIN_PASSWORD_GLOBAL) {
      const userRol = 'admin'
      const userNombre = 'Admin Principal'
      const userEmail = email || 'admin@reservas.com'

      const token = jwt.sign(
        {
          usuario_id: 'admin-principal',
          rol: userRol,
          nombre: userNombre,
          email: userEmail
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      )

      return res.json({
        token,
        user: {
          id: 'admin-principal',
          nombre: userNombre,
          email: userEmail,
          rol: userRol
        }
      })
    }

    return res.status(401).json({ error: 'Credenciales incorrectas' })
  } catch (err) {
    console.error('Error en login admin:', err)
    res.status(500).json({ error: 'Error del servidor en inicio de sesión' })
  }
})

// ============================
// ADMIN / COLABORADOR: GESTIÓN DE RESERVAS
// ============================

// GET — Todas las reservas
app.get(['/api/admin/reservas', '/admin/reservas'], verifyAuth, async (req, res) => {
  try {
    await limpiarHoldsExpirados()

    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: true })

    if (error) {
      console.error('Error obteniendo reservas:', error)
      return res.status(500).json({ error: error.message })
    }

    const enriched = (data || [])
      .filter(r => {
        // Excluir holds temporales que aún no se hayan abonado
        if (String(r.payment_id || '').startsWith('hold_') && !r.pagado) {
          return false
        }
        return true
      })
      .map(r => {
        let creadoPor = r.creado_por
        if (!creadoPor) {
          if (String(r.payment_id || '').startsWith('conflict_')) {
            creadoPor = '⚠️ CONFLICTO DUPLICADO (Mercado Pago)'
          } else if (r.payment_id && String(r.payment_id).startsWith('manual_')) {
            const match = String(r.payment_id).match(/^manual_\d+_by_(.+)$/)
            if (match && match[1]) {
              try {
                creadoPor = decodeURIComponent(match[1])
              } catch {
                creadoPor = match[1]
              }
            } else {
              creadoPor = 'Admin / Colaborador'
            }
          } else if (r.pagado) {
            creadoPor = 'Cliente (Online - Mercado Pago)'
          } else {
            creadoPor = 'Admin'
          }
        }

        return {
          ...r,
          estado_pago: r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago'),
          monto_pagado: r.monto_pagado !== undefined ? r.monto_pagado : (r.pagado ? 100 : 0),
          creado_por: creadoPor
        }
      })

    res.json(enriched)
  } catch (err) {
    console.error('Error en /admin/reservas:', err)
    res.status(500).json({ error: 'Error del servidor al obtener reservas' })
  }
})

// POST — Crear reserva manual
app.post(['/api/admin/reservas', '/admin/reservas'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { nombre, fecha, hora, cancha, pagado, estado_pago, monto_pagado } = req.body
  const canchaFinal = cancha || '1'
  const finalEstadoPago = estado_pago || (pagado ? 'pagado' : 'sin_pago')
  const finalPagado = ['pagado', 'señado'].includes(finalEstadoPago)

  try {
    const { data: existing, error: errCheck } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .limit(1)

    if (errCheck) {
      console.error('Error verificando disponibilidad:', errCheck)
      return res.status(500).json({ error: errCheck.message })
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
    }

    const usuarioCreador = req.user?.nombre || req.user?.email || req.body.creado_por || (req.rol === 'colaborador' ? 'Colaborador' : 'Admin')
    const safeUserTag = encodeURIComponent(usuarioCreador)
    const paymentId = `manual_${Date.now()}_by_${safeUserTag}`

    let inserted = null
    const { data: insData, error: insertError } = await supabase
      .from('reservas')
      .insert([{
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: finalPagado,
        estado_pago: finalEstadoPago,
        monto_pagado: monto_pagado || 0,
        payment_id: paymentId,
        creado_por: usuarioCreador
      }])
      .select()
      .single()

    if (insertError) {
      console.warn('Error insertando con creado_por, reintentando fallback:', insertError.message)
      const { data: insFallback, error: errFallback } = await supabase
        .from('reservas')
        .insert([{
          nombre,
          fecha,
          hora,
          cancha: canchaFinal,
          pagado: finalPagado,
          estado_pago: finalEstadoPago,
          monto_pagado: monto_pagado || 0,
          payment_id: paymentId
        }])
        .select()
        .single()

      if (errFallback) {
        console.error('Error insertando fallback reserva admin:', errFallback)
        await supabase.from('reservas').insert([{
          nombre,
          fecha,
          hora,
          cancha: canchaFinal,
          pagado: finalPagado,
          payment_id: paymentId
        }])
      }

      inserted = insFallback || {
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: finalPagado,
        estado_pago: finalEstadoPago,
        monto_pagado: monto_pagado || 0,
        payment_id: paymentId,
        creado_por: usuarioCreador
      }
    } else {
      inserted = insData
    }

    if (inserted && !inserted.creado_por) {
      inserted.creado_por = usuarioCreador
    }

    res.json({ ok: true, reserva: inserted })
  } catch (err) {
    console.error('Error en POST /admin/reservas:', err)
    res.status(500).json({ error: 'Error al crear reserva' })
  }
})

// PUT — Actualizar reserva
app.put(['/api/admin/reservas/:id', '/admin/reservas/:id'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { id } = req.params
  const { nombre, fecha, hora, cancha, pagado, estado_pago, monto_pagado } = req.body
  const canchaFinal = cancha || '1'
  const finalEstadoPago = estado_pago || (pagado ? 'pagado' : 'sin_pago')
  const finalPagado = ['pagado', 'señado'].includes(finalEstadoPago)

  try {
    if (fecha && hora) {
      const { data: existing } = await supabase
        .from('reservas')
        .select('id')
        .eq('fecha', fecha)
        .eq('hora', hora)
        .eq('cancha', canchaFinal)
        .neq('id', id)
        .limit(1)

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
      }
    }

    const { error } = await supabase
      .from('reservas')
      .update({
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: finalPagado,
        estado_pago: finalEstadoPago,
        monto_pagado: monto_pagado || 0
      })
      .eq('id', id)

    if (error) {
      console.error('Error actualizando reserva:', error)
      return res.status(500).json({ error: error.message })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Error en PUT /admin/reservas:', err)
    res.status(500).json({ error: 'Error al actualizar reserva' })
  }
})

// DELETE — Eliminar reserva
app.delete(['/api/admin/reservas/:id', '/admin/reservas/:id'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const { error } = await supabase.from('reservas').delete().eq('id', id)

    if (error) {
      console.error('Error eliminando reserva:', error)
      return res.status(500).json({ error: error.message })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Error en DELETE /admin/reservas:', err)
    res.status(500).json({ error: 'Error al eliminar reserva' })
  }
})

// ============================
// GESTIÓN DE CANCHAS
// ============================
app.get(['/api/admin/canchas', '/admin/canchas'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  try {
    const extras = getBusinessExtras()
    res.json(extras.canchas)
  } catch (err) {
    console.error('Error listando canchas:', err)
    res.status(500).json({ error: 'Error al obtener canchas' })
  }
})

// Toggle disponibilidad de cancha
app.put(['/api/admin/canchas/:canchaId/disponibilidad', '/admin/canchas/:canchaId/disponibilidad'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { canchaId } = req.params
  const { activa, disponible } = req.body

  try {
    const extras = getBusinessExtras()
    const canchasActuales = extras.canchas
    const nuevoEstado = activa !== undefined ? !!activa : (disponible !== undefined ? !!disponible : true)

    let encontrada = false
    const canchasActualizadas = canchasActuales.map(c => {
      if (String(c.id) === String(canchaId) || String(c.nombre) === String(canchaId)) {
        encontrada = true
        return { ...c, activa: nuevoEstado }
      }
      return c
    })

    if (!encontrada) {
      return res.status(404).json({ error: 'Cancha no encontrada' })
    }

    saveBusinessExtras({ canchas: canchasActualizadas })

    try {
      let { data: neg } = await supabase.from('negocios').select('id').limit(1).maybeSingle()
      if (neg?.id) {
        await supabase.from('negocios').update({ canchas: canchasActualizadas }).eq('id', neg.id)
      }
    } catch (errSup) {
      console.warn('Advertencia actualizando canchas en Supabase:', errSup.message)
    }

    invalidateConfigCache()

    res.json({
      ok: true,
      mensaje: `Cancha ${nuevoEstado ? 'activada' : 'pausada'} con éxito`,
      canchas: canchasActualizadas
    })
  } catch (err) {
    console.error('Error al cambiar disponibilidad de cancha:', err)
    res.status(500).json({ error: 'Error al actualizar disponibilidad de cancha' })
  }
})

// PUT — Editar nombre y/o precio de una cancha
app.put(['/api/admin/canchas/:canchaId', '/admin/canchas/:canchaId'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { canchaId } = req.params
  const { nombre, precio } = req.body

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la cancha es obligatorio.' })
  }

  try {
    const extras = getBusinessExtras()
    const canchasActuales = extras.canchas || []
    const nombreLimpio = nombre.trim()

    let encontrada = false
    const canchasActualizadas = canchasActuales.map(c => {
      if (String(c.id) === String(canchaId)) {
        encontrada = true
        return {
          ...c,
          nombre: nombreLimpio,
          ...(precio !== undefined && !isNaN(Number(precio)) && Number(precio) > 0 ? { precio: Number(precio) } : {})
        }
      }
      return c
    })

    if (!encontrada) {
      return res.status(404).json({ error: 'Cancha no encontrada' })
    }

    saveBusinessExtras({ canchas: canchasActualizadas })

    try {
      let { data: neg } = await supabase.from('negocios').select('id').limit(1).maybeSingle()
      if (neg?.id) {
        await supabase.from('negocios').update({ canchas: canchasActualizadas }).eq('id', neg.id)
      }
    } catch (errSup) {
      console.warn('Advertencia actualizando canchas en Supabase:', errSup.message)
    }

    invalidateConfigCache()

    res.json({
      ok: true,
      mensaje: 'Cancha actualizada exitosamente',
      canchas: canchasActualizadas
    })
  } catch (err) {
    console.error('Error al editar cancha:', err)
    res.status(500).json({ error: 'Error del servidor al editar la cancha' })
  }
})

// POST — Agregar nueva cancha
app.post(['/api/admin/canchas', '/admin/canchas'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { nombre, password, precio } = req.body

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la cancha es obligatorio.' })
  }

  try {
    let passwordValida = req.rol === 'admin'
    const ADMIN_PASSWORD_GLOBAL = process.env.ADMIN_PASSWORD || 'admin123'

    if (!passwordValida && password) {
      if (password === ADMIN_PASSWORD_GLOBAL) {
        passwordValida = true
      } else if (req.user?.usuario_id) {
        const { data: usuario, error: uErr } = await supabase
          .from('usuarios')
          .select('password, rol')
          .eq('id', req.user.usuario_id)
          .single()

        if (!uErr && usuario && (usuario.password === password || usuario.rol === 'admin')) {
          passwordValida = true
        }
      }
    }

    // Si no es admin y no mandó password
    if (!passwordValida && !password) {
      return res.status(403).json({ error: 'Se requiere rol o contraseña de administrador para agregar canchas.' })
    }

    if (!passwordValida) {
      return res.status(403).json({ error: 'Contraseña de administrador incorrecta. No se realizaron cambios.' })
    }

    const extras = getBusinessExtras()
    const canchasActuales = extras.canchas || []
    const nombreLimpio = nombre.trim()

    const yaExiste = canchasActuales.some(c => c.nombre.toLowerCase() === nombreLimpio.toLowerCase())
    if (yaExiste) {
      return res.status(400).json({ error: `Ya existe una cancha con el nombre "${nombreLimpio}".` })
    }

    const maxNum = canchasActuales.reduce((max, c) => {
      const n = parseInt(c.id, 10)
      return (!isNaN(n) && n > max) ? n : max
    }, 0)
    const nuevoId = String(maxNum + 1)

    const nuevaCancha = {
      id: nuevoId,
      nombre: nombreLimpio,
      activa: true,
      ...(precio !== undefined && !isNaN(Number(precio)) && Number(precio) > 0 ? { precio: Number(precio) } : {})
    }

    const canchasActualizadas = [...canchasActuales, nuevaCancha]
    saveBusinessExtras({ canchas: canchasActualizadas })

    try {
      let { data: neg } = await supabase.from('negocios').select('id').limit(1).maybeSingle()
      if (neg?.id) {
        await supabase.from('negocios').update({ canchas: canchasActualizadas }).eq('id', neg.id)
      }
    } catch (errSup) {
      console.warn('Advertencia actualizando canchas en Supabase:', errSup.message)
    }

    invalidateConfigCache()

    res.json({
      ok: true,
      mensaje: 'Cancha creada exitosamente',
      cancha: nuevaCancha,
      canchas: canchasActualizadas
    })
  } catch (err) {
    console.error('Error al agregar cancha:', err)
    res.status(500).json({ error: 'Error del servidor al agregar la cancha' })
  }
})

// DELETE — Eliminar cancha
app.delete(['/api/admin/canchas/:canchaId', '/admin/canchas/:canchaId'], verifyAuth, requireColaboradorOrAdmin, async (req, res) => {
  const { canchaId } = req.params
  const { password } = req.body || {}

  try {
    let passwordValida = req.rol === 'admin'
    const ADMIN_PASSWORD_GLOBAL = process.env.ADMIN_PASSWORD || 'admin123'

    if (!passwordValida && password) {
      if (password === ADMIN_PASSWORD_GLOBAL) {
        passwordValida = true
      } else if (req.user?.usuario_id) {
        const { data: usuario, error: uErr } = await supabase
          .from('usuarios')
          .select('password, rol')
          .eq('id', req.user.usuario_id)
          .single()

        if (!uErr && usuario && (usuario.password === password || usuario.rol === 'admin')) {
          passwordValida = true
        }
      }
    }

    if (!passwordValida) {
      return res.status(403).json({ error: 'Se requiere rol o contraseña de administrador para eliminar una cancha.' })
    }

    const extras = getBusinessExtras()
    const canchasActuales = extras.canchas || []
    if (canchasActuales.length <= 1) {
      return res.status(400).json({ error: 'No podés eliminar todas las canchas. Debe haber al menos una cancha configurada.' })
    }

    const canchasActualizadas = canchasActuales.filter(c => String(c.id) !== String(canchaId))
    saveBusinessExtras({ canchas: canchasActualizadas })

    try {
      let { data: neg } = await supabase.from('negocios').select('id').limit(1).maybeSingle()
      if (neg?.id) {
        await supabase.from('negocios').update({ canchas: canchasActualizadas }).eq('id', neg.id)
      }
    } catch (errSup) {
      console.warn('Advertencia eliminando cancha en Supabase:', errSup.message)
    }

    invalidateConfigCache()

    res.json({
      ok: true,
      mensaje: 'Cancha eliminada exitosamente',
      canchas: canchasActualizadas
    })
  } catch (err) {
    console.error('Error al eliminar cancha:', err)
    res.status(500).json({ error: 'Error del servidor al eliminar la cancha' })
  }
})

// ============================
// CONFIGURACIÓN DEL NEGOCIO (SOLO ADMIN)
// ============================
app.get(['/api/admin/config', '/admin/config'], verifyAuth, requireAdmin, async (req, res) => {
  try {
    let { data: negocio } = await supabase
      .from('negocios')
      .select('id, nombre, telefono, direccion, plan, activo, monto_sena, precio_total, mp_access_token')
      .limit(1)
      .maybeSingle()

    const extras = getBusinessExtras()

    if (!negocio) {
      return res.json({
        id: '1',
        nombre: 'Cancha Fútbol',
        telefono: '3804201334',
        direccion: 'San Martín',
        monto_sena: 100,
        precio_total: 100,
        canchas: extras.canchas,
        horarios: extras.horarios,
        tiene_mp_token: false
      })
    }

    res.json({
      id: negocio.id,
      nombre: negocio.nombre || 'Cancha Fútbol',
      telefono: negocio.telefono || '',
      direccion: negocio.direccion || '',
      monto_sena: negocio.monto_sena || 100,
      precio_total: negocio.precio_total || 100,
      canchas: extras.canchas,
      horarios: extras.horarios,
      tiene_mp_token: !!negocio.mp_access_token
    })
  } catch (err) {
    console.error('Error obteniendo config de negocio:', err)
    res.status(500).json({ error: 'Error al obtener configuración' })
  }
})

app.put(['/api/admin/config', '/admin/config'], verifyAuth, requireAdmin, async (req, res) => {
  const { nombre, monto_sena, precio_total, telefono, direccion, horarios, mp_access_token } = req.body

  try {
    const updateData = {}
    if (nombre !== undefined && nombre !== '') updateData.nombre = String(nombre).trim()
    if (monto_sena !== undefined) updateData.monto_sena = Number(monto_sena)
    if (precio_total !== undefined) updateData.precio_total = Number(precio_total)
    if (telefono !== undefined) updateData.telefono = String(telefono).trim()
    if (direccion !== undefined) updateData.direccion = String(direccion).trim()
    if (mp_access_token) updateData.mp_access_token = mp_access_token

    if (horarios !== undefined) {
      saveBusinessExtras({ horarios: normalizarHorarios(horarios) })
    }

    let { data: existingNeg } = await supabase.from('negocios').select('id').limit(1).maybeSingle()
    let savedNegocio = null

    if (existingNeg?.id) {
      const { data, error } = await supabase
        .from('negocios')
        .update(updateData)
        .eq('id', existingNeg.id)
        .select()

      if (error) {
        console.error('Error actualizando negocio en Supabase:', error)
      } else {
        savedNegocio = data?.[0]
      }
    }

    const extras = getBusinessExtras()

    const fullConfig = {
      id: savedNegocio?.id || '1',
      nombre: savedNegocio?.nombre || updateData.nombre || 'Cancha Fútbol',
      telefono: savedNegocio?.telefono !== undefined ? savedNegocio.telefono : (updateData.telefono || ''),
      direccion: savedNegocio?.direccion !== undefined ? savedNegocio.direccion : (updateData.direccion || ''),
      monto_sena: savedNegocio?.monto_sena !== undefined ? savedNegocio.monto_sena : updateData.monto_sena,
      precio_total: savedNegocio?.precio_total !== undefined ? savedNegocio.precio_total : updateData.precio_total,
      horarios: extras.horarios,
      canchas: extras.canchas,
      tiene_mp_token: !!(savedNegocio?.mp_access_token || updateData.mp_access_token)
    }

    invalidateConfigCache()

    res.json({
      ok: true,
      mensaje: 'Configuración actualizada exitosamente',
      config: fullConfig,
      nombre: fullConfig.nombre
    })
  } catch (err) {
    console.error('Error actualizando config de negocio:', err)
    res.status(500).json({ error: 'Error al guardar configuración' })
  }
})

// ============================
// COLABORADORES (SOLO ADMIN)
// ============================
app.get(['/api/admin/colaboradores', '/admin/colaboradores'], verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, rol, activo, created_at')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json(usuarios || [])
  } catch (err) {
    res.status(500).json({ error: 'Error al listar colaboradores' })
  }
})

app.post(['/api/admin/colaboradores', '/admin/colaboradores'], verifyAuth, requireAdmin, async (req, res) => {
  const { nombre, email, password } = req.body
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' })
  }

  try {
    const { data: nuevo, error } = await supabase
      .from('usuarios')
      .insert([{
        nombre,
        email,
        password,
        rol: 'colaborador',
        activo: true
      }])
      .select('id, email, nombre, rol, activo, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya existe un usuario con ese correo electrónico' })
      }
      return res.status(500).json({ error: error.message })
    }

    res.json({ ok: true, usuario: nuevo })
  } catch (err) {
    res.status(500).json({ error: 'Error al crear colaborador' })
  }
})

app.delete(['/api/admin/colaboradores/:id', '/admin/colaboradores/:id'], verifyAuth, requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    if (req.user?.usuario_id === id) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' })
    }

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar colaborador' })
  }
})

// ============================
// START SERVER
// ============================
let server = null
const PORT = process.env.PORT || 3000

if (!process.env.VERCEL) {
  server = app.listen(PORT, () =>
    console.log(`🚀 Backend activo en puerto ${PORT}`)
  ).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: El puerto ${PORT} ya está siendo utilizado por otra instancia de Node.`)
      console.error(`💡 Para liberarlo en PowerShell ejecuta:\n   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`)
    } else {
      console.error('❌ Error al iniciar servidor:', err)
    }
  })
}

export default app
export { app, server }

