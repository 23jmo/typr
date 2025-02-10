import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RaceRoom from './pages/RaceRoom'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#323437] text-[#d1d0c5]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/race/:roomId" element={<RaceRoom />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
