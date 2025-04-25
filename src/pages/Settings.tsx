import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KeyboardSoundSettings from '../components/KeyboardSoundSettings';
import { FaArrowLeft, FaKeyboard, FaUser, FaInfoCircle, FaTrash } from 'react-icons/fa';
import { userService } from '../services/firebase';

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('keyboard');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await userService.deleteAccount();
      // Navigate to home if successful (though auth state change should handle this)
      navigate('/', { replace: true });
    } catch (error: any) {
      setDeleteError(error.message);
    } finally {
      setIsDeleting(false);
      setShowConfirmation(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#323437] text-[#d1d0c5] p-4 pt-16 md:pt-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 text-[#d1d0c5] hover:text-[#e2b714] transition-colors"
            aria-label="Go back"
          >
            <FaArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Settings Layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-[#2c2e31] rounded-lg overflow-hidden">
              <ul>
                <li>
                  <button
                    className={`flex items-center w-full p-4 transition-all duration-200 ${
                      activeTab === 'keyboard'
                        ? 'bg-[#232527] text-[#e2b714]'
                        : 'text-[#646669] hover:text-[#a1a1a1]'
                    }`}
                    onClick={() => setActiveTab('keyboard')}
                  >
                    <FaKeyboard className="mr-3" />
                    <span className="font-medium">Keyboard Sounds</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`flex items-center w-full p-4 transition-all duration-200 ${
                      activeTab === 'profile'
                        ? 'bg-[#232527] text-[#e2b714]'
                        : 'text-[#646669] hover:text-[#a1a1a1]'
                    }`}
                    onClick={() => setActiveTab('profile')}
                  >
                    <FaUser className="mr-3" />
                    <span className="font-medium">Profile</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`flex items-center w-full p-4 transition-all duration-200 ${
                      activeTab === 'about'
                        ? 'bg-[#232527] text-[#e2b714]'
                        : 'text-[#646669] hover:text-[#a1a1a1]'
                    }`}
                    onClick={() => setActiveTab('about')}
                  >
                    <FaInfoCircle className="mr-3" />
                    <span className="font-medium">About</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {activeTab === 'keyboard' && (
              <div>
                <KeyboardSoundSettings />
              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                <div className="bg-[#2c2e31] rounded-lg p-6">

                  
                  <div className="">
                    <h3 className="text-lg font-medium text-red-500 mb-4">Danger Zone</h3>
                    
                    {deleteError && (
                      <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-200">
                        {deleteError}
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowConfirmation(true)}
                      disabled={isDeleting}
                      className="flex items-center px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
                    >
                      <FaTrash className="mr-2" />
                      <span>Delete Account</span>
                    </button>
                    
                    <p className="mt-3 text-sm text-[#a1a1a1]">
                      This will permanently delete your account, including all game history and statistics. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div>
                <div className="bg-[#2c2e31] rounded-lg p-6">
                  <p className="text-[#a1a1a1] mb-4">
                    TYPR is a competitive typing racing app where you can challenge your typing
                    skills against others or practice on your own.
                  </p>
                  <p className="text-[#a1a1a1]">
                    This app was created by Alex Qi and Johnathan Mo, students at Columbia University.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2c2e31] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-400 mb-4">Delete Account?</h3>
            <p className="text-[#d1d0c5] mb-6">
              Are you absolutely sure you want to delete your account? This action cannot be undone 
              and will permanently erase all your data including:
            </p>
            <ul className="list-disc pl-5 mb-6 text-[#a1a1a1]">
              <li>Your user profile</li>
              <li>All game statistics and history</li>
              <li>Rankings and achievements</li>
            </ul>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 bg-[#444] hover:bg-[#555] rounded-md transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md transition-colors flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 