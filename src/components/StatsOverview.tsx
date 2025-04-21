import WpmGraph from "./WpmGraph";

interface StatsOverviewProps {
  wpm: number;
  accuracy: number;
  startTime: number | null;
  wpmHistory: Array<{ wpm: number; time: number }>;
  charStats: {
    correct: number;
    incorrect: number;
    extra: number;
    missed: number;
  };
}

const preprocessWpmHistory = (
  wpmHistory: Array<{ wpm: number; time: number }>
) => {
  // clear all points where time is 0
  // clear all points where wpm is not a number

  return wpmHistory.filter((point) => point.time !== 0 && !isNaN(point.wpm));
};

const StatsOverview = ({
  wpm,
  accuracy,
  startTime,
  wpmHistory,
  charStats,
}: StatsOverviewProps) => {
  
  wpmHistory = preprocessWpmHistory(wpmHistory);
  // Calculate character stats
  const calculateCharStats = () => {
    const { correct, incorrect, extra, missed } = charStats;

    return `${correct}/${incorrect}/${extra}/${missed}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Main Stats - Side by side with proper spacing */}
      <div className="flex items-baseline gap-12 mb-8">
        <div className="flex items-baseline gap-2">
          <div className="text-[#e2b714] text-7xl font-bold">{wpm}</div>
          <div className="text-[#646669] text-xl">wpm</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-[#e2b714] text-7xl font-bold">{accuracy}%</div>
          <div className="text-[#646669] text-xl">acc</div>
        </div>
      </div>

      {/* Test Info - More compact grid */}
      <div className="grid grid-cols-4 gap-12 mb-6 text-left">
        <div>
          <div className="text-[#646669] text-sm mb-1">test type</div>
          <div className="text-[#e2b714] text-sm">
            words{" "}
            {Math.round(
              wpm * ((Date.now() - (startTime || Date.now())) / 1000 / 60)
            )}
          </div>
          <div className="text-[#e2b714] text-sm">english</div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">raw</div>
          <div className="text-[#e2b714] text-xl">
            {Math.round(wpm * (accuracy / 100))}
          </div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">characters</div>
          <div className="text-[#e2b714] text-xl">{calculateCharStats()}</div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">time</div>
          <div className="text-[#e2b714] text-xl">
            {((Date.now() - (startTime || Date.now())) / 1000).toFixed(0)}s
          </div>
        </div>
      </div>

      {/* Graph */}
      <WpmGraph
        wpm={wpm}
        wpmHistory={wpmHistory}
      />
    </div>
  );
};

export default StatsOverview;
