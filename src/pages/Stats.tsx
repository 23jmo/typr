import OverallStats from '../components/OverallStats'
import RankedStats from '../components/RankedStats'
import { useUser } from '../contexts/UserContext'
import { useEffect } from 'react'

const Stats = () => {
  const { refreshUserData } = useUser()
  
  useEffect(() => {
    refreshUserData()
  }, [])

  return (
    <div>
      <OverallStats />
      <RankedStats />
    </div>
  )
}

export default Stats
