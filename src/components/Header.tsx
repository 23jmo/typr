import { useNavigate } from "react-router-dom";
import { authService } from "../services/firebase";
import { useUser } from "../contexts/UserContext";

const Header = () => {
  const navigate = useNavigate();
  const { userData } = useUser();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-[#2c2e31] border-b border-[#646669] px-4 py-2">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1
          onClick={() => navigate("/")}
          className=" cursor-pointer text-2xl font-bold text-[#e2b714]"
        >
          Typr
        </h1>

        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="px-4 py-1 text-sm text-[#d1d0c5] hover:text-[#e2b714] transition-colors"
          >
            Logout
          </button>

          <div className="relative group">
            <button className="w-8 h-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#e2b714]">
              {userData?.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#e2b714] flex items-center justify-center text-[#323437] font-medium">
                  {userData?.username?.[0].toUpperCase() ||
                    userData?.email?.[0].toUpperCase() ||
                    "U"}
                </div>
              )}
            </button>

            <div className="absolute right-0 mt-2 w-48 py-2 bg-[#2c2e31] border border-[#646669] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="px-4 py-2 text-sm text-[#d1d0c5]">
                {userData?.username || userData?.email}
              </div>
              <div className="px-4 py-2 text-sm text-[#d1d0c5] cursor-pointer hover:text-[#e2b714]">
                <button onClick={() => navigate("/stats")}>Stats</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
