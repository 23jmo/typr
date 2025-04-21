import { useUser } from '../contexts/UserContext'

const OverallStats = () => {
  const { userData } = useUser();
  return (
     <div className="max-w-5xl mx-auto p-8 pt-24">
      {/* User Header */}
      <div className="flex items-center gap-4 mb-12">
        <div className="w-16 h-16 rounded-full bg-[#2c2e31] flex items-center justify-center">
          {userData?.photoURL ? (
            <img src={userData.photoURL} alt="Profile" className="w-full h-full rounded-full" />
          ) : (
            <span className="text-2xl text-[#e2b714]">
              {userData?.username?.[0].toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#e2b714]">{userData?.username}</h1>
          <p className="text-[#646669]">Joined {new Date(userData?.createdAt || '').toLocaleDateString()}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tests Info */}
        <div className="bg-[#2c2e31] rounded-lg p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-[#646669] text-sm">tests started</h3>
              <p className="text-3xl text-[#d1d0c5]">{userData?.stats.overall.gamesPlayed || 0}</p>
            </div>
            <div>
              <h3 className="text-[#646669] text-sm">time typing</h3>
              <p className="text-3xl text-[#d1d0c5]">
                {Math.floor((userData?.stats.overall.totalTimePlayed || 0) / 60000)}m {Math.floor(((userData?.stats.overall.totalTimePlayed || 0) % 60000) / 1000)}s
              </p>
            </div>
            <div>
              <h3 className="text-[#646669] text-sm">chars typed</h3>
              <p className="text-3xl text-[#d1d0c5]">{userData?.stats.overall.totalCharactersTyped || 0}</p>
            </div>
          </div>
        </div>

        {/* Speed Info */}
        <div className="bg-[#2c2e31] rounded-lg p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-[#646669] text-sm">average wpm</h3>
              <p className="text-3xl text-[#d1d0c5]">{userData?.stats.overall.averageWPM || 0}</p>
            </div>
            <div>
              <h3 className="text-[#646669] text-sm">best wpm</h3>
              <p className="text-3xl text-[#d1d0c5]">{userData?.stats.overall.bestWPM || 0}</p>
            </div>
            <div>
              <h3 className="text-[#646669] text-sm">accuracy</h3>
              <p className="text-3xl text-[#d1d0c5]">
                {userData?.stats.overall.averageAccuracy || 100}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverallStats
