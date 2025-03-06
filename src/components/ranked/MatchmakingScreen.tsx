import React, { useState, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase";
import { matchmakingService } from "../../services/firebase";

const typingFacts = [
  "The QWERTY keyboard layout was designed to prevent typewriter jams by placing commonly used letter pairs far apart.",
  "The fastest verified typing speed was 216 words per minute, achieved by Stella Pajunas in 1946.",
  "The average typing speed is around 40 words per minute.",
  "Touch typing can increase your typing speed by up to 50%.",
  "The space bar is the most commonly used key, accounting for about 18% of all keystrokes.",
  "The first typing speed test was conducted in 1888.",
  "The world's most expensive keyboard cost over $10,000.",
  "The longest word you can type using only your left hand is 'stewardesses'.",
  "Most people's left hand types about 56% of keyboard strokes.",
  "The practice of typing two spaces after a period became common with monospaced typewriter fonts.",
  "The 'home row' keys (ASDF JKL;) were designed to be the starting position for touch typing.",
  "The first mechanical typewriter was invented in 1867 by Christopher Latham Sholes.",
];

const MatchmakingScreen = () => {
  const { userData } = useUser();
  const navigate = useNavigate();
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [isFactChanging, setIsFactChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userData) return;

    let unsubscribeListener: (() => void) | null = null;

    // Join queue
    console.log("Joining queue");
    const joinQueue = async () => {
      try {
        const existingGameId = await matchmakingService.joinQueue(
          userData.uid,
          userData
        );

        // If user is already in a game, redirect to that game
        if (existingGameId) {
          console.log(`User already in game ${existingGameId}, redirecting...`);
          navigate(`/race/${existingGameId}`);
          return;
        }

        // Listen for match
        unsubscribeListener = onSnapshot(
          doc(db, "users", userData.uid),
          (snapshot) => {
            const data = snapshot.data();
            if (data?.currentGame) {
              navigate(`/race/${data.currentGame}`);
            }
          }
        );
      } catch (error) {
        console.error("Error joining queue:", error);
        setError("Failed to join matchmaking queue. Please try again.");
      }
    };

    joinQueue();

    return () => {
      if (unsubscribeListener) {
        unsubscribeListener();
      }
      if (userData) {
        matchmakingService.leaveQueue(userData.uid);
      }
    };
  }, [userData, navigate]);

  useEffect(() => {
    // Rotate facts every 5 seconds
    const factInterval = setInterval(() => {
      setIsFactChanging(true);
      // Wait for exit animation
      setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % typingFacts.length);
        setIsFactChanging(false);
      }, 500);
    }, 5000);

    // Update search time every second
    const timeInterval = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(factInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-8 mt-20 text-center flex flex-col h-[calc(100vh-200px)]">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500 text-white p-4 rounded-lg mb-8">
          {error}
          <button
            className="ml-4 underline"
            onClick={() => navigate("/")}
          >
            Return to Home
          </button>
        </div>
      )}

      {/* Main Matchmaking Section */}
      <div className="flex-grow flex flex-col items-center justify-center mb-8">
        {/* Loading Animation */}
        <div className="scale-150 mb-8">
          <div className="flex justify-center items-center gap-3">
            <div
              className="w-4 h-4 bg-[#e2b714] rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            ></div>
            <div
              className="w-4 h-4 bg-[#e2b714] rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-4 h-4 bg-[#e2b714] rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>

        <h1 className="text-5xl font-bold text-[#e2b714] mb-4">
          Finding a Match
        </h1>
        <p className="text-2xl text-[#d1d0c5] mb-8">
          Search time: {formatTime(searchTime)}
        </p>

        {/* Progress Bar */}
        <div className="w-96 mb-4">
          <div className="w-full bg-[#323437] rounded-full h-3">
            <div
              className="bg-[#e2b714] h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((searchTime / 30) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        <p className="text-[#646669]">Estimated wait time: ~30 seconds</p>

        {/* Cancel Button */}
        <button
          className="mt-8 px-8 py-3 bg-[#323437] text-[#d1d0c5] rounded-lg hover:bg-[#e2b714] hover:text-[#323437] transition-all duration-200 text-lg"
          onClick={() => {
            matchmakingService.leaveQueue(userData?.uid || "");
            navigate("/");
          }}
        >
          Cancel Queue
        </button>
      </div>

      {/* Did You Know Section - Smaller and at bottom */}
      <div className="bg-[#2c2e31] rounded-lg p-4 opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-[#646669] text-xs mb-2">Did you know?</h3>
        <div className="relative h-[60px] flex items-center justify-center">
          <p
            className={`text-[#d1d0c5] text-sm leading-relaxed absolute w-full transition-all duration-500 ${
              isFactChanging
                ? "opacity-0 transform -translate-y-8"
                : "opacity-100 transform translate-y-0"
            }`}
            key={currentFactIndex}
          >
            {typingFacts[currentFactIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
