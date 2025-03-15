import { useNavigate } from "react-router-dom";
import { authService } from "../services/firebase";
import { useUser } from "../contexts/UserContext";
import { useState, useEffect } from "react";
import { FaSignOutAlt } from "react-icons/fa";

const Header = () => {
  const navigate = useNavigate();
  const { userData } = useUser();
  const [scrolled, setScrolled] = useState(false);

  // Add scroll event listener to create a dynamic header effect
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scrolled]);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "shadow-lg" 
          : ""
      } px-6 py-3`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center relative">
        {/* Logo - Left */}
        <div>
          <h1
            onClick={() => navigate("/")}
            className="cursor-pointer text-2xl font-bold text-[#e2b714] hover:text-[#f3c82f] transition-colors hover:scale-105 transform duration-200 text-shadow"
          >
            Typr
          </h1>
        </div>

        {/* Navigation - Absolutely Centered */}
        <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
          <nav className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => navigate("/")} 
              className="px-3 py-1.5 text-sm text-white hover:text-white transition-colors rounded-full hover:bg-white/5 text-shadow"
            >
              Home
            </button>
            <button 
              onClick={() => navigate("/ranked")} 
              className="px-3 py-1.5 text-sm text-white hover:text-white transition-colors rounded-full hover:bg-white/5 text-shadow"
            >
              Ranked
            </button>
            <button 
              onClick={() => navigate("/custom")} 
              className="px-3 py-1.5 text-sm text-white hover:text-white transition-colors rounded-full hover:bg-white/5 text-shadow"
            >
              Custom
            </button>
            <button 
              onClick={() => navigate("/solo")} 
              className="px-3 py-1.5 text-sm text-white hover:text-white transition-colors rounded-full hover:bg-white/5 text-shadow"
            >
              Solo
            </button>
            <button 
              onClick={() => navigate("/stats")} 
              className="px-3 py-1.5 text-sm text-white hover:text-white transition-colors rounded-full hover:bg-white/5 text-shadow"
            >
              Stats
            </button>
          </nav>
        </div>

        {/* User Controls - Right */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 text-sm text-red-500 hover:text-red-400 transition-all rounded-full hover:bg-white/10 hover:shadow-glow text-shadow flex items-center gap-1.5"
          >
            <FaSignOutAlt className="text-red-500" />
            Logout
          </button>

          <div className="relative group">
            <button className="w-9 h-9 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#e2b714] transition-all duration-200 hover:ring-2 hover:ring-[#e2b714]/70 hover:scale-105">
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

            <div className="absolute right-0 mt-2 w-48 py-2 bg-black/80 backdrop-blur-md rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform group-hover:translate-y-0 translate-y-1">
              <div className="px-4 py-2 text-sm text-[#d1d0c5]">
                {userData?.username || userData?.email}
              </div>
              <div className="px-4 py-2 text-sm text-[#d1d0c5] cursor-pointer hover:text-white hover:bg-white/10 transition-colors">
                <button onClick={() => navigate("/stats")} className="w-full text-left">Stats</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
