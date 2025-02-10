import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Home = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')

  const createGame = () => {
    if (!username) return
    const roomId = Math.random().toString(36).substring(2, 8)
    navigate(`/race/${roomId}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Typr</h1>
      <div className="w-full max-w-md space-y-4">
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5]"
        />
        <button
          onClick={createGame}
          className="w-full p-2 rounded bg-[#e2b714] text-[#323437] font-medium hover:bg-[#e2b714]/90 transition-colors"
        >
          Create Game
        </button>
      </div>
    </div>
  )
}

export default Home 