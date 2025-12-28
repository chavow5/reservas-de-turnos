import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReservaTurno from './components/ReservaTurno'
import Admin from './pages/Admin'
import Success from './pages/Success'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<><ReservaTurno /><Admin /></>} />
                <Route path="/success" element={<Success />} />
            </Routes>
        </BrowserRouter>
    )
}
