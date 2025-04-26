import React from "react";

interface UserHeaderProps {
  username: string;
  joinDate: string;
  photoURL?: string | null;
}

/**
 * Header displaying the user's name and when they joined
 * Responsive design for different screen sizes
 */
const UserHeader: React.FC<UserHeaderProps> = ({ 
  username, 
  joinDate,
  photoURL 
}) => {
  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8 mt-4 sm:mt-6 md:mt-8">
      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#2c2e31] flex items-center justify-center">
        {photoURL ? (
          <img
            src={photoURL}
            alt="Profile"
            className="w-full h-full rounded-full"
          />
        ) : (
          <span className="text-lg sm:text-xl md:text-2xl text-[#e2b714]">
            {username?.[0]?.toUpperCase() || "U"}
          </span>
        )}
      </div>
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#e2b714]">
          {username || "User"}
        </h1>
        <p className="text-xs sm:text-sm text-[#646669]">
          Joined {joinDate}
        </p>
      </div>
    </div>
  );
};

export default UserHeader; 