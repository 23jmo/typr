import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { useState, useEffect } from "react";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "../services/firebase";
import { TOPIC_DESCRIPTIONS } from "../constants/topicDescriptions";
import { generateTextByTopic, generateRandomText } from "../utilities/random-text";
import React from "react";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

// Available time limits in seconds
const TIME_LIMITS = [30, 60, 90, 120];

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
        setShowUsernameInput(true);
        setMode("join");
        return;
      }

      // Try to join the room
      await joinGame(urlRoomId);
    };

    autoJoinRoom();
  }, [urlRoomId, userData?.username, tempUsername]);

  const createGame = async () => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid;

    if (!username || !userId) {
      setError("You must be logged in to create a game");
      return;
    }

    // Validate custom text if that's the selected source
    if (textSource === "custom" && (!customText || customText.trim().length < 10)) {
      setError("Please enter a custom text with at least 10 characters");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const db = getFirestore();
      const roomId = Math.random().toString(36).substring(2, 8);

      // Get text based on selected source
      let gameText = "";
      if (textSource === "topic") {
        gameText = await generateTextByTopic(selectedTopic);
      } else if (textSource === "random") {
        gameText = generateRandomText(textLength);
      } else {
        gameText = customText.trim();
      }

      // Create default game name
      const defaultGameName = `${username}'s Race`;

      // Create new room in Firestore
      const roomRef = doc(db, "gameRooms", roomId);
      await setDoc(roomRef, {
        id: roomId,
        name: defaultGameName,
        status: "waiting",
        createdAt: serverTimestamp(),
        timeLimit: timeLimit,
        textLength: textLength,
        playerLimit: playerLimit,
        isRanked: isRanked,
        players: {
          // Use userId as the key instead of username
          [userId]: {
            name: username,
            wpm: 0,
            accuracy: 100,
            progress: 0,
            ready: false,
            connected: true,
            finished: false,
            joinedAt: serverTimestamp(),
          },
        },
        text: gameText,
        textSource: textSource,
        topic: textSource === "topic" ? selectedTopic : null,
      });
      
      console.log("Game room created successfully:", roomId);
      navigate(`/race/${roomId}`);
    } catch (error) {
      console.error("Error creating game room:", error);
      setError("Failed to create game room. Please try again.");
      setIsLoading(false);
    }
  };

  const joinGame = async (targetRoomId?: string) => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid;
    const roomToJoin = targetRoomId || roomId;

    if (!username || !userId) {
      setError("You must be logged in to join a game");
      return;
    }

    if (!roomToJoin) {
      setError("Please enter a room ID");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomToJoin);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        setError("Room not found!");
        setIsLoading(false);
        return;
      }

      const roomData = roomDoc.data();
      
      // Check player limit
      if (Object.keys(roomData.players || {}).length >= (roomData.playerLimit || 2)) {
        setError("Room is full!");
        setIsLoading(false);
        return;
      }

      // Add player to room using userId as the key
      await updateDoc(roomRef, {
        [`players.${userId}`]: {
          name: username,
          wpm: 0,
          accuracy: 100,
          progress: 0,
          ready: false,
          connected: true,
          finished: false,
          joinedAt: serverTimestamp(),
        },
      });

      console.log("Joined game room:", roomToJoin);
      navigate(`/race/${roomToJoin}`);
    } catch (error) {
      console.error("Error joining game:", error);
      setError("Error joining game. Please try again.");
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
          <h3 className="text-[#d1d0c5] text-lg mb-2">Temporary Username</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a username"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              className="flex-1 p-3 rounded bg-[#323437] border border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714]"
            />
            <button
              onClick={() => setShowUsernameInput(false)}
              className="px-4 rounded bg-[#323437] border border-[#646669] text-[#d1d0c5] hover:bg-[#3c3e41] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      
      {/* Main content card with consistent height */}
      <div className="w-full max-w-4xl bg-[#2c2e31] rounded-lg shadow-lg p-8 transition-all duration-300">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-200 rounded-md">
            {error}
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
            <ToggleSwitch
              isChecked={isRanked}
              onChange={setIsRanked}
              label="Ranked Game"
              description="Results will affect player ELO ratings"
            />
            
            {/* Replace Text Type Dropdown with 3-box layout */}
            <div className="mb-6">
              <label className="text-[#d1d0c5] text-lg block mb-2">Text Type</label>
              <TextTypeSelector 
                selectedType={textSource} 
                onSelect={setTextSource} 
              />
              
              {/* Subtle divider */}
              <div className="border-b border-[#3c3e41] my-4"></div>
              
              {/* Content container with conditional rendering instead of absolute positioning */}
              <div className="mb-4">
                {textSource === "topic" && (
                  <div className="mt-4">
                    {/* Text Length Slider for topic selection - moved above topics */}
                    <CustomSlider
                      value={textLength}
                      onChange={setTextLength}
                      min={10}
                      max={200}
                      step={5}
                      label="Text Length"
                      unit=" words"
                    />
                    
                    <label className="text-[#d1d0c5] text-base block mb-2 mt-4">Select Topic</label>
                    <div className="grid grid-cols-2 gap-3">
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
                          {description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {textSource === "custom" && (
                  <div className="mt-4">
                    <label className="text-[#d1d0c5] text-base block mb-2">Custom Text</label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Enter your custom text here..."
                      className="w-full p-3 rounded-lg bg-[#323437] border-2 border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714] min-h-[100px] resize-none"
                    />
                    <div className="mt-2 text-right text-sm text-[#a1a1a1]">
                      {customText.trim().split(/\s+/).filter(Boolean).length} words
                    </div>
                  </div>
                )}
              </div>
              
              {/* Text Length Slider - only show for random text */}
              {textSource === "random" && (
                <div>
                  <CustomSlider
                    value={textLength}
                    onChange={setTextLength}
                    min={10}
                    max={200}
                    step={5}
                    label="Text Length"
                    unit=" words"
                  />
                </div>
              )}
            </div>
            
            {/* Create Game Button */}
            <button
              onClick={createGame}
              disabled={isLoading}
              className={`w-full p-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                isLoading
                  ? "bg-[#a08310] text-[#323437] cursor-not-allowed"
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
                className="w-full p-3 rounded-md bg-[#323437] border border-[#646669] text-[#d1d0c5] focus:outline-none focus:border-[#e2b714] placeholder-[#646669] uppercase text-center"
              />
            </div>
            
            <button
              onClick={() => joinGame()}
              disabled={isLoading}
              className={`w-full py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                isLoading
                  ? "bg-[#a08310] text-[#323437] cursor-not-allowed"
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

