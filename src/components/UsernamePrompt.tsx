import { useState } from 'react'
import { userService, auth } from '../services/firebase'

interface UsernamePromptProps {
  onComplete: () => void
}

const UsernamePrompt = ({ onComplete }: UsernamePromptProps) => {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      console.log('[UsernamePrompt] Starting username submission')
      if (!auth.currentUser) {
        console.error('[UsernamePrompt] No authenticated user found')
        throw new Error('Not authenticated')
      }

      console.log('[UsernamePrompt] Current user:', auth.currentUser.uid)
      console.log('[UsernamePrompt] Attempting to set username:', username)

      if (username.length < 3 || username.length > 15) {
        throw new Error('Username must be between 3 and 15 characters')
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores')
      }

      console.log('[UsernamePrompt] Checking username availability')
      const isAvailable = await userService.isUsernameAvailable(username)
      if (!isAvailable) {
        throw new Error('Username is already taken')
      }

      console.log('[UsernamePrompt] Username available, updating...')
      await userService.updateUsername(username)
      console.log('[UsernamePrompt] Username update successful')
      onComplete()
    } catch (err: any) {
      console.error('[UsernamePrompt] Error:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#323437] bg-opacity-95 flex items-center justify-center p-4 z-50">
      <div className="bg-[#2c2e31] p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold text-[#d1d0c5] mb-4">Choose your username</h2>
        
        {error && (
          <div className="p-3 mb-4 text-sm text-red-500 bg-red-100/10 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="Enter username"
            className="w-full p-2 rounded bg-[#323437] border border-[#646669] focus:outline-none focus:border-[#d1d0c5] text-[#d1d0c5]"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="w-full p-2 rounded bg-[#e2b714] text-[#323437] font-medium hover:bg-[#e2b714]/90 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UsernamePrompt 