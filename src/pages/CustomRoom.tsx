import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { TOPIC_DESCRIPTIONS } from "../constants/topicDescriptions";
import React from "react";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

// Define backend URL (replace with environment variable in production)
const BACKEND_URL = "http://localhost:5001";

const CustomRoom = () => {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams();
  const { userData } = useUser();
  const [roomId, setRoomId] = useState(urlRoomId || "");
  const [tempUsername, setTempUsername] = useState("");
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  
  // State variables for the revamped UI
  const [mode, setMode] = useState<"create" | "join">("create");
  const [textLength, setTextLength] = useState<number>(50);
  const [playerLimit, setPlayerLimit] = useState<number>(5);
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [isRanked, setIsRanked] = useState<boolean>(false);
  const [textSource, setTextSource] = useState<"random" | "topic" | "custom">("random");
  const [selectedTopic, setSelectedTopic] = useState<string>(Object.keys(TOPIC_DESCRIPTIONS)[0]);
  const [customText, setCustomText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-join room if roomId is provided in URL
  useEffect(() => {
    const autoJoinRoom = async () => {
      if (!urlRoomId) return;

      // If no username is set, show the username input
      if (!userData?.username && !tempUsername) {
        console.log("[CustomRoom] URL Room ID provided, but no username. Showing input.");
        setShowUsernameInput(true);
        setMode("join"); // Switch to join mode visually
        setRoomId(urlRoomId); // Pre-fill the join input
        return;
      }

      // Username exists, try to join the room
      console.log("[CustomRoom] URL Room ID provided with username. Attempting auto-join.");
      await joinGame(urlRoomId);
    };

    autoJoinRoom();
  }, [urlRoomId, userData?.username]); // Rerun if username becomes available

  // Effect to handle username input confirmation
  useEffect(() => {
    // If username input was shown and now we have a username (either temp or logged in),
    // and we were trying to auto-join, attempt join again.
    if (!showUsernameInput && urlRoomId && (tempUsername || userData?.username)) {
        // Check if we are in join mode and the roomId matches the URL param
        if (mode === 'join' && roomId === urlRoomId) {
            console.log("[CustomRoom] Username confirmed after input. Retrying auto-join.");
            joinGame(urlRoomId);
        }
    }
  }, [showUsernameInput, tempUsername, userData?.username, urlRoomId, mode, roomId]);

  const createGame = async () => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid;

    if (!username || !userId) {
      setError("You must be logged in or provide a temporary username to create a game.");
      return;
    }

    // Validate custom text if that's the selected source
    if (textSource === "custom" && (!customText || customText.trim().length < 10)) {
      setError("Please enter a custom text with at least 10 characters.");
      return;
    }
    // Validate topic selection
    if (textSource === "topic" && !selectedTopic) {
      setError("Please select a topic.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[CustomRoom] Sending createRoom request to backend...");
      const response = await fetch(`${BACKEND_URL}/api/createRoom`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          userId,
          timeLimit,
          textLength, // Send the requested word count
          playerLimit,
          isRanked,
          textSource,
          selectedTopic: textSource === "topic" ? selectedTopic : undefined,
          customText: textSource === "custom" ? customText : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[CustomRoom] Create room failed:", data);
        throw new Error(data.error || `Failed to create room (${response.status})`);
      }

      const newRoomId = data.roomId;
      console.log("[CustomRoom] Game room created successfully:", newRoomId);
      navigate(`/race/${newRoomId}`);

    } catch (err) {
      console.error("Error creating game room:", err);
      setError((err as Error).message || "Failed to create game room. Please try again.");
      setIsLoading(false);
    }
  };

  const joinGame = async (targetRoomId?: string) => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid; // We don't send userId here, RaceRoom will handle it
    const roomToJoin = targetRoomId || roomId;

    if (!username) { // Only need username check now, userId check happens in RaceRoom
      setError("You must be logged in or provide a temporary username to join a game.");
      // Show input if joining without username and it's not already shown
       if (!showUsernameInput) {
           setShowUsernameInput(true);
       }
      return;
    }

    if (!roomToJoin) {
      setError("Please enter a room ID.");
      return;
    }

    // Ensure room ID is uppercase for consistency if needed (backend generates uppercase)
    const formattedRoomId = roomToJoin.toUpperCase();

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[CustomRoom] Checking room availability: ${formattedRoomId}`);
      const response = await fetch(`${BACKEND_URL}/api/checkRoom/${formattedRoomId}`);
      const data = await response.json();

      if (!response.ok) {
        console.error("[CustomRoom] Check room failed:", data);
        throw new Error(data.error || `Failed to check room (${response.status})`);
      }

      // Room exists and is joinable
      console.log("[CustomRoom] Room available:", formattedRoomId);
      navigate(`/race/${formattedRoomId}`);

    } catch (err) {
      console.error("Error joining game:", err);
      setError((err as Error).message || "Error joining game. Please check the ID and try again.");
      setIsLoading(false);
    }
  };

  // Reusable slider component
  const CustomSlider = ({ 
    value, 
    onChange, 
    min, 
    max, 
    label, 
    unit = "",
    step = 1  // Keep for backward compatibility but won't use it
  }: { 
    value: number; 
    onChange: (value: number) => void; 
    min: number; 
    max: number; 
    label: string; 
    unit?: string;
    step?: number;
  }) => {
    // Use local state to track the value during dragging
    const [localValue, setLocalValue] = React.useState(value);
    
    // Update local value when prop value changes
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);
    
    // Format the display value with appropriate precision
    const formatDisplayValue = (val: number): string => {
      // For values that are effectively integers, show as integers
      if (Math.abs(Math.round(val) - val) < 0.01) {
        return Math.round(val).toString();
      }
      // Otherwise show with 1 decimal place
      return val.toFixed(1);
    };
    
    // Handle slider change - update with exact value
    const handleChange = (val: number | number[]) => {
      const newValue = Array.isArray(val) ? val[0] : val;
      setLocalValue(newValue);
    };
    
    // Handle slider after change - update parent with exact value
    const handleAfterChange = (val: number | number[]) => {
      const newValue = Array.isArray(val) ? val[0] : val;
      onChange(newValue);
    };
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[#d1d0c5] text-lg">{label}: {formatDisplayValue(localValue)}{unit}</label>
        </div>
        <Slider
          min={min}
          max={max}
          value={localValue}
          onChange={handleChange}
          onAfterChange={handleAfterChange}
          railStyle={{ backgroundColor: '#323437', height: 8 }}
          trackStyle={{ backgroundColor: '#e2b714', height: 8 }}
          handleStyle={{
            borderColor: '#e2b714',
            backgroundColor: '#e2b714',
            opacity: 1,
            height: 20,
            width: 20,
            marginTop: -6,
            boxShadow: 'none'
          }}
        />
      </div>
    );
  };

  // Toggle switch component
  const ToggleSwitch = ({ 
    isChecked, 
    onChange, 
    label, 
    description 
  }: { 
    isChecked: boolean; 
    onChange: (checked: boolean) => void; 
    label: string; 
    description?: string;
  }) => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-[#d1d0c5] text-lg">{label}</h3>
        {description && <p className="text-sm text-[#a1a1a1]">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className="relative w-11 h-6 bg-[#323437] rounded-full transition-colors duration-300 ease-in-out flex items-center px-[2px]"
             style={{ backgroundColor: isChecked ? '#e2b714' : '#323437' }}>
          <div 
            className="absolute w-5 h-5 bg-[#d1d0c5] rounded-full shadow-md transition-transform duration-300 ease-in-out"
            style={{ transform: isChecked ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </div>
      </label>
    </div>
  );

  // SVG icons for the mode toggle
  const KeyboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
      <path d="M6 8h.01"></path>
      <path d="M10 8h.01"></path>
      <path d="M14 8h.01"></path>
      <path d="M18 8h.01"></path>
      <path d="M6 12h.01"></path>
      <path d="M10 12h.01"></path>
      <path d="M14 12h.01"></path>
      <path d="M18 12h.01"></path>
      <path d="M6 16h12"></path>
    </svg>
  );

  const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
  );

  // Text type icons
  const RandomTextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9h6l2 6h6l2-6h6"></path>
      <path d="M4 5v14"></path>
      <path d="M20 5v14"></path>
    </svg>
  );

  const TopicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );

  const CustomTextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
  );

  // Text type selector component
  const TextTypeSelector = ({ 
    selectedType, 
    onSelect 
  }: { 
    selectedType: "random" | "topic" | "custom"; 
    onSelect: (type: "random" | "topic" | "custom") => void;
  }) => (
    <div className="grid grid-cols-3 gap-4 mb-4">
      {/* Random Text Box */}
      <div 
        className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
          selectedType === "random" 
            ? "bg-[#232527] border-[#e2b714] border-2 text-[#e2b714]" 
            : "bg-[#323437] hover:bg-[#3c3e41] text-[#d1d0c5] border-2 border-transparent"
        }`}
        onClick={() => onSelect("random")}
      >
        <div className="flex items-center justify-center mb-3 h-8">
          <RandomTextIcon />
        </div>
        <h3 className="text-center font-medium mb-1">Random Text</h3>
        <p className="text-center text-xs text-[#a1a1a1]">Generate random text for typing</p>
      </div>
      
      {/* Topic Selection Box */}
      <div 
        className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
          selectedType === "topic" 
            ? "bg-[#232527] border-[#e2b714] border-2 text-[#e2b714]" 
            : "bg-[#323437] hover:bg-[#3c3e41] text-[#d1d0c5] border-2 border-transparent"
        }`}
        onClick={() => onSelect("topic")}
      >
        <div className="flex items-center justify-center mb-3 h-8">
          <TopicIcon />
        </div>
        <h3 className="text-center font-medium mb-1">Topic Selection</h3>
        <p className="text-center text-xs text-[#a1a1a1]">Choose from predefined topics</p>
      </div>
      
      {/* Custom Text Box */}
      <div 
        className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
          selectedType === "custom" 
            ? "bg-[#232527] border-[#e2b714] border-2 text-[#e2b714]" 
            : "bg-[#323437] hover:bg-[#3c3e41] text-[#d1d0c5] border-2 border-transparent"
        }`}
        onClick={() => onSelect("custom")}
      >
        <div className="flex items-center justify-center mb-3 h-8">
          <CustomTextIcon />
        </div>
        <h3 className="text-center font-medium mb-1">Custom Text</h3>
        <p className="text-center text-xs text-[#a1a1a1]">Use your own custom text</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-[#323437] mt-24 select-none">
      {/* Mode toggle - updated with darker color scheme */}
      <div className="w-full max-w-4xl flex mb-8 bg-[#2c2e31] rounded-lg overflow-hidden">
        <button
          onClick={() => setMode("create")}
          className={`flex-1 py-4 px-6 transition-all duration-200 flex items-center justify-center gap-3 ${
            mode === "create"
              ? "bg-[#232527] text-[#e2b714]"
              : "text-[#646669] hover:text-[#a1a1a1]"
          }`}
        >
          <KeyboardIcon />
          <span className="font-medium">Create Game</span>
        </button>
        <button
          onClick={() => setMode("join")}
          className={`flex-1 py-4 px-6 transition-all duration-200 flex items-center justify-center gap-3 ${
            mode === "join"
              ? "bg-[#232527] text-[#e2b714]"
              : "text-[#646669] hover:text-[#a1a1a1]"
          }`}
        >
          <ShareIcon />
          <span className="font-medium">Join Game</span>
        </button>
      </div>
      
      {/* Username input section - only show when needed */}
      {showUsernameInput && (
        <div className="w-full max-w-4xl bg-[#2c2e31] rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-[#d1d0c5] text-lg mb-2">Enter Username to Continue</h3>
          <p className="text-sm text-[#a1a1a1] mb-3">A username is required to join or create games.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a temporary username"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              className="flex-1 p-3 rounded bg-[#323437] border border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714]"
            />
            <button
              onClick={() => {
                  if (tempUsername.trim()) { // Only continue if a name is entered
                      setShowUsernameInput(false);
                  } else {
                      setError("Please enter a username.");
                  }
               }}
              className="px-4 rounded bg-[#e2b714] text-[#323437] hover:bg-[#e2b714]/90 transition-colors font-medium"
            >
              Continue
            </button>
          </div>
           <p className="text-xs text-[#646669] mt-2">Or <button onClick={() => navigate('/signin')} className="text-[#e2b714] underline">sign in</button> for a permanent username.</p>
        </div>
      )}
      
      {/* Main content card with consistent height */}
      <div className="w-full max-w-4xl bg-[#2c2e31] rounded-lg shadow-lg p-8 transition-all duration-300">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-200 rounded-md flex justify-between items-center">
            <span>{error}</span>
             <button onClick={() => setError(null)} className="text-red-200 hover:text-white">✕</button>
          </div>
        )}
        
        {/* Create game mode */}
        {mode === "create" ? (
          <div>
            <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Create a Custom Game</h2>
            <p className="text-[#a1a1a1] mb-6">Configure your custom typing race and invite friends to join</p>
            
            {/* Player Limit Slider */}
            <CustomSlider
              value={playerLimit}
              onChange={setPlayerLimit}
              min={2}
              max={10}
              step={1}
              label="Player Limit"
            />
            
            {/* Time Limit Slider */}
            <CustomSlider
              value={timeLimit}
              onChange={setTimeLimit}
              min={15}
              max={180}
              step={5}
              label="Time Limit"
              unit=" seconds"
            />
            
            {/* Ranked Game Toggle */}
            {/* <ToggleSwitch
              isChecked={isRanked}
              onChange={setIsRanked}
              label="Ranked Game"
              description="Results will affect player ELO ratings"
            /> */}
            {/* TODO: Re-enable ranked mode toggle once backend logic is implemented */}
            
            {/* Replace Text Type Dropdown with 3-box layout */}
            <div className="mb-6">
              <label className="text-[#d1d0c5] text-lg block mb-2">Text Type</label>
              <TextTypeSelector 
                selectedType={textSource} 
                onSelect={setTextSource} 
              />
              
              {/* Subtle divider */}
              <div className="border-b border-[#3c3e41] my-4"></div>
              
              {/* Content container with conditional rendering */}
              <div className="mb-4 min-h-[200px]"> {/* Add min-height */}
                {textSource === "random" && (
                  <div className="mt-4">
                     <p className="text-[#a1a1a1] mb-4 text-center">A random text passage will be generated by the server.</p>
                      <CustomSlider
                        value={textLength}
                        onChange={setTextLength}
                        min={10} // Min words
                        max={150} // Max words
                        step={5}
                        label="Approx. Text Length"
                        unit=" words"
                      />
                  </div>
                )}
                {textSource === "topic" && (
                  <div className="mt-4">
                     <p className="text-[#a1a1a1] mb-4 text-center">A text passage based on the selected topic will be generated by the server.</p>
                    {/* Text Length Slider for topic selection */}
                    <CustomSlider
                      value={textLength}
                      onChange={setTextLength}
                      min={10} // Min words
                      max={150} // Max words
                      step={5}
                      label="Approx. Text Length"
                      unit=" words"
                    />

                    <label className="text-[#d1d0c5] text-base block mb-2 mt-4">Select Topic</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3"> {/* Responsive grid */}
                      {Object.entries(TOPIC_DESCRIPTIONS).map(([key, description]) => (
                        <div 
                          key={key}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedTopic === key
                              ? "bg-[#232527] border-2 border-[#e2b714] text-[#e2b714]" 
                              : "bg-[#323437] hover:bg-[#3c3e41] text-[#d1d0c5] border-2 border-transparent"
                          }`}
                          onClick={() => setSelectedTopic(key)}
                        >
                           <span className="block text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</span> {/* Capitalize topic */}
                           <span className="block text-xs text-[#a1a1a1]">{description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {textSource === "custom" && (
                  <div className="mt-4">
                     <p className="text-[#a1a1a1] mb-4 text-center">Enter your own text for the race.</p>
                    <label className="text-[#d1d0c5] text-base block mb-2">Custom Text (min 10 chars)</label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Enter your custom text here..."
                      className="w-full p-3 rounded-lg bg-[#323437] border-2 border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714] min-h-[120px] resize-none" // Increased min-height
                    />
                    {/* Character count instead of word count for textarea */}
                    <div className="mt-2 text-right text-sm text-[#a1a1a1]">
                      {customText.length} characters
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Create Game Button */}
            <button
              onClick={createGame}
              disabled={isLoading || showUsernameInput} // Disable if username input is showing
              className={`w-full p-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                isLoading || showUsernameInput
                  ? "bg-[#a08310] text-[#646669] cursor-not-allowed"
                  : "bg-[#e2b714] text-[#323437] hover:bg-[#e2b714]/90"
              }`}
            >
              {isLoading ? "Creating Game..." : "Create Game"}
            </button>
          </div>
        ) : (
          /* Join game mode - updated with smaller text and thinner elements */
          <div>
            <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Join an Existing Game</h2>
            <p className="text-[#a1a1a1] mb-6">Enter a game ID to join a friend's custom type racing game.</p>
            
            <div className="mb-6">
              <label className="text-[#d1d0c5] text-base font-medium block mb-2">Game ID</label>
              <input
                type="text"
                placeholder="ENTER GAME ID (E.G., ABC123)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                 onKeyUp={(e) => { if (e.key === 'Enter') joinGame(); }} // Allow joining with Enter key
                className="w-full p-3 rounded-md bg-[#323437] border border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714] placeholder-[#646669] uppercase text-center tracking-widest" // Added tracking
              />
            </div>
            
            <button
              onClick={() => joinGame()}
              disabled={isLoading || showUsernameInput} // Disable if username input is showing
              className={`w-full py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                isLoading || showUsernameInput
                  ? "bg-[#a08310] text-[#646669] cursor-not-allowed"
                  : "bg-[#e2b714] text-[#323437] hover:bg-[#e2b714]/90"
              }`}
            >
              {isLoading ? "Joining Game..." : "Join Game"}
            </button>

            <div className="mt-8 pt-4 border-t border-[#3c3e41] text-center text-sm text-[#a1a1a1]">
              Game IDs are 6 characters long and are provided by the game creator.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomRoom;

