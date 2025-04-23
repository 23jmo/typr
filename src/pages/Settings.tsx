import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KeyboardSoundSettings from '../components/KeyboardSoundSettings';
import { FaArrowLeft, FaKeyboard, FaUser, FaInfoCircle } from 'react-icons/fa';

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('keyboard');

  return (
    <div className="min-h-screen bg-[#323437] text-[#d1d0c5] p-4">
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
                  <p className="text-[#a1a1a1]">
                    Profile settings will be implemented in a future update.
                  </p>
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
                    This app was created with React, TypeScript, and Firebase.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 