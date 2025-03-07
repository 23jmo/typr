import React, { useState } from "react";
import { rankedIcons } from "../types/ranks";
import { useUser } from "../contexts/UserContext";
import RankedHomePage from "../components/ranked/RankedHomePage";
import MatchmakingScreen from "../components/ranked/MatchmakingScreen";

const Ranked = () => {
  const [matchMaking, setMatchMaking] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [matchFinished, setMatchFinished] = useState(false);

  const handleFindMatch = () => {
    setMatchMaking(true);
  };

  const handleMatchFound = () => {
    setMatchFound(true);
  };

  const handleMatchFinished = () => {
    setMatchFinished(true);
  };

  return (
    <div>
      {matchMaking ? (
        <MatchmakingScreen />
      ) : (
        <RankedHomePage onMatchmakingStarted={handleFindMatch} />
      )}
    </div>
  );
};

export default Ranked;
