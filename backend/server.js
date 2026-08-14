import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { verifyTenantUser } from './middleware/tenant.js'
import { requireAdmin, requireColaboradorOrAdmin } from './middleware/roles.js'
import { requireSuperAdmin } from './middleware/superadmin.js'

const app = express()

// ============================
// CORS
// ============================
const allowedOrigins = [
  'https://reservas-de-turnos.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('CORS: Origen no permitido'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-negocio-id'],
  credentials: true
}))

app.use(express.json())

console.log('🔥 SERVER MULTI-TENANT ACTIVADO 🔥')

// ============================
// CLIENTES EXTERNOS
// ============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'
const DEFAULT_MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

// Helper para instanciar cliente de Mercado Pago dinámicamente por negocio
const getMPClient = (customAccessToken) => {
  const token = customAccessToken || DEFAULT_MP_ACCESS_TOKEN
  return new MercadoPagoConfig({ accessToken: token })
}

// ============================
// KEEP-ALIVE — Supabase (cada 4 días)
// ============================
const CUATRO_DIAS_MS = 4 * 24 * 60 * 60 * 1000

setInterval(async () => {
  try {
    const { error } = await supabase.from('reservas').select('id').limit(1)
    if (error) console.error('⚠️ Keep-alive Supabase error:', error.message)
    else console.log('✅ Supabase keep-alive OK —', new Date().toISOString())
  } catch (e) {
    console.error('⚠️ Keep-alive excepción:', e.message)
  }
}, CUATRO_DIAS_MS)

// ============================
// TAREA B: HEALTH CHECK DE BASE DE DATOS
// Endpoint con timeout de 5 segundos para verificar si la base está activa
// ============================
app.get('/health/db', async (req, res) => {
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

// Keep-alive general
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('reservas').select('id').limit(1)
    if (error) return res.status(500).json({ status: 'error', db: error.message })
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message })
  }
})

// ============================
// ENDPOINTS PÚBLICOS DE NEGOCIO
// ============================

