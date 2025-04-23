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
    <div className={`rounded-lg p-4 bg-[#2c2e31] text-[#d1d0c5] shadow-lg ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Keyboard Sound Settings</h3>
      
      <div className="space-y-6">
        {/* Sound toggle */}
        <div className="flex items-center justify-between mb-2">
          <span>Keyboard sounds</span>
          <button
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#e2b714] focus:ring-offset-2 focus:ring-offset-[#2c2e31] ${
              settings.enabled ? 'bg-[#e2b714]' : 'bg-[#323437]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        <div className="border-b border-[#3c3e41] my-2"></div>
        
        {/* Volume slider */}
        <div className={`transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="volume-slider">
              Volume: {Math.round(settings.volume * 100)}%
            </label>
          </div>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-[#323437] rounded-lg appearance-none cursor-pointer accent-[#e2b714]"
            style={{
              height: '8px',
              borderRadius: '4px',
            }}
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
            className="w-full p-2 bg-[#323437] border border-[#646669] rounded focus:outline-none focus:ring-2 focus:ring-[#e2b714] text-[#d1d0c5]"
            disabled={!settings.enabled}
          >
            {availableSoundPacks.map(pack => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="border-b border-[#3c3e41] my-2"></div>
        
        {/* Test sounds section */}
        <div className={`transition-opacity duration-300 ${settings.enabled && settings.theme !== 'silent' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <p className="mb-3">Test Sounds:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => keyboardSoundService.playSound('keypress').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-2 bg-[#323437] hover:bg-[#3c3e41] rounded text-[#d1d0c5] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Key Press
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('space').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-2 bg-[#323437] hover:bg-[#3c3e41] rounded text-[#d1d0c5] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Space
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('backspace').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-2 bg-[#323437] hover:bg-[#3c3e41] rounded text-[#d1d0c5] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Backspace
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('enter').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-2 bg-[#323437] hover:bg-[#3c3e41] rounded text-[#d1d0c5] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Enter
            </button>
            <button
              onClick={() => keyboardSoundService.playSound('error').catch(err => console.error('Error playing sound:', err))}
              className="px-3 py-2 bg-[#323437] hover:bg-[#3c3e41] rounded text-[#d1d0c5] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.enabled || settings.theme === 'silent'}
            >
              Error
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-xs text-[#a1a1a1]">
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