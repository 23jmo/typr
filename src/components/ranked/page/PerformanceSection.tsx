import React from "react";
import RecentMatchesCard from "./RecentMatchesCard";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useUser } from "../../../contexts/UserContext";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Displays user performance data including recent matches and performance graph
 * Fetches its own data using the useUser hook
 */
const PerformanceSection: React.FC = () => {
  // Get user data from context
  const { userData } = useUser();

  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Create chart data from user's match history
  const chartData = {
    labels: userData?.recentMatches
      ? userData.recentMatches
          .slice()
          .reverse()
          .map((match) => formatDate(match.timestamp || Date.now()))
      : [],
    datasets: [
      {
        label: "WPM",
        data: userData?.recentMatches
          ? userData.recentMatches
              .slice()
              .reverse()
              .map((match) => match.userWpm || 0)
          : [],
        borderColor: "#e2b714",
        backgroundColor: "rgba(226, 183, 20, 0.1)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "ELO",
        data: userData?.recentMatches
          ? (() => {
              let currentElo = userData.stats?.overall?.elo || 1000;
              const eloHistory = [];

              // Calculate ELO at each point in time by going backward through matches
              for (let i = userData.recentMatches.length - 1; i >= 0; i--) {
                eloHistory.push(currentElo);
                currentElo -= userData.recentMatches[i].eloChange || 0;
              }

              return eloHistory.reverse();
            })()
          : [],
        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        tension: 0.3,
        fill: true,
        yAxisID: "y1",
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(100, 102, 105, 0.1)",
        },
        ticks: {
          color: "#d1d0c5",
        },
        title: {
          display: true,
          text: "WPM",
          color: "#e2b714",
        },
      },
      y1: {
        beginAtZero: false,
        position: "right" as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: "#d1d0c5",
        },
        title: {
          display: true,
          text: "ELO",
          color: "#4caf50",
        },
      },
      x: {
        grid: {
          color: "rgba(100, 102, 105, 0.1)",
        },
        ticks: {
          color: "#d1d0c5",
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: "#d1d0c5",
        },
      },
      tooltip: {
        backgroundColor: "#2c2e31",
        titleColor: "#d1d0c5",
        bodyColor: "#d1d0c5",
        borderColor: "#646669",
        borderWidth: 1,
      },
    },
  };

  const hasRecentMatches = !!(
    userData?.recentMatches && userData.recentMatches.length > 0
  );

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold mb-4 text-[#d1d0c5]">Performance</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Matches Card */}
        <RecentMatchesCard />

        {/* Performance Graph */}
        <div className="bg-[#2c2e31] rounded-lg p-6 h-[500px] flex flex-col">
          <h3 className="text-xl font-bold mb-2 text-[#d1d0c5]">
            Performance Graph
          </h3>
          <p className="text-[#646669] mb-4">
            Your WPM and ELO progress over time
          </p>

          <div className="flex-grow">
            {hasRecentMatches ? (
              <Line
                data={chartData}
                options={chartOptions}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-[#646669]">
                  <p className="mb-2">No performance data</p>
                  <p className="text-sm">
                    Play ranked matches to see your progress
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PerformanceSection;