// Obtener datos públicos de un negocio por slug
app.get('/api/negocios/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    let { data: negocio, error } = await supabase
      .from('negocios')
      .select('id, nombre, slug, telefono, direccion, plan, activo, modo_prueba, monto_sena, precio_total')
      .eq('slug', slug)
      .single()

    if (error || !negocio) {
      const retry = await supabase
        .from('negocios')
        .select('id, nombre, slug, plan, activo, modo_prueba, monto_sena, precio_total')
        .eq('slug', slug)
        .single()

      if (retry.data) {
        negocio = retry.data
      } else if (slug === 'pruebas-reservas') {
        negocio = {
          id: '11111111-1111-1111-1111-111111111111',
          nombre: 'Pruebas-Reservas',
          slug: 'pruebas-reservas',
          telefono: '3804201334',
          direccion: 'Cancha Demo Central',
          plan: 'pro',
          activo: true,
          modo_prueba: true,
          monto_sena: 100,
          precio_total: 100
        }
      } else if (slug === 'reservas-futbol') {
        negocio = {
          id: '22222222-2222-2222-2222-222222222222',
          nombre: 'Reservas Fútbol',
          slug: 'reservas-futbol',
          telefono: '3804201334',
          direccion: 'Av. San Martín 1234',
          plan: 'pro',
          activo: true,
          modo_prueba: false,
          monto_sena: 100,
          precio_total: 100
        }
      } else {
        return res.status(404).json({ error: 'Negocio no encontrado' })
      }
    }

    if (!negocio.activo) {
      return res.status(403).json({ error: 'Este negocio se encuentra inactivo temporalmente' })
    }

    res.json(negocio)
  } catch (err) {
    console.error('Error obteniendo negocio por slug:', err)
    res.status(500).json({ error: 'Error del servidor al obtener negocio' })
  }
})
// Obtener reservas ocupadas públicas para calendario de un negocio
app.get('/api/negocios/:slug/turnos-ocupados', async (req, res) => {
  const { slug } = req.params
  const { desde, hasta } = req.query

  try {
    // Buscar negocio
    const { data: negocio } = await supabase
      .from('negocios')
      .select('id')
      .eq('slug', slug)
      .single()

    const negocioId = negocio?.id || (slug === 'pruebas-reservas' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222')

    let query = supabase
      .from('reservas')
      .select('fecha, hora, cancha, estado_pago, pagado')
      .eq('negocio_id', negocioId)

    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

    const { data, error } = await query

    if (error) {
      // Si la columna negocio_id aún no existe, fallback a reservas generales
      const { data: fallbackData } = await supabase.from('reservas').select('fecha, hora, cancha, pagado')
      return res.json(fallbackData || [])
    }

    // Retornar turnos que están ocupados (cualquier reserva existente bloquea el turno)
    res.json(data || [])
  } catch (err) {
    console.error('Error obteniendo turnos ocupados:', err)
    res.status(500).json({ error: 'Error al consultar disponibilidad' })
  }
})

// Reserva directa para MODO PRUEBA / DEMO (sin pasar por Mercado Pago)
app.post('/api/demo/reservar', async (req, res) => {
  const { slug, nombre, fecha, hora, cancha } = req.body
  const canchaFinal = cancha || '1'

  if (!slug || !nombre || !fecha || !hora) {
    return res.status(400).json({ error: 'Datos incompletos para la reserva de prueba' })
  }

  try {
    // Verificar que el negocio esté en modo prueba
    let negocioId = '11111111-1111-1111-1111-111111111111'
    const { data: negocio } = await supabase
      .from('negocios')
      .select('id, modo_prueba, activo')
      .eq('slug', slug)
      .single()

    if (negocio) {
      if (!negocio.activo) return res.status(403).json({ error: 'Negocio inactivo' })
      if (!negocio.modo_prueba) return res.status(400).json({ error: 'Este negocio no admite reservas directas de prueba' })
      negocioId = negocio.id
    }

    // Verificar disponibilidad
    const { data: existing } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .eq('negocio_id', negocioId)
      .limit(1)

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
    }

    // Insertar reserva demo
    const { data: inserted, error: insertErr } = await supabase
      .from('reservas')
      .insert([{
        nombre: `${nombre} (DEMO)`,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: true,
        estado_pago: 'pagado',
        monto_pagado: 100,
        payment_id: 'demo_' + Date.now(),
        negocio_id: negocioId
      }])
      .select()
      .single()

    if (insertErr) {
      // Fallback si la columna negocio_id o estado_pago aún no existen
      await supabase.from('reservas').insert([{
        nombre: `${nombre} (DEMO)`,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: true,
        payment_id: 'demo_' + Date.now()
      }])
    }

    console.log('✅ Reserva DEMO creada exitosamente para:', slug)
    res.json({ ok: true, mensaje: 'Reserva de prueba confirmada', reserva: inserted })
  } catch (err) {
    console.error('Error creando reserva demo:', err)
    res.status(500).json({ error: 'Error al procesar reserva de prueba' })
  }
})

