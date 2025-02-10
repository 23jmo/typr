import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { getAuth } from 'firebase/auth'
import Home from './pages/Home'
import RaceRoom from './pages/RaceRoom'
import SignIn from './pages/SignIn'
import Header from './components/Header'

function App() {
  const [user, loading] = useAuthState(getAuth())

  if (loading) {
    return <div className="min-h-screen bg-[#323437] text-[#d1d0c5] flex items-center justify-center">Loading...</div>
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#323437] text-[#d1d0c5]">
        {user && <Header />}
        <div className={user ? 'pt-14' : ''}>
          <Routes>
            <Route path="/signin" element={user ? <Navigate to="/" /> : <SignIn />} />
            <Route path="/" element={user ? <Home /> : <Navigate to="/signin" />} />
            <Route path="/race/:roomId" element={user ? <RaceRoom /> : <Navigate to="/signin" />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
