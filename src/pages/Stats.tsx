import { useUser } from '../contexts/UserContext'

const Stats = () => {
  const { userData } = useUser()
  
  return (
    <div>
      <h1>Stats</h1>
      <h2>{userData?.username}</h2>
      <div>
        <div>
          <h3>WPM: {userData?.stats.overall.averageWPM}</h3>
          <p>Best: {userData?.stats.overall.bestWPM}</p>
          <p>Games: {userData?.stats.overall.gamesPlayed}</p>
        </div>
      </div>
    </div>
  )
}

export default Stats
