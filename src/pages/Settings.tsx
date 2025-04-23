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
            <div className="bg-[#232527] rounded-lg p-4">
              <ul className="space-y-2">
                <li>
                  <button
                    className={`flex items-center w-full p-2 rounded transition-colors ${
                      activeTab === 'keyboard'
                        ? 'bg-[#e2b714] text-[#323437]'
                        : 'hover:bg-[#3c3e41]'
                    }`}
                    onClick={() => setActiveTab('keyboard')}
                  >
                    <FaKeyboard className="mr-3" />
                    Keyboard Sounds
                  </button>
                </li>
                <li>
                  <button
                    className={`flex items-center w-full p-2 rounded transition-colors ${
                      activeTab === 'profile'
                        ? 'bg-[#e2b714] text-[#323437]'
                        : 'hover:bg-[#3c3e41]'
                    }`}
                    onClick={() => setActiveTab('profile')}
                  >
                    <FaUser className="mr-3" />
                    Profile
                  </button>
                </li>
                <li>
                  <button
                    className={`flex items-center w-full p-2 rounded transition-colors ${
                      activeTab === 'about'
                        ? 'bg-[#e2b714] text-[#323437]'
                        : 'hover:bg-[#3c3e41]'
                    }`}
                    onClick={() => setActiveTab('about')}
                  >
                    <FaInfoCircle className="mr-3" />
                    About
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
                <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
                <div className="bg-[#232527] rounded-lg p-4">
                  <p className="text-[#d1d0c5]/80">
                    Profile settings will be implemented in a future update.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">About TYPR</h2>
                <div className="bg-[#232527] rounded-lg p-4">
                  <p className="text-[#d1d0c5]/80 mb-4">
                    TYPR is a competitive typing racing app where you can challenge your typing
                    skills against others or practice on your own.
                  </p>
                  <p className="text-[#d1d0c5]/80">
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