// ============================
// MERCADO PAGO: CREATE PREFERENCE (DINÁMICO POR NEGOCIO)
// ============================
app.post('/create-preference', async (req, res) => {
  try {
    const { slug, nombre, fecha, hora, cancha } = req.body
    const canchaFinal = cancha || '1'

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    // Buscar configuración del negocio
    let negocioId = '22222222-2222-2222-2222-222222222222'
    let mpAccessToken = null
    let montoSena = 100
    let nombreNegocio = 'Reserva Fútbol'

    if (slug) {
      const { data: neg } = await supabase
        .from('negocios')
        .select('id, nombre, mp_access_token, monto_sena, activo, modo_prueba')
        .eq('slug', slug)
        .single()

      if (neg) {
        if (!neg.activo) return res.status(403).json({ error: 'Negocio suspendido o inactivo' })
        if (neg.modo_prueba) {
          return res.status(400).json({ error: 'Este negocio está configurado en Modo Prueba. Debe reservar mediante el flujo demo sin Mercado Pago.' })
        }
        negocioId = neg.id
        nombreNegocio = neg.nombre
        mpAccessToken = neg.mp_access_token
        if (neg.monto_sena) montoSena = Number(neg.monto_sena)
      }
    }

    // 🛡️ SEGURIDAD: Exigir credenciales propias de Mercado Pago para cada negocio
    if (!mpAccessToken) {
      if (slug === 'reservas-futbol' || !slug) {
        mpAccessToken = DEFAULT_MP_ACCESS_TOKEN
      } else {
        return res.status(400).json({
          error: `El negocio "${nombreNegocio}" aún no ha configurado sus credenciales de Mercado Pago para recibir cobros. Configúrelas en el panel de administración o active el Modo Demo.`
        })
      }
    }


    // Verificar disponibilidad (cualquier reserva existente bloquea el turno)
    const { data: existingSlot, error: errSlot } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .eq('negocio_id', negocioId)
      .limit(1)

    if (existingSlot && existingSlot.length > 0) {
      return res.status(400).json({ error: 'El turno ya se encuentra reservado.' })
    }

    const externalReference = `RES-${negocioId}-${Date.now()}`
    const client = getMPClient(mpAccessToken)
    const preference = new Preference(client)

    const baseUrl = (process.env.FRONTEND_URL || 'https://reservas-de-turnos.vercel.app').replace(/\/$/, '')
    const isHttps = baseUrl.startsWith('https://')
    const tenantSlug = slug || 'reservas-futbol'

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
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
        installments: 1
      },
      statement_descriptor: 'Reserva Futbol',
      metadata: {
        negocio_id: negocioId,
        slug: tenantSlug,
        nombre,
        cancha: canchaFinal,
        fecha,
        hora,
        monto_sena: montoSena,
        external_reference: externalReference
      },
      back_urls: {
        success: `${baseUrl}/${tenantSlug}/success?nombre=${encodeURIComponent(nombre)}&fecha=${fecha}&hora=${hora}&cancha=${canchaFinal}`,
        failure: `${baseUrl}/${tenantSlug}`,
        pending: `${baseUrl}/${tenantSlug}`
      },
      notification_url: 'https://reservas-de-turnos.onrender.com/webhook'
    }

    if (isHttps) {
      preferenceBody.auto_return = 'approved'
    }

    const response = await preference.create({ body: preferenceBody })

    console.log('✅ Preference creada — Ref:', externalReference, 'Negocio:', tenantSlug)
    res.json({
      init_point: response.init_point,
      external_reference: externalReference
    })
  } catch (error) {
    console.error('❌ Error create-preference:', error)
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

app.post('/webhook', async (req, res) => {
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

    const defaultClient = getMPClient(DEFAULT_MP_ACCESS_TOKEN)
    const payment = new Payment(defaultClient)
    const mpPayment = await payment.get({ id: paymentId })

    console.log('💰 Estado del pago:', mpPayment.status)
    if (mpPayment.status !== 'approved') {
      return res.sendStatus(200)
    }

    const { negocio_id, nombre, fecha, hora, cancha, monto_sena } = mpPayment.metadata || {}
    const canchaFinal = cancha || '1'
    const finalNegocioId = negocio_id || '22222222-2222-2222-2222-222222222222'

    // Verificar duplicado
    const { data: existing } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .eq('negocio_id', finalNegocioId)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log('⚠️ Doble reserva prevenida en webhook')
      return res.sendStatus(200)
    }

    // Insertar reserva confirmada / señada
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
          payment_id: String(paymentId),
          negocio_id: finalNegocioId
        }
      ])

    if (insertError) {
      console.error('Error insertando reserva desde webhook:', insertError)
      // Fallback básico
      await supabase.from('reservas').insert([{
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: true,
        payment_id: String(paymentId)
      }])
    }

    console.log('✅ Reserva creada por webhook con éxito')
    res.sendStatus(200)
  } catch (error) {
    console.error('Webhook error:', error)
    res.sendStatus(500)
  }
})

