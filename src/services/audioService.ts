/**
 * Audio service for keyboard sound effects
 * Handles loading, playing, and managing keyboard sound effects
 */

// Types for keyboard sounds
export type KeyboardSoundType = 'keypress' | 'space' | 'backspace' | 'enter' | 'error';
export type KeyboardSoundTheme = 
  | 'crystal-purple'  // EG Crystal Purple
  | 'oreo'            // EG Oreo
  | 'boxjade'         // Box Jade switches
  | 'banana-split'    // Banana Split Lubed
  | 'silent';         // No sound

// Sound settings interface
interface SoundSettings {
  enabled: boolean;
  volume: number;
  theme: KeyboardSoundTheme;
}

// Sound configuration interface for JSON-based sound packs
interface SoundPackConfig {
  id?: string;
  name?: string;
  default?: boolean;
  key_define_type?: string;
  includes_numpad?: boolean;
  sound?: string;
  defines: Record<string, [number, number]>; // [start_time_ms, duration_ms]
  multipleFiles?: boolean;
  files?: string[];
}

// Default sound settings
const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.5, // 50% volume by default
  theme: 'silent',
};

// Path to sound files
const SOUND_BASE_PATH = '/sounds';

// Map sound packs to their directory names
const SOUND_PACK_DIRS: Record<KeyboardSoundTheme, string> = {
  'crystal-purple': 'eg-crystal-purple',
  'oreo': 'eg-oreo',
  'boxjade': 'boxjade',
  'banana-split': 'banana split lubed',
  'silent': '', // No directory for silent theme
};

// Human-readable names for sound packs
export const SOUND_PACK_NAMES: Record<KeyboardSoundTheme, string> = {
  'crystal-purple': 'EG Crystal Purple',
  'oreo': 'EG Oreo',
  'boxjade': 'Box Jade',
  'banana-split': 'Banana Split Lubed',
  'silent': 'Silent (No Sound)',
};

// Map key types to key indices in the sound pack
const KEY_TYPE_TO_INDEX: Record<KeyboardSoundType, string[]> = {
  keypress: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'], // Regular keys
  space: ['57'], // Space bar
  backspace: ['42'], // Backspace
  enter: ['28'], // Enter
  error: ['42'], // Using backspace sound for errors as well
};

class KeyboardSoundService {
  private settings: SoundSettings;
  private audioPool: Map<string, HTMLAudioElement[]>;
  private loadedSounds: Set<string>;
  private initialized: boolean;
  private audioContext: AudioContext | null;
  private soundBuffers: Map<string, AudioBuffer>;
  private soundPackConfigs: Map<string, SoundPackConfig>;
  private currentAudioBuffer: AudioBuffer | null;
  private multiFileAudioBuffers: Map<string, AudioBuffer>;

  constructor() {
    // Initialize with default settings
    this.settings = { ...DEFAULT_SETTINGS };
    this.audioPool = new Map();
    this.loadedSounds = new Set();
    this.initialized = false;
    this.audioContext = null;
    this.soundBuffers = new Map();
    this.soundPackConfigs = new Map();
    this.currentAudioBuffer = null;
    this.multiFileAudioBuffers = new Map();
    
    // Load settings from localStorage if available
    this.loadSettings();
  }

