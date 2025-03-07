import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { useState } from "react";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "../services/firebase";

//TODO: move all firebase function to the @firebase.ts file

const CustomRoom = () => {
  const navigate = useNavigate();
  const { userData } = useUser();
  const [roomId, setRoomId] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  const createGame = async () => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid;

    if (!username || !userId) {
      alert("You must be logged in to create a game");
      return;
    }

    try {
      const db = getFirestore();
      const roomId = Math.random().toString(36).substring(2, 8);

      // Create new room in Firestore
      const roomRef = doc(db, "gameRooms", roomId);
      await setDoc(roomRef, {
        id: roomId,
        status: "waiting",
        createdAt: serverTimestamp(),
        timeLimit: 60, // 60 seconds time limit
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
        text: "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.",
      });

      console.log("Game room created successfully:", roomId);
      navigate(`/race/${roomId}`);
    } catch (error) {
      console.error("Error creating game room:", error);
    }
  };

  const joinGame = async () => {
    const username = tempUsername || userData?.username;
    const userId = auth.currentUser?.uid;

    if (!username || !userId || !roomId) {
      alert("You must be logged in and provide a room ID to join a game");
      return;
    }

    try {
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomId);
      const roomDoc = await getDoc(roomRef);

      if (!roomDoc.exists()) {
        alert("Room not found!");
        return;
      }

      const roomData = roomDoc.data();
      if (Object.keys(roomData.players || {}).length >= 2) {
        alert("Room is full!");
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

      console.log("Joined game room:", roomId);
      navigate(`/race/${roomId}`);
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Error joining game");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Custom Game</h1>
      <div className="w-full max-w-md space-y-4">
        {showUsernameInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Temporary username"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              className="flex-1 p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5]"
            />
            <button
              onClick={() => setShowUsernameInput(false)}
              className="px-4 rounded bg-[#2c2e31] border border-[#646669] hover:bg-[#2c2e31]/90 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowUsernameInput(true)}
            className="w-full p-2 rounded bg-[#2c2e31] border border-[#646669] hover:bg-[#2c2e31]/90 transition-colors"
          >
            Join with Different Username
          </button>
        )}
        <div className="flex gap-4">
          <button
            onClick={createGame}
            className="flex-1 p-2 rounded bg-[#e2b714] text-[#323437] font-medium hover:bg-[#e2b714]/90 transition-colors"
          >
            Create Game
          </button>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5]"
            />
            <button
              onClick={joinGame}
              className="px-4 rounded bg-[#2c2e31] border border-[#646669] hover:bg-[#2c2e31]/90 transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomRoom;