// ============================
// AUTENTICACIÓN ADMIN / COLABORADOR POR NEGOCIO
// ============================
app.post('/admin/login', async (req, res) => {
  const { slug, email, password } = req.body
  const ADMIN_PASSWORD_GLOBAL = process.env.ADMIN_PASSWORD || 'admin123'

  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida' })
  }

  try {
    // 1. Si no hay slug, o se pasa el superadmin
    const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'chavow5@superadmin'
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123'
    if (email === superAdminEmail && password === superAdminPassword) {
      const token = jwt.sign(
        { rol: 'superadmin', email: superAdminEmail, nombre: 'Super Admin' },
        JWT_SECRET,
        { expiresIn: '12h' }
      )
      return res.json({
        token,
        user: { nombre: 'Super Admin', email: superAdminEmail, rol: 'superadmin' }
      })
    }

    const tenantSlug = slug || 'reservas-futbol'

    // 2. Buscar negocio
    const { data: negocio, error: negErr } = await supabase
      .from('negocios')
      .select('id, nombre, slug, activo')
      .eq('slug', tenantSlug)
      .single()

    let negocioId = negocio?.id || (tenantSlug === 'pruebas-reservas' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222')
    let negocioNombre = negocio?.nombre || (tenantSlug === 'pruebas-reservas' ? 'Pruebas-Reservas' : 'Reservas Fútbol')

    if (negocio && !negocio.activo) {
      return res.status(403).json({ error: 'El negocio se encuentra inactivo' })
    }

    // 3. Buscar usuario en tabla usuarios
    if (email) {
      const { data: usuario, error: userErr } = await supabase
        .from('usuarios')
        .select('id, email, password, nombre, rol, activo, negocio_id')
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
              negocio_id: usuario.negocio_id || negocioId,
              rol: usuario.rol,
              nombre: usuario.nombre,
              email: usuario.email,
              slug: tenantSlug
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
              rol: usuario.rol,
              slug: tenantSlug,
              negocioNombre
            }
          })
        }
      }
    }

    // 4. Fallback: Verificación con contraseña maestra / demo
    const esDemo = tenantSlug === 'pruebas-reservas' && password === '123456'
    const esReal = (tenantSlug === 'reservas-futbol' || !slug) && password === ADMIN_PASSWORD_GLOBAL

    if (esDemo || esReal) {
      const userRol = 'admin'
      const userNombre = esDemo ? 'Admin Pruebas' : 'Admin Principal'
      const userEmail = esDemo ? 'admin@pruebas.com' : 'admin@reservas.com'

      const token = jwt.sign(
        {
          usuario_id: esDemo ? 'user-demo-admin' : 'user-real-admin',
          negocio_id: negocioId,
          rol: userRol,
          nombre: userNombre,
          email: userEmail,
          slug: tenantSlug
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      )

      return res.json({
        token,
        user: {
          id: esDemo ? 'user-demo-admin' : 'user-real-admin',
          nombre: userNombre,
          email: userEmail,
          rol: userRol,
          slug: tenantSlug,
          negocioNombre
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

// GET — Todas las reservas del negocio autenticado
app.get('/admin/reservas', verifyTenantUser(supabase), async (req, res) => {
  try {
    let query = supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: true })

    if (req.rol !== 'superadmin' && req.negocio_id) {
      query = query.eq('negocio_id', req.negocio_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo reservas:', error)
      return res.status(500).json({ error: error.message })
    }

    res.json(data || [])
  } catch (err) {
    console.error('Error en GET /admin/reservas:', err)
    res.status(500).json({ error: 'Error al consultar reservas' })
  }
})

// POST — Crear reserva manual (Admin o Colaborador)
app.post('/admin/reservas', verifyTenantUser(supabase), requireColaboradorOrAdmin, async (req, res) => {
  const { nombre, fecha, hora, cancha, pagado, estado_pago, monto_pagado } = req.body
  const canchaFinal = cancha || '1'
  const finalEstadoPago = estado_pago || (pagado ? 'pagado' : 'sin_pago')
  const finalPagado = ['pagado', 'señado'].includes(finalEstadoPago)

  try {
    // Verificar si el turno ya está ocupado en este negocio
    let checkQuery = supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)

    if (req.negocio_id) {
      checkQuery = checkQuery.eq('negocio_id', req.negocio_id)
    }

    const { data: existing, error: errCheck } = await checkQuery.limit(1)

    if (errCheck) {
      console.error('Error verificando disponibilidad:', errCheck)
      return res.status(500).json({ error: errCheck.message })
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
    }

    // Insertar reserva asociada estrictamente al tenant autenticado
    const { data: inserted, error: insertError } = await supabase
      .from('reservas')
      .insert([{
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: finalPagado,
        estado_pago: finalEstadoPago,
        monto_pagado: monto_pagado || 0,
        payment_id: 'manual_' + Date.now(),
        negocio_id: req.negocio_id
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creando reserva admin:', insertError)
      // Fallback básico si columnas nuevas no existen aún
      await supabase.from('reservas').insert([{
        nombre,
        fecha,
        hora,
        cancha: canchaFinal,
        pagado: finalPagado,
        payment_id: 'manual_' + Date.now()
      }])
    }

    res.json({ ok: true, reserva: inserted })
  } catch (err) {
    console.error('Error en POST /admin/reservas:', err)
    res.status(500).json({ error: 'Error al crear reserva' })
  }
})

// PUT — Actualizar reserva (datos o estado de pago)
app.put('/admin/reservas/:id', verifyTenantUser(supabase), requireColaboradorOrAdmin, async (req, res) => {
  const { id } = req.params
  const { nombre, fecha, hora, cancha, pagado, estado_pago, monto_pagado } = req.body
  const canchaFinal = cancha || '1'
  const finalEstadoPago = estado_pago || (pagado ? 'pagado' : 'sin_pago')
  const finalPagado = ['pagado', 'señado'].includes(finalEstadoPago)

  try {
    // Validar superposición si se cambiaron fecha/hora/cancha
    if (fecha && hora) {
      let checkQuery = supabase
        .from('reservas')
        .select('id')
        .eq('fecha', fecha)
        .eq('hora', hora)
        .eq('cancha', canchaFinal)
        .neq('id', id)

      if (req.negocio_id) {
        checkQuery = checkQuery.eq('negocio_id', req.negocio_id)
      }

      const { data: existing } = await checkQuery.limit(1)
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
      }
    }

    // Actualizar garantizando que pertenezca al negocio autenticado
    let updateQuery = supabase
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

    if (req.rol !== 'superadmin' && req.negocio_id) {
      updateQuery = updateQuery.eq('negocio_id', req.negocio_id)
    }

    const { error } = await updateQuery

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
app.delete('/admin/reservas/:id', verifyTenantUser(supabase), requireColaboradorOrAdmin, async (req, res) => {
  const { id } = req.params

  try {
    let deleteQuery = supabase.from('reservas').delete().eq('id', id)

    if (req.rol !== 'superadmin' && req.negocio_id) {
      deleteQuery = deleteQuery.eq('negocio_id', req.negocio_id)
    }

    const { error } = await deleteQuery

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
// CONFIGURACIÓN DEL NEGOCIO (SOLO ADMIN)
// ============================
app.get('/admin/config', verifyTenantUser(supabase), requireAdmin, async (req, res) => {
  try {
    let { data: negocio, error } = await supabase
      .from('negocios')
      .select('id, nombre, slug, telefono, direccion, plan, activo, modo_prueba, monto_sena, precio_total, mp_access_token')
      .eq('id', req.negocio_id)
      .single()

    if (error || !negocio) {
      const retry = await supabase
        .from('negocios')
        .select('id, nombre, slug, plan, activo, modo_prueba, monto_sena, precio_total, mp_access_token')
        .eq('id', req.negocio_id)
        .single()

      if (retry.data) {
        negocio = retry.data
      } else {
        return res.json({
          nombre: req.negocio?.nombre || 'Mi Cancha',
          slug: req.user?.slug || 'mi-cancha',
          telefono: '',
          direccion: '',
          monto_sena: 100,
          precio_total: 100,
          tiene_mp_token: false
        })
      }
    }

    res.json({
      id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      telefono: negocio.telefono || '',
      direccion: negocio.direccion || '',
      monto_sena: negocio.monto_sena || 100,
      precio_total: negocio.precio_total || 100,
      modo_prueba: negocio.modo_prueba,
      tiene_mp_token: !!negocio.mp_access_token
    })
  } catch (err) {
    console.error('Error obteniendo config de negocio:', err)
    res.status(500).json({ error: 'Error al obtener configuración' })
  }
})

app.put('/admin/config', verifyTenantUser(supabase), requireAdmin, async (req, res) => {
  const { nombre, monto_sena, precio_total, telefono, direccion, mp_access_token } = req.body

  try {
    const updateData = {}
    if (nombre) updateData.nombre = nombre
    if (monto_sena !== undefined) updateData.monto_sena = Number(monto_sena)
    if (precio_total !== undefined) updateData.precio_total = Number(precio_total)
    if (telefono !== undefined) updateData.telefono = telefono || null
    if (direccion !== undefined) updateData.direccion = direccion || null
    if (mp_access_token) updateData.mp_access_token = mp_access_token

    let { error } = await supabase
      .from('negocios')
      .update(updateData)
      .eq('id', req.negocio_id)

    if (error) {
      delete updateData.telefono
      delete updateData.direccion
      const retry = await supabase.from('negocios').update(updateData).eq('id', req.negocio_id)
      if (retry.error) return res.status(500).json({ error: retry.error.message })
    }

    res.json({ ok: true, mensaje: 'Configuración actualizada exitosamente' })
  } catch (err) {
    console.error('Error actualizando config de negocio:', err)
    res.status(500).json({ error: 'Error al guardar configuración' })
  }
})

// ============================
// COLABORADORES (SOLO ADMIN)
// ============================
app.get('/admin/colaboradores', verifyTenantUser(supabase), requireAdmin, async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, rol, activo, created_at')
      .eq('negocio_id', req.negocio_id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json(usuarios || [])
  } catch (err) {
    res.status(500).json({ error: 'Error al listar colaboradores' })
  }
})

app.post('/admin/colaboradores', verifyTenantUser(supabase), requireAdmin, async (req, res) => {
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
        negocio_id: req.negocio_id,
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

app.delete('/admin/colaboradores/:id', verifyTenantUser(supabase), requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    // Evitar autoeliminación
    if (req.user?.usuario_id === id) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' })
    }

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)
      .eq('negocio_id', req.negocio_id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar colaborador' })
  }
})

// ============================
// SUPER ADMIN: ENDPOINTS MAESTROS
// ============================

// Login SuperAdmin dedicado
app.post('/api/superadmin/login', (req, res) => {
  const { email, password } = req.body
  const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'chavow5@superadmin'
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'superadmin123'

  if (email === superAdminEmail && password === superAdminPassword) {
    const token = jwt.sign(
      { rol: 'superadmin', email: superAdminEmail, nombre: 'Super Admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    )
    return res.json({
      ok: true,
      token,
      user: { nombre: 'Super Administrador', email: superAdminEmail, rol: 'superadmin' }
    })
  }

  res.status(401).json({ error: 'Credenciales de SuperAdmin inválidas' })
})

// Métricas Globales para Super Admin
app.get('/api/superadmin/metricas', requireSuperAdmin, async (req, res) => {
  try {
    const [{ count: totalNegocios }, { count: totalReservas }, { data: negocios }] = await Promise.all([
      supabase.from('negocios').select('*', { count: 'exact', head: true }),
      supabase.from('reservas').select('*', { count: 'exact', head: true }),
      supabase.from('negocios').select('id, nombre, activo, modo_prueba')
    ])

    const { data: reservasRecientes } = await supabase
      .from('reservas')
      .select('monto_pagado, estado_pago, fecha')
      .limit(1000)

    const mesActual = new Date().toISOString().slice(0, 7)
    const reservasMes = (reservasRecientes || []).filter(r => r.fecha?.startsWith(mesActual)).length

    const totalRecaudado = (reservasRecientes || [])
      .filter(r => ['pagado', 'señado'].includes(r.estado_pago))
      .reduce((sum, r) => sum + (Number(r.monto_pagado) || 100), 0)

    res.json({
      totalNegocios: totalNegocios || negocios?.length || 2,
      negociosActivos: (negocios || []).filter(n => n.activo).length || 2,
      totalReservas: totalReservas || reservasRecientes?.length || 0,
      reservasMes,
      totalRecaudado
    })
  } catch (err) {
    console.error('Error calculando métricas SuperAdmin:', err)
    res.status(500).json({ error: 'Error al calcular métricas' })
  }
})

// Listado de Negocios para Super Admin
app.get('/api/superadmin/negocios', requireSuperAdmin, async (req, res) => {
  try {
    let { data: negocios, error } = await supabase
      .from('negocios')
      .select('id, nombre, slug, email_contacto, telefono, dni, direccion, plan, activo, modo_prueba, monto_sena, precio_mensual, estado_suscripcion, dia_vencimiento, ultimo_pago, mp_access_token, created_at')
      .order('created_at', { ascending: false })

    // Fallback si aún no se corrió la migración de nuevas columnas
    if (error) {
      const retry = await supabase
        .from('negocios')
        .select('id, nombre, slug, email_contacto, plan, activo, modo_prueba, monto_sena, mp_access_token, created_at')
        .order('created_at', { ascending: false })
      negocios = retry.data || []
    }

    if (!negocios || negocios.length === 0) {
      return res.json([
        {
          id: '11111111-1111-1111-1111-111111111111',
          nombre: 'Pruebas-Reservas',
          slug: 'pruebas-reservas',
          telefono: '3804201334',
          dni: '',
          direccion: 'Cancha Demo Central',
          plan: 'demo',
          activo: true,
          modo_prueba: true,
          monto_sena: 100,
          precio_mensual: 0,
          estado_suscripcion: 'al_dia',
          dia_vencimiento: 10,
          total_reservas: 0
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          nombre: 'Reservas Fútbol',
          slug: 'reservas-futbol',
          telefono: '3804000000',
          dni: '12345678',
          direccion: 'Av. San Martín 1234',
          plan: 'pro',
          activo: true,
          modo_prueba: false,
          monto_sena: 100,
          precio_mensual: 25000,
          estado_suscripcion: 'al_dia',
          dia_vencimiento: 10,
          total_reservas: 0
        }
      ])
    }

    // Obtener conteo de reservas por negocio
    const { data: reservas } = await supabase.from('reservas').select('negocio_id')
    const conteoPorNegocio = (reservas || []).reduce((acc, r) => {
      acc[r.negocio_id] = (acc[r.negocio_id] || 0) + 1
      return acc
    }, {})

    const enriquecidos = negocios.map(n => ({
      ...n,
      telefono: n.telefono || '',
      dni: n.dni || '',
      direccion: n.direccion || '',
      precio_mensual: Number(n.precio_mensual) || 25000,
      estado_suscripcion: n.estado_suscripcion || 'al_dia',
      dia_vencimiento: n.dia_vencimiento || 10,
      total_reservas: conteoPorNegocio[n.id] || 0
    }))

    res.json(enriquecidos)
  } catch (err) {
    console.error('Error en listado de negocios SuperAdmin:', err)
    res.status(500).json({ error: 'Error al listar negocios' })
  }
})

// Crear nuevo negocio desde Super Admin
app.post('/api/superadmin/negocios', requireSuperAdmin, async (req, res) => {
  const {
    nombre,
    slug,
    email_contacto,
    telefono,
    dni,
    direccion,
    plan,
    modo_prueba,
    monto_sena,
    precio_mensual,
    dia_vencimiento,
    admin_email,
    admin_password,
    admin_nombre,
    mp_access_token
  } = req.body

  if (!nombre || !slug || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'Nombre, slug, email de admin y contraseña son requeridos' })
  }

  const slugNormalizado = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-')

  try {
    // 1. Crear Negocio
    const insertPayload = {
      nombre,
      slug: slugNormalizado,
      email_contacto: email_contacto || admin_email,
      telefono: telefono || null,
      dni: dni || null,
      direccion: direccion || null,
      plan: plan || 'free',
      modo_prueba: !!modo_prueba,
      monto_sena: Number(monto_sena) || 100,
      precio_mensual: Number(precio_mensual) || 25000,
      dia_vencimiento: Number(dia_vencimiento) || 10,
      estado_suscripcion: 'al_dia',
      mp_access_token: mp_access_token ? mp_access_token.trim() : null,
      activo: true
    }

    let { data: negocio, error: negErr } = await supabase
      .from('negocios')
      .insert([insertPayload])
      .select()
      .single()

    if (negErr) {
      if (negErr.code === '23505') {
        return res.status(400).json({ error: 'El slug o email ya está en uso por otro negocio' })
      }
      // Fallback si faltan columnas nuevas en DB
      delete insertPayload.telefono
      delete insertPayload.dni
      delete insertPayload.direccion
      delete insertPayload.precio_mensual
      delete insertPayload.dia_vencimiento
      delete insertPayload.estado_suscripcion
      const retry = await supabase.from('negocios').insert([insertPayload]).select().single()
      if (retry.error) return res.status(500).json({ error: retry.error.message })
      negocio = retry.data
    }

    // 2. Crear Administrador inicial del negocio
    const { error: userErr } = await supabase
      .from('usuarios')
      .insert([{
        negocio_id: negocio.id,
        email: admin_email,
        password: admin_password,
        nombre: admin_nombre || `Admin ${nombre}`,
        rol: 'admin',
        activo: true
      }])

    if (userErr) {
      console.warn('Aviso al crear admin de negocio:', userErr.message)
    }

    console.log('🎉 Nuevo negocio creado por SuperAdmin:', negocio.nombre, negocio.slug)
    res.json({ ok: true, negocio })
  } catch (err) {
    console.error('Error creando negocio desde SuperAdmin:', err)
    res.status(500).json({ error: 'Error al crear el negocio' })
  }
})

// Activar/Desactivar o Actualizar Negocio
app.put('/api/superadmin/negocios/:id', requireSuperAdmin, async (req, res) => {
  const {
    nombre,
    slug,
    plan,
    activo,
    modo_prueba,
    monto_sena,
    precio_mensual,
    estado_suscripcion,
    dia_vencimiento,
    email_contacto,
    telefono,
    dni,
    direccion,
    mp_access_token
  } = req.body

  try {
    const updateData = {}
    if (nombre !== undefined) updateData.nombre = nombre
    if (slug !== undefined) updateData.slug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-')
    if (plan !== undefined) updateData.plan = plan
    if (activo !== undefined) updateData.activo = activo
    if (modo_prueba !== undefined) updateData.modo_prueba = modo_prueba
    if (monto_sena !== undefined) updateData.monto_sena = Number(monto_sena)
    if (precio_mensual !== undefined) updateData.precio_mensual = Number(precio_mensual)
    if (estado_suscripcion !== undefined) updateData.estado_suscripcion = estado_suscripcion
    if (dia_vencimiento !== undefined) updateData.dia_vencimiento = Number(dia_vencimiento)
    if (email_contacto !== undefined) updateData.email_contacto = email_contacto
    if (telefono !== undefined) updateData.telefono = telefono || null
    if (dni !== undefined) updateData.dni = dni || null
    if (direccion !== undefined) updateData.direccion = direccion || null
    if (mp_access_token !== undefined) updateData.mp_access_token = mp_access_token ? mp_access_token.trim() : null

    let { error } = await supabase
      .from('negocios')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.warn('Aviso update negocios fallback:', error.message)
      delete updateData.telefono
      delete updateData.dni
      delete updateData.direccion
      delete updateData.precio_mensual
      delete updateData.dia_vencimiento
      delete updateData.estado_suscripcion
      const retry = await supabase.from('negocios').update(updateData).eq('id', id)
      if (retry.error) return res.status(500).json({ error: retry.error.message })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar negocio' })
  }
})

// ============================
// COBRANZAS SAAS: REGISTRO DE PAGOS DE MENSUALIDADES
// ============================
// Listar historial de pagos de mensualidades
app.get('/api/superadmin/suscripciones/pagos', requireSuperAdmin, async (req, res) => {
  const { negocio_id } = req.query

  try {
    let query = supabase
      .from('pagos_suscripcion')
      .select('id, negocio_id, mes, monto, fecha_pago, metodo, comprobante, notas, estado, created_at, negocios(id, nombre, slug)')
      .order('fecha_pago', { ascending: false })

    if (negocio_id) {
      query = query.eq('negocio_id', negocio_id)
    }

    const { data, error } = await query

    if (error) {
      // Fallback si la tabla aún no se creó
      return res.json([])
    }

    res.json(data || [])
  } catch (err) {
    console.error('Error listando pagos de suscripción:', err)
    res.status(500).json({ error: 'Error al listar pagos' })
  }
})

// Registrar Cobro de Mensualidad a un Negocio
app.post('/api/superadmin/suscripciones/pagar', requireSuperAdmin, async (req, res) => {
  const { negocio_id, mes, monto, metodo, comprobante, notas } = req.body

  if (!negocio_id || !monto) {
    return res.status(400).json({ error: 'negocio_id y monto son requeridos' })
  }

  const mesFinal = mes || new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())

  try {
    // 1. Insertar comprobante de pago
    const { data: pago, error: pErr } = await supabase
      .from('pagos_suscripcion')
      .insert([{
        negocio_id,
        mes: mesFinal,
        monto: Number(monto),
        metodo: metodo || 'Transferencia',
        comprobante: comprobante || null,
        notas: notas || null,
        estado: 'pagado'
      }])
      .select()
      .single()

    if (pErr) {
      console.warn('Aviso al insertar pago suscripcion:', pErr.message)
    }

    // 2. Actualizar estado del negocio a "al_dia" y fecha de ultimo pago
    await supabase
      .from('negocios')
      .update({
        estado_suscripcion: 'al_dia',
        ultimo_pago: new Date().toISOString()
      })
      .eq('id', negocio_id)

    res.json({ ok: true, pago, mensaje: `Cobro de ${mesFinal} registrado exitosamente` })
  } catch (err) {
    console.error('Error registrando pago de mensualidad:', err)
    res.status(500).json({ error: 'Error al registrar cobro' })
  }
})

// Eliminar Negocio
app.delete('/api/superadmin/negocios/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const { error } = await supabase.from('negocios').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar negocio' })
  }
})

// Explorador Global de Reservas
app.get('/api/superadmin/reservas', requireSuperAdmin, async (req, res) => {
  const { negocio_id } = req.query

  try {
    let query = supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: false })

    if (negocio_id) {
      query = query.eq('negocio_id', negocio_id)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Error al listar reservas globales' })
  }
})

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3000
const server = app.listen(PORT, () =>
  console.log(`🚀 Backend Multi-Tenant activo en puerto ${PORT}`)
).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: El puerto ${PORT} ya está siendo utilizado por otra instancia de Node.`)
    console.error(`💡 Para liberarlo en PowerShell ejecuta:\n   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`)
  } else {
    console.error('❌ Error al iniciar servidor:', err)
  }
})

export { app, server }