  /**
   * Initialize the sound service by preloading all audio files
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Only set initialized flag - actual sound loading will happen on first user interaction
    this.initialized = true;
    
    // Only load sounds if enabled and not using silent theme, but don't automatically create AudioContext
    if (this.settings.enabled && this.settings.theme !== 'silent') {
      console.log('Sound service initialized, sounds will load on first user interaction');
    }
  }

  /**
   * Initialize Web Audio API
   */
  private async initializeWebAudio(): Promise<AudioContext | null> {
    try {
      // Create audio context on first use (must be from user interaction)
      if (!this.audioContext) {
        console.log('Creating AudioContext from user interaction');
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Resume audio context if suspended (autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return this.audioContext;
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
      return null;
    }
  }

  /**
   * Load a sound pack with JSON configuration
   */
  private async loadSoundPack(packName: string): Promise<void> {
    try {
      // Skip if using silent theme
      if (!packName) return;
      
      // Load the configuration file
      const configResponse = await fetch(`${SOUND_BASE_PATH}/${packName}/config.json`);
      if (!configResponse.ok) {
        throw new Error(`Failed to load sound pack configuration for ${packName}`);
      }
      
      const config: SoundPackConfig = await configResponse.json();
      this.soundPackConfigs.set(packName, config);
      
      if (!this.audioContext) {
        await this.initializeWebAudio();
      }
      
      if (!this.audioContext) {
        throw new Error('Failed to initialize audio context');
      }
      
      // Check if this is a multi-file pack (key_define_type === "multi" or if defines contains strings)
      const isMultiFile = config.key_define_type === 'multi' || 
                         (config.defines && Object.values(config.defines).some(v => typeof v === 'string'));
      
      if (isMultiFile) {
        // Get a list of all unique files used in the defines
        const fileSet = new Set<string>();
        Object.values(config.defines).forEach(define => {
          if (typeof define === 'string') {
            fileSet.add(define);
          }
        });
        
        // Convert the file set to an array and set it on the config
        config.multipleFiles = true;
        config.files = Array.from(fileSet);
        
        // Load multiple sound files
        await this.loadMultipleFiles(packName, config);
      } else {
        // Load the single sound file
        const soundFile = config.sound || `${packName.split('/').pop()}.ogg`;
        const soundPath = `${SOUND_BASE_PATH}/${packName}/${soundFile}`;
        
        const soundResponse = await fetch(soundPath);
        if (!soundResponse.ok) {
          throw new Error(`Failed to load sound file for ${packName}`);
        }
        
        const arrayBuffer = await soundResponse.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        this.soundBuffers.set(packName, audioBuffer);
        this.currentAudioBuffer = audioBuffer;
      }
      
      console.log(`Loaded sound pack: ${packName}`);
    } catch (error) {
      console.error(`Failed to load sound pack ${packName}:`, error);
    }
  }

  /**
   * Load multiple sound files for a pack
   */
  private async loadMultipleFiles(packName: string, config: SoundPackConfig): Promise<void> {
    if (!config.files || !this.audioContext) return;
    
    const loadPromises = config.files.map(async (file) => {
      const soundPath = `${SOUND_BASE_PATH}/${packName}/${file}`;
      
      try {
        const soundResponse = await fetch(soundPath);
        if (!soundResponse.ok) {
          throw new Error(`Failed to load sound file ${file}`);
        }
        
        const arrayBuffer = await soundResponse.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        
        this.multiFileAudioBuffers.set(file, audioBuffer);
      } catch (error) {
        console.error(`Failed to load sound file ${file}:`, error);
      }
    });
    
    await Promise.all(loadPromises);
  }

  /**
   * Play a keyboard sound effect
   */
  public async playSound(type: KeyboardSoundType): Promise<void> {
    // Skip if sounds are disabled or using silent theme
    if (!this.settings.enabled || this.settings.theme === 'silent') {
      return;
    }
    
    // Lazy load sounds on first user interaction
    if (!this.audioContext) {
      await this.initializeWebAudio();
      await this.loadSoundPack(SOUND_PACK_DIRS[this.settings.theme]);
    }
    
    const packDir = SOUND_PACK_DIRS[this.settings.theme];
    this.playSoundFromPack(packDir, type);
  }

  /**
   * Play a sound from a sound pack using Web Audio API
   */
  private async playSoundFromPack(packName: string, soundType: KeyboardSoundType): Promise<void> {
    // Skip if no audio context (should be initialized by playSound)
    if (!this.audioContext) {
      console.warn('AudioContext not initialized');
      return;
    }
    
    const config = this.soundPackConfigs.get(packName);
    if (!config) {
      console.warn(`Sound pack ${packName} not loaded`);
      return;
    }
    
    // Check if this is a multi-file pack
    if (config.multipleFiles && config.files && config.files.length > 0) {
      await this.playMultiFileSoundFromPack(packName, soundType, config);
      return;
    }
    
    // For single file packs
    if (!this.soundBuffers.has(packName) || !this.currentAudioBuffer) {
      console.warn(`Sound buffer for ${packName} not loaded`);
      return;
    }
    
    // Get appropriate key indices for the sound type
    const keyIndices = KEY_TYPE_TO_INDEX[soundType];
    if (!keyIndices || keyIndices.length === 0) return;
    
    // Randomly choose one of the possible key sounds for this type
    const keyIndex = keyIndices[Math.floor(Math.random() * keyIndices.length)];
    const keyDefinition = config.defines[keyIndex];
    
    if (!keyDefinition) {
      console.warn(`Key definition not found for index ${keyIndex} in pack ${packName}`);
      return;
    }
    
    // Convert from milliseconds to seconds for Web Audio API
    const startTime = Array.isArray(keyDefinition) ? keyDefinition[0] / 1000 : 0;
    const duration = Array.isArray(keyDefinition) ? keyDefinition[1] / 1000 : undefined;
    
    try {
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.currentAudioBuffer;
      
      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = this.settings.volume;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Play the specific portion of the audio file
      source.start(0, startTime, duration);
    } catch (error) {
      console.error('Error playing sound from pack:', error);
    }
  }

  /**
   * Play a sound from a multi-file sound pack
   */
  private async playMultiFileSoundFromPack(_packName: string, soundType: KeyboardSoundType, config: SoundPackConfig): Promise<void> {
    if (!this.audioContext || !config.files || config.files.length === 0) return;
    
    try {
      // Get appropriate key indices for the sound type
      const keyIndices = KEY_TYPE_TO_INDEX[soundType];
      if (!keyIndices || keyIndices.length === 0) return;
      
      // Randomly choose one of the possible key sounds for this type
      const keyIndex = keyIndices[Math.floor(Math.random() * keyIndices.length)];
      
      // Get the filename for this key
      const keyDefinition = config.defines[keyIndex];
      
      if (!keyDefinition) {
        // If no specific definition, just play a random file
        const fileIndex = Math.floor(Math.random() * config.files.length);
        const fileName = config.files[fileIndex];
        await this.playAudioFile(fileName);
        return;
      }
      
      // If the definition is a string, it's a filename
      if (typeof keyDefinition === 'string') {
        await this.playAudioFile(keyDefinition);
      } else {
        // Otherwise, it's a random file from the list
        const fileIndex = Math.floor(Math.random() * config.files.length);
        const fileName = config.files[fileIndex];
        await this.playAudioFile(fileName);
      }
    } catch (error) {
      console.error('Error playing sound from multi-file pack:', error);
    }
  }
  
  /**
   * Helper method to play an audio file from the multi-file buffers
   */
  private async playAudioFile(fileName: string): Promise<void> {
    const buffer = this.multiFileAudioBuffers.get(fileName);
    if (!buffer || !this.audioContext) {
      console.warn(`Audio buffer for ${fileName} not loaded`);
      return;
    }
    
    // Create audio source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.settings.volume;
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Play the file (whole file for multi-file packs)
    source.start();
  }

  /**
   * Enable or disable keyboard sounds
   */
  public toggleSounds(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
    
    // If enabling sounds and not initialized, initialize
    if (enabled && !this.initialized) {
      this.initialize();
    }
  }

  /**
   * Set the sound volume (0-1)
   */
  public setVolume(volume: number): void {
    this.settings.volume = Math.min(1, Math.max(0, volume));
    this.saveSettings();
  }

  /**
   * Change the keyboard sound theme
   */
  public async setTheme(theme: KeyboardSoundTheme): Promise<void> {
    if (this.settings.theme === theme) return;
    
    this.settings.theme = theme;
    this.saveSettings();
    
    // Clear existing audio pools
    this.audioPool.clear();
    this.loadedSounds.clear();
    this.soundBuffers.clear();
    this.multiFileAudioBuffers.clear();
    this.currentAudioBuffer = null;
    
    // Initialized flag is maintained to prevent multiple initializations
    
    // Reload sounds with new theme if enabled and not silent
    if (this.settings.enabled && theme !== 'silent') {
      await this.initializeWebAudio();
      await this.loadSoundPack(SOUND_PACK_DIRS[theme]);
    }
  }

  /**
   * Get current sound settings
   */
  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /**
   * Get list of available sound packs
   */
  public getAvailableSoundPacks(): { id: KeyboardSoundTheme; name: string }[] {
    const packs = Object.entries(SOUND_PACK_NAMES).map(([id, name]) => ({
      id: id as KeyboardSoundTheme,
      name,
    }));
    
    // Ensure silent option is first in the list
    return packs.sort((a, b) => {
      if (a.id === 'silent') return -1;
      if (b.id === 'silent') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem('typr-sound-settings');
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Failed to load sound settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('typr-sound-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save sound settings:', error);
    }
  }
}

// Export a singleton instance
export const keyboardSoundService = new KeyboardSoundService(); 