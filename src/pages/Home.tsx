import { useNavigate } from "react-router-dom";
import GameModeButton from "../components/GameModeButton";
const Home = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <GameModeButton
        onClick={() => navigate("/custom")}
        className="bg-blue-500 text-white px-4 py-2 rounded-md"
      >
        Custom Game
      </GameModeButton>
      <GameModeButton
        onClick={() => navigate("/ranked")} //TODO: implement multiplayer matchmaking
        className="bg-blue-500 text-white px-4 py-2 rounded-md"
      >
        Ranked Multiplayer
      </GameModeButton>
      <GameModeButton
        onClick={() => navigate("/solo")} //TODO
        className="bg-blue-500 text-white px-4 py-2 rounded-md"
      >
        Solo
      </GameModeButton>
    </div>
  );
};

export default Home;
