import React from "react";
import { useUser } from "../contexts/UserContext";

interface UserHeaderProps {
  username: string;
  joinDate: string;
  photoURL?: string | null;
}

/**
 * Header displaying the user's name and when they joined
 * Matches the styling in OverallStats component
 */
const UserHeader: React.FC<UserHeaderProps> = ({ 
  username, 
  joinDate,
  photoURL 
}) => {
  return (
    <div className="flex items-center gap-4 mb-8 mt-8">
      <div className="w-16 h-16 rounded-full bg-[#2c2e31] flex items-center justify-center">
        {photoURL ? (
          <img
            src={photoURL}
            alt="Profile"
            className="w-full h-full rounded-full"
          />
        ) : (
          <span className="text-2xl text-[#e2b714]">
            {username?.[0]?.toUpperCase() || "U"}
          </span>
        )}
      </div>
      <div>
        <h1 className="text-3xl font-bold text-[#e2b714]">
          {username || "User"}
        </h1>
        <p className="text-[#646669]">
          Joined {joinDate}
        </p>
      </div>
    </div>
  );
};

export default UserHeader; 