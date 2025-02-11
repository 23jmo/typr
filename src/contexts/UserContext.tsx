import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { auth, userService } from '../services/firebase'
import { onAuthStateChanged } from 'firebase/auth'

//TODO: fix the stats interface - standardize it within types.tsx
//TODO: show a loading indicator while the user data is loading 


interface UserStats {
  overall: {
    gamesPlayed: number
    averageWPM: number
    bestWPM: number
    // ... other stats
  }
  ranked: {
    gamesPlayed: number
    averageWPM: number
    bestWPM: number
    // ... other stats
  }
}

interface UserContextType {
  userData: {
    uid: string
    email: string | null
    username: string | null
    photoURL: string | null
    stats: UserStats
  } | null
  loading: boolean
  refreshUserData: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userData, setUserData] = useState<UserContextType['userData']>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = async (uid: string) => {
    const data = await userService.getUserByUid(uid)
    if (data) {
      setUserData({
        uid,
        email: data.email,
        username: data.username,
        photoURL: data.photoURL,
        stats: data.stats
      })
    }
  }

  const refreshUserData = async () => {
    if (auth.currentUser) {
      await loadUserData(auth.currentUser.uid)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadUserData(user.uid)
      } else {
        setUserData(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ userData, loading, refreshUserData }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
} 