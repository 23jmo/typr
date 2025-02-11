interface StatsOverviewProps {
  wpm: number
  accuracy: number
  startTime: number | null
}

const StatsOverview = ({ wpm, accuracy, startTime }: StatsOverviewProps) => {
  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold text-[#e2b714] mb-8">Race Complete!</h2>
      <div className="space-y-4 mb-10">
        <div className="text-2xl">
          <span className="text-[#646669]">WPM: </span>
          <span className="text-[#d1d0c5]">{wpm}</span>
        </div>
        <div className="text-2xl">
          <span className="text-[#646669]">Accuracy: </span>
          <span className="text-[#d1d0c5]">{accuracy}%</span>
        </div>
        <div className="text-2xl">
          <span className="text-[#646669]">Time: </span>
          <span className="text-[#d1d0c5]">
            {((Date.now() - (startTime || Date.now())) / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  )
}

export default StatsOverview 