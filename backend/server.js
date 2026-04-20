import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const app = express()

// ============================
// CORS — solo orígenes permitidos
// ============================
const allowedOrigins = [
  'https://reservas-de-turnos.vercel.app',
  'http://localhost:5173'
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS: Origen no permitido'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.use(express.json())

console.log('🔥 SERVER ACTIVADO 🔥')


// ============================
// CLIENTES EXTERNOS
// ============================

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'

// PRECIO DE LA RESERVA
const PRECIO_RESERVA = 100  // Modificar el valor para cambiar el precio de la reserva

// ============================
// KEEP-ALIVE — Supabase (cada 4 días)
// Previene que la base de datos entre en pausa por inactividad
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
// HEALTH CHECK
// También se usa desde cron-job.org para mantener Render y Supabase activos
// ============================
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
// MIDDLEWARE — Verificar JWT Admin
// ============================
const verifyAdmin = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  const token = auth.split(' ')[1]
  try {
    req.admin = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// ============================
// ADMIN LOGIN
// La contraseña se valida contra la variable de entorno ADMIN_PASSWORD (privada del backend)
// ============================
app.post('/admin/login', (req, res) => {
  const { password } = req.body
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

  if (!ADMIN_PASSWORD) {
    console.error('❌ ADMIN_PASSWORD no configurada en las variables de entorno')
    return res.status(500).json({ error: 'Admin no configurado en el servidor' })
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' })
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' })
  console.log('✅ Admin login exitoso')
  res.json({ token })
})

// ============================
// ADMIN — Reservas (protegidas con JWT)
// Create preference
// ============================

// GET — todas las reservas
app.get('/admin/reservas', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Error obteniendo reservas:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
})

// POST — crear una reserva manualmente
app.post('/admin/reservas', verifyAdmin, async (req, res) => {
  const { nombre, fecha, hora, cancha, pagado } = req.body
  const canchaFinal = cancha || '1'

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

  const { error } = await supabase
    .from('reservas')
    .insert([{
      nombre,
      fecha,
      hora,
      cancha: canchaFinal,
      pagado: pagado || false,
      payment_id: 'admin_manual_' + Date.now()
    }])

  if (error) {
    console.error('Error creando reserva admin:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

// PUT — actualizar una reserva
app.put('/admin/reservas/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params
  const { nombre, fecha, hora, cancha, pagado } = req.body
  const canchaFinal = cancha || '1'

  const { data: existing, error: errCheck } = await supabase
    .from('reservas')
    .select('id')
    .eq('fecha', fecha)
    .eq('hora', hora)
    .eq('cancha', canchaFinal)
    .neq('id', id)
    .limit(1)

  if (errCheck) {
    console.error('Error verificando disponibilidad:', errCheck)
    return res.status(500).json({ error: errCheck.message })
  }

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: 'El turno ya se encuentra ocupado para esa fecha, hora y cancha.' })
  }

  const { error } = await supabase
    .from('reservas')
    .update({ nombre, fecha, hora, cancha: canchaFinal, pagado })
    .eq('id', id)

  if (error) {
    console.error('Error actualizando reserva:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

// DELETE — eliminar una reserva
app.delete('/admin/reservas/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('reservas')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error eliminando reserva:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json({ ok: true })
})

// ============================
// CREATE PREFERENCE — MercadoPago
// ============================
app.post('/create-preference', async (req, res) => {
  try {

    const { nombre, fecha, hora, cancha } = req.body
    const canchaFinal = cancha || '1'

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    const externalReference = `RES-${Date.now()}`
    const preference = new Preference(mpClient)

    const response = await preference.create({
      body: {
        external_reference: externalReference,
        items: [
          {
            title: `Reserva Cancha ${canchaFinal} ${hora}hs`,
            description: `Reserva de cancha ${canchaFinal} el ${fecha} a las ${hora} hs`,
            category_id: 'sports',
            quantity: 1,
            unit_price: PRECIO_RESERVA,
            currency_id: 'ARS'
          }
        ],
        statement_descriptor: 'Reserva Futbol',
        metadata: {
          nombre,
          cancha: canchaFinal,
          fecha,
          hora,
          external_reference: externalReference
        },
        back_urls: {
          success: `https://reservas-de-turnos.vercel.app/success?nombre=${encodeURIComponent(nombre)}&fecha=${fecha}&hora=${hora}&cancha=${canchaFinal}`,
          failure: 'https://reservas-de-turnos.vercel.app',
          pending: 'https://reservas-de-turnos.vercel.app'
        },
        auto_return: 'approved',
        notification_url: 'https://reservas-de-turnos.onrender.com/webhook'
      }
    })

    console.log('✅ Preference creada — Ref:', externalReference)
    res.json({
      init_point: response.init_point,
      external_reference: externalReference
    })
  } catch (error) {
    console.error('❌ Error create-preference:', error)
    res.status(500).json({ message: error.message })
  }
})

// ============================
// WEBHOOK — MercadoPago
// ============================

// Verificar firma del webhook de MercadoPago
// Requiere que MP_WEBHOOK_SECRET esté configurado en las variables de entorno
// (se obtiene en el panel de MercadoPago → Webhooks → ver secreto)
const verifyMPSignature = (req) => {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Si no está configurado, logueamos advertencia pero no bloqueamos
    console.warn('⚠️ MP_WEBHOOK_SECRET no configurado — saltando verificación de firma')
    return true
  }

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
      console.warn('⚠️ Firma de webhook inválida — request rechazado')
      return res.sendStatus(401)
    }

    if (req.body.type !== 'payment') {
      return res.sendStatus(200)
    }

    const paymentId = req.body.data?.id
    if (!paymentId) return res.sendStatus(200)

    const payment = new Payment(mpClient)
    const mpPayment = await payment.get({ id: paymentId })

    console.log('💰 Estado del pago:', mpPayment.status)

    if (mpPayment.status !== 'approved') {
      return res.sendStatus(200)
    }

    const { nombre, fecha, hora, cancha } = mpPayment.metadata
    const canchaFinal = cancha || '1'

    console.log('📅 Intento de reserva:', nombre, fecha, hora, canchaFinal)

    // Verificar si ya existe (prevenir doble reserva)
    const { data: existing, error } = await supabase
      .from('reservas')
      .select('id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)
      .limit(1)

    if (error) {
      console.error('Error consultando reservas:', error)
      return res.sendStatus(500)
    }

    if (existing.length > 0) {

      console.log('⚠️ Doble reserva detectada')

      // OPCIONAL: podrías devolver el dinero automáticamente
      // (lo podemos hacer después)

      return res.sendStatus(200)
    }

    // ✅ CREAR RESERVA
    const { error: insertError } = await supabase
      .from('reservas')
      .insert([
        {
          nombre,
          fecha,
          hora,
          cancha: canchaFinal,
          pagado: true,
          payment_id: paymentId
        }
      ])

    if (insertError) {
      console.error('Error insertando reserva:', insertError)
      return res.sendStatus(500)
    }

    console.log('✅ Reserva creada correctamente')

    res.sendStatus(200)

  } catch (error) {

    console.error('Webhook error:', error)
    res.sendStatus(500)

  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () =>
  console.log(`🚀 Backend Mercado Pago activo en puerto ${PORT}`)
)

