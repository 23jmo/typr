import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from './services/firebase'
import { UserProvider } from './contexts/UserContext'
import { useUser } from './contexts/UserContext'
import Home from './pages/Home'
import RaceRoom from './pages/RaceRoom'
import SignIn from './pages/SignIn'
import Header from './components/Header'
import { useEffect } from 'react'
// Add global styles
import './index.css'  // Create this if it doesn't exist
import Stats from './pages/Stats'
import CustomRoom from './pages/CustomRoom'
import Solo from './pages/Solo'
import Ranked from './pages/Ranked'
// Create a separate component for the routes
const AppRoutes = () => {
  const [user, loading] = useAuthState(auth)
  const { userData, refreshUserData,loading: userDataLoading } = useUser()

  useEffect(() => {
    if (user) {
      console.log('user is logged in')  
      refreshUserData()
    }
  }, [user])

  if (loading || userDataLoading) {
    return <div className="min-h-screen bg-[#323437] text-[#d1d0c5] flex items-center justify-center">Loading...</div>
  }

  // User is not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/signin" />} />
      </Routes>
    )
  }

  // User is logged in but needs username
  if (!userData?.username) {
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/signin" />} />
      </Routes>
    )
  }

  // User is fully authenticated with username
  return (
    <>
      <Header />
      <div className="pt-14">
        <Routes>
          <Route path="/signin" element={<Navigate to="/" />} />
          <Route path="/" element={<Home />} />
          <Route path="/custom" element={<CustomRoom />} />
          <Route path="/ranked" element={<Ranked />} />
          <Route path="/solo" element={<Solo />} />
          <Route path="/race/:roomId" element={<RaceRoom />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  )
}

// Main App component
function App() {
  useEffect(() => {
    // Set background color on html and body elements
    document.documentElement.style.backgroundColor = '#323437'
    document.body.style.backgroundColor = '#323437'
    
    return () => {
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
    }
  }, [])

  return (
    <UserProvider>
      <Router>
        <div className="min-h-screen bg-[#323437] text-[#d1d0c5]">
          <AppRoutes />
        </div>
      </Router>
    </UserProvider>
  )
}

export default App
