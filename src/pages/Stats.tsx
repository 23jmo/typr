import React from "react";
import Header from "../components/Header";
import { useUser } from "../contexts/UserContext";
import PerformanceGraph from "../components/ranked/PerformanceGraph";
import StatCard from "../components/StatCard";
import RaceDistribution from "../components/RaceDistribution";
import RecentRacesTable from "../components/RecentRacesTable";
import UserHeader from "../components/UserHeader";
import SectionWrapper from "../components/SectionWrapper";
import UserRankDisplay from "../components/UserRankDisplay";

/**
 * Stats page for displaying user statistics
 * This includes overall stats, ranked stats, and performance data
 * Fully responsive design with mobile optimizations
 */
const Stats: React.FC = () => {
  const { userData, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#323437]">
        <Header />
        <div className="container mx-auto px-4">
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
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-[calc(100vh-100px)]">
            <div className="text-[#d1d0c5] text-lg">
              Please log in to view your stats
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format date for user join date
  const formatJoinDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };
  
  // Get recent matches data
  const recentMatches = userData?.recentMatches || [];

  // Generate WPM Distribution data from recentMatches
  const generateWpmDistribution = () => {
    if (!recentMatches || recentMatches.length === 0) return [];
    
    const wpmRanges = [
      { range: "60-70", min: 60, max: 70, count: 0 },
      { range: "70-80", min: 70, max: 80, count: 0 },
      { range: "80-90", min: 80, max: 90, count: 0 },
      { range: "90-100", min: 90, max: 100, count: 0 },
      { range: "100-110", min: 100, max: 110, count: 0 },
      { range: "110-120", min: 110, max: 120, count: 0 },
      { range: "120+", min: 120, max: Infinity, count: 0 },
    ];
    
    recentMatches.forEach((match) => {
      const wpm = match.userWpm;
      const matchingRange = wpmRanges.find(
        (range) => wpm >= range.min && wpm < range.max
      );
      if (matchingRange) {
        matchingRange.count++;
      }
    });
    
    return wpmRanges;
  };
  
  const wpmDistribution = generateWpmDistribution();
  
  // Create match data for table
  const getRecentMatchesTableData = () => {
    if (!recentMatches || recentMatches.length === 0) return [];
    
    return recentMatches.slice(0, 5).map((match) => ({
      date: new Date(match.timestamp).toLocaleDateString(),
      time: new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      wpm: match.userWpm,
      accuracy: match.accuracy || 0,
      position: match.isWin ? "1st of 2" : "2nd of 2",
    }));
  };
  
  const recentMatchesTableData = getRecentMatchesTableData();

  // Format join date
  const joinDate = formatJoinDate(userData.createdAt);

  // Icons for stat cards
  const noteIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="8" y1="12" x2="16" y2="12"></line>
      <line x1="8" y1="16" x2="16" y2="16"></line>
      <line x1="8" y1="8" x2="16" y2="8"></line>
    </svg>
  );
  
  const starIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );
  
  const checkIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
  
  const clockIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#323437]">
      <Header />
      <div className="container mx-auto px-3 sm:px-4 pt-10 sm:pt-10 pb-16 sm:pb-24 overflow-x-hidden">
        {/* User info header */}
        <UserHeader 
          username={userData.username || "User"} 
          joinDate={joinDate}
          photoURL={userData.photoURL}
        />
        
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Average WPM */}
          <StatCard 
            title="Average WPM"
            value={userData.stats?.overall?.averageWPM || 0}
            change="+2.5% from last month"
            isPositive={true}
            icon={noteIcon}
          />
          
          {/* Highest WPM */}
          <StatCard 
            title="Highest WPM"
            value={userData.stats?.overall?.bestWPM || 0}
            additionalInfo="Achieved on May 12, 2023"
            icon={starIcon}
          />
          
          {/* Accuracy */}
          <StatCard 
            title="Accuracy"
            value={`${(userData.stats?.overall?.averageAccuracy || 0).toFixed(1)}%`}
            change="+0.7% from last month"
            isPositive={true}
            icon={checkIcon}
          />
          
          {/* Total Races */}
          <StatCard 
            title="Total Races"
            value={userData.stats?.overall?.gamesPlayed || 0}
            change="+24 races this month"
            isPositive={true}
            icon={clockIcon}
          />
        </div>
        
        {/* Two Column Layout for Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* WPM Over Time */}
          <SectionWrapper 
            title="Performance Graph"
            subtitle="Your typing speed over time"
          >
            <div className="h-[250px] sm:h-[350px]">
              <PerformanceGraph 
                matches={recentMatches.map(match => ({
                  opponent: match.opponentName,
                  timeAgo: new Date(match.timestamp).toLocaleDateString(),
                  userWpm: match.userWpm,
                  opponentWpm: match.opponentWpm,
                  isWin: match.isWin,
                  eloChange: match.eloChange,
                  accuracy: match.accuracy
                }))} 
              />
            </div>
          </SectionWrapper>
          
          {/* Race Distribution */}
          <SectionWrapper 
            title="Race Distribution" 
            subtitle="Distribution of your typing speeds across all races"
          >
            <div className="h-[250px] sm:h-[350px]">
              <RaceDistribution wpmRanges={wpmDistribution} />
            </div>
          </SectionWrapper>
        </div>
        
        {/* Recent Races Table and Rank */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mt-4 sm:mt-8">
          {/* Recent Races Table - Takes 2/3 of the grid */}
          <div className="lg:col-span-2">
            <SectionWrapper 
              title="Recent Races" 
              subtitle="Your most recent typing races and performance"
            >
              <RecentRacesTable races={recentMatchesTableData} />
            </SectionWrapper>
          </div>
          
          {/* User Rank Card - Takes 1/3 of the grid */}
          <div>
            <UserRankDisplay />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
