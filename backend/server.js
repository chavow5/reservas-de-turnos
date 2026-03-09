import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

console.log("🔥 SERVER ACTIVADO 🔥")
// console.log("MP TOKEN:", process.env.MP_ACCESS_TOKEN)

// Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
})

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)


// ============================
// CREATE PREFERENCE
// ============================

app.post('/create-preference', async (req, res) => {
  try {

    const { nombre, fecha, hora, cancha } = req.body
    const canchaFinal = cancha || '1'

    if (!nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    console.log("BODY:", req.body)

    // ID único para correlacionar el pago con la base de datos
    const externalReference = `RES-${Date.now()}`

    const preference = new Preference(mpClient)

    const response = await preference.create({
      body: {

        external_reference: externalReference,

        items: [
          {
            title: `Reserva Cancha ${canchaFinal} ${hora}hs`,
            description: `Reserva de cancha ${canchaFinal} el ${fecha} a las ${hora} hs`,
            category_id: "sports",
            quantity: 1,
            unit_price: 100,
            currency_id: "ARS"
          }
        ],

        statement_descriptor: "Reserva Futbol",

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

    console.log("✅ Preference de Mercado Pago creada")
    console.log("INIT POINT:", response.init_point)
    console.log("External Reference:", externalReference)

    res.json({ 
      init_point: response.init_point,
      external_reference: externalReference
    })

  } catch (error) {
    console.error("❌ ERROR COMPLETO:", error)
    res.status(500).json({ message: error.message })
  }
})

// ============================
// WEBHOOK
// ============================

app.post('/webhook', async (req, res) => {
  try {

    console.log('📩 Webhook recibido:', req.body)

    // MercadoPago envía muchos eventos
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

    console.log('📅 Intento de reserva:', fecha, hora, canchaFinal)

    // 🔎 BUSCAR SI YA EXISTE
    const { data: existing, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', canchaFinal)

    if (error) {
      console.error('Error consultando reservas:', error)
      return res.sendStatus(500)
    }

    // ❌ YA EXISTE
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

app.listen(3000, () =>
  console.log('🚀 Backend Mercado Pago activo en puerto 3000')
)

