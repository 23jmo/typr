import React from "react";

interface RaceEntry {
  date: string;
  time: string;
  wpm: number;
  accuracy: number;
  position: string;
}

interface RecentRacesTableProps {
  races: RaceEntry[];
  loading?: boolean;
}

/**
 * Displays a table of recent races with details like date, WPM, accuracy, and position
 */
const RecentRacesTable: React.FC<RecentRacesTableProps> = ({ 
  races, 
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-[#646669]">Loading your race history...</p>
      </div>
    );
  }

  if (!races || races.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-[#646669]">No recent races found. Start typing to see your performance!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-[#444444]">
            <th className="py-2 text-[#646669] font-normal text-left w-1/4">Date</th>
            <th className="py-2 text-[#646669] font-normal text-center w-1/4">WPM</th>
            <th className="py-2 text-[#646669] font-normal text-center w-1/4">Accuracy</th>
            <th className="py-2 text-[#646669] font-normal text-right w-1/4">Position</th>
          </tr>
        </thead>
        <tbody>
          {races.map((race, index) => (
            <tr key={index} className="border-b border-[#444444]">
              <td className="py-4 text-left">
                <div className="text-[#d1d0c5]">{race.date}</div>
                <div className="text-[#646669] text-sm">{race.time}</div>
              </td>
              <td className="py-4 text-[#d1d0c5] text-center">{race.wpm}</td>
              <td className="py-4 text-[#d1d0c5] text-center">{race.accuracy.toFixed(1)}%</td>
              <td className="py-4 text-[#d1d0c5] text-right">{race.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentRacesTable; 