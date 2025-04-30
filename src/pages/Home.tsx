import { useNavigate } from "react-router-dom";
import GameModeCard from "../components/GameModeCard";
import { FaUserFriends, FaTrophy, FaKeyboard } from "react-icons/fa";

const Home = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex w-full h-screen bg-gray-900 flex-col md:flex-row overflow-hidden">
      <GameModeCard
        title="Custom Game"
        description="Play with friends using custom settings and create your own typing challenges"
        icon={FaUserFriends}
        color="text-blue-500"
        onClick={() => navigate("/custom")}
      />
      
      <GameModeCard
        title="Ranked Mode"
        description="Compete against others and climb the leaderboard in competitive typing races"
        icon={FaTrophy}
        color="text-yellow-500"
        onClick={() => navigate("/ranked")}
      />
      
      <GameModeCard
        title="Solo Practice"
        description="Improve your typing skills at your own pace with various practice exercises"
        icon={FaKeyboard}
        color="text-green-500"
        onClick={() => navigate("/solo")}
      />
    </div>
  );
};

export default Home;
