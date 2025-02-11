import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/firebase'
import UsernamePrompt from '../components/UsernamePrompt'
import { useUser } from '../contexts/UserContext'

const SignIn = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false)
  const navigate = useNavigate()
  const { refreshUserData } = useUser()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      if (isSignUp) {
        const { needsUsername } = await authService.signUpWithEmail(email, password)
        if (needsUsername) {
          setShowUsernamePrompt(true)
        } else {
          navigate('/')
        }
      } else {
        const { needsUsername } = await authService.signInWithEmail(email, password)
        await refreshUserData()
        if (needsUsername) {
          setShowUsernamePrompt(true)
        } else {
          navigate('/')
        }
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const { needsUsername } = await authService.signInWithGoogle()
      if (needsUsername) {
        setShowUsernamePrompt(true)
      } else {
        navigate('/')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#323437]">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-4xl font-bold text-center text-[#d1d0c5]">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h1>
          
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-100/10 rounded">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            className="w-full p-2 rounded bg-white text-gray-700 font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#646669]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#323437] text-[#646669]">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5] text-[#d1d0c5]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5] text-[#d1d0c5]"
            />
            <button
              type="submit"
              className="w-full p-2 rounded bg-[#e2b714] text-[#323437] font-medium hover:bg-[#e2b714]/90 transition-colors"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-[#d1d0c5] text-sm hover:text-[#e2b714]"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
      {showUsernamePrompt && (
        <UsernamePrompt 
          onComplete={async () => {
            await refreshUserData()
            setShowUsernamePrompt(false)
            navigate('/')
          }}
        />
      )}
    </>
  )
}

export default SignIn
