import { useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'

const Home = () => {
  const navigate = useNavigate()
  const { userData } = useUser()

  const createGame = () => {
    const roomId = Math.random().toString(36).substring(2, 8)
    navigate(`/race/${roomId}`)
  }

  return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-4xl font-bold mb-8 text-center">Welcome, {userData?.username}!</h1>
          <button
            onClick={createGame}
            className="w-full p-2 rounded bg-[#e2b714] text-[#323437] cursor-pointer font-medium hover:bg-[#e2b714]/90 transition-colors"
          >
            Start Game
          </button>
        </div>
      </div>
  )
}

export default Home 