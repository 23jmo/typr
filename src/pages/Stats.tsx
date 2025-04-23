import React from "react";
import Header from "../components/Header";
import OverallStats from "../components/OverallStats";
import RankedStats from "../components/RankedStats";
import UserStatsSummaryCard from "../components/ranked/page/UserStatsSummaryCard";
import UserRankCard from "../components/ranked/page/UserRankCard";
import PerformanceSection from "../components/ranked/page/PerformanceSection";
import { useUser } from "../contexts/UserContext";

/**
 * Stats page for displaying user statistics
 * This includes overall stats, ranked stats, and performance data
 */
const Stats: React.FC = () => {
  const { userData, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#323437]">
        <Header />
        <div className="container mx-auto">
          <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-[#d1d0c5] text-lg">Loading your stats...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-[#323437]">
        <Header />
        <div className="container mx-auto">
          <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-[#d1d0c5] text-lg">
              Please log in to view your stats
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#323437]">
      <Header />
      <div className="container mx-auto pt-20 pb-24">
        <OverallStats />
        {/* Overview Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4 text-[#d1d0c5]">Overview</h2>
          <UserStatsSummaryCard />
          <UserRankCard />
        </section>

        {/* Stats Details Section */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold mb-4 text-[#d1d0c5]">Details</h2>
          <RankedStats />
        </section>

        {/* Performance Section - Recent Matches and Performance Graph */}
        <PerformanceSection />
      </div>
    </div>
  );
};

export default Stats;
