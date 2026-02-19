import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

// Mercado Pago client
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
})

// Supabase (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

// CREATE PREFERENCE
app.post('/create-preference', async (req, res) => {
  try {
    const { reservaId } = req.body
    if (!reservaId) {
      return res.status(400).json({ error: 'reservaId requerido' })
    }

    const preference = new Preference(mpClient)

    const response = await preference.create({
      body: {
        items: [
          {
            title: 'Reserva de turno',
            quantity: 1,
            unit_price: 100
          }
        ],
        metadata: { reservaId },
        back_urls: {
          success: 'http://localhost:5173/success'
        },
        notification_url: 'http://localhost:3000/webhook'
      }
    })

    res.json({ init_point: response.init_point })
  } catch (error) {
    console.error('MP create-preference error:', error)
    res.status(500).json({ error: error.message })
  }
})



// WEBHOOK
app.post('/webhook', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id
    if (!paymentId) return res.sendStatus(200)

    const payment = new Payment(mpClient)
    const mpPayment = await payment.get({ id: paymentId })

    if (mpPayment.status === 'approved') {
      await supabase
        .from('reservas')
        .update({ pagado: true })
        .eq('id', mpPayment.metadata.reservaId)
    }

    res.sendStatus(200)
  } catch (error) {
    console.error('Webhook error:', error)
    res.sendStatus(500)
  }
})

app.listen(3000, () =>
  console.log('✅ Backend Mercado Pago activo')
)
