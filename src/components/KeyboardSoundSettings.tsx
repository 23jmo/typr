import React, { useState, useEffect } from 'react';
import { keyboardSoundService, KeyboardSoundTheme, SOUND_PACK_NAMES } from '../services/audioService';

interface KeyboardSoundSettingsProps {
  className?: string;
}

const KeyboardSoundSettings: React.FC<KeyboardSoundSettingsProps> = ({ className = '' }) => {
  const [settings, setSettings] = useState({
    enabled: true,
    volume: 0.5,
    theme: 'crystal-purple' as KeyboardSoundTheme,
  });
  const [availableSoundPacks, setAvailableSoundPacks] = useState<Array<{id: KeyboardSoundTheme, name: string}>>([]);

  // Load settings from the service on mount
  useEffect(() => {
    const currentSettings = keyboardSoundService.getSettings();
    setSettings(currentSettings);
    setAvailableSoundPacks(keyboardSoundService.getAvailableSoundPacks());
  }, []);

  // Toggle sound on/off
  const handleToggleSound = () => {
    const newEnabled = !settings.enabled;
    keyboardSoundService.toggleSounds(newEnabled);
    setSettings(prev => ({ ...prev, enabled: newEnabled }));
    
    // Play a test sound if enabled
    if (newEnabled) {
      setTimeout(() => {
        keyboardSoundService.playSound('keypress').catch(err => 
          console.error('Error playing sound:', err)
        );
      }, 100);
    }
  };

  // Change volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    keyboardSoundService.setVolume(newVolume);
    setSettings(prev => ({ ...prev, volume: newVolume }));
    
    // Play a test sound
    if (settings.enabled) {
      keyboardSoundService.playSound('keypress').catch(err => 
        console.error('Error playing sound:', err)
      );
    }
  };

  // Change theme
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value as KeyboardSoundTheme;
    keyboardSoundService.setTheme(newTheme);
    setSettings(prev => ({ ...prev, theme: newTheme }));
    
    // Play a test sound
    if (settings.enabled && newTheme !== 'silent') {
      setTimeout(() => {
        keyboardSoundService.playSound('keypress').catch(err => 
          console.error('Error playing sound:', err)
        );
      }, 300);
    }
  };

  return (
    <div className={`rounded-lg p-4 bg-[#232527] text-[#d1d0c5] ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Keyboard Sound Settings</h3>
      
      <div className="space-y-4">
        {/* Sound toggle */}
        <div className="flex items-center justify-between">
          <span>Keyboard sounds</span>
          <button
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#e2b714] focus:ring-offset-2 ${
              settings.enabled ? 'bg-[#e2b714]' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {/* Volume slider */}
        <div className={`transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <label htmlFor="volume-slider" className="block mb-2">
            Volume: {Math.round(settings.volume * 100)}%
          </label>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            disabled={!settings.enabled}
          />
        </div>
        
        {/* Sound theme */}
        <div className={`transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <label htmlFor="sound-theme" className="block mb-2">
            Sound Theme
          </label>
          <select
            id="sound-theme"
            value={settings.theme}
            onChange={handleThemeChange}
            className="w-full p-2 bg-[#323437] border border-[#646669] rounded focus:outline-none focus:ring-2 focus:ring-[#e2b714]"
            disabled={!settings.enabled}
          >
            {availableSoundPacks.map(pack => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Test sounds section */}
        <div className={`transition-opacity duration-300 ${settings.enabled && settings.theme !== 'silent' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <p className="mb-2">Test Sounds:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => keyboardSoundService.playSound('keypress').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-1 bg-[#2c2e31] hover:bg-[#3c3e41] rounded"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Key Press
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('space').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-1 bg-[#2c2e31] hover:bg-[#3c3e41] rounded"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Space
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('backspace').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-1 bg-[#2c2e31] hover:bg-[#3c3e41] rounded"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Backspace
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('enter').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-1 bg-[#2c2e31] hover:bg-[#3c3e41] rounded"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Enter
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('error').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-1 bg-[#2c2e31] hover:bg-[#3c3e41] rounded"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Error
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-[#646669]">
        {settings.theme === 'silent' ? (
          <p>Sound effects are disabled.</p>
        ) : (
          <p>Using {SOUND_PACK_NAMES[settings.theme]} keyboard sound pack.</p>
        )}
      </div>
    </div>
  );
};

export default KeyboardSoundSettings; 