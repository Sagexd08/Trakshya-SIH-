import { useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';


// Extend Window typing for Web Speech API across browsers
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface VoiceCommand {
  pattern: RegExp;
  action: string;
  handler: (matches: RegExpMatchArray) => void;
  description: string;
  examples: string[];
}

export interface VoiceSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  volume: number;
  rate: number;
  pitch: number;
  voice?: SpeechSynthesisVoice;
}

export class VoiceManager {
  private static instance: VoiceManager;
  private recognition: any | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private commands: VoiceCommand[] = [];
  private settings: VoiceSettings;
  private onResult?: (transcript: string, confidence: number) => void;
  private onError?: (error: string) => void;
  private onStart?: () => void;
  private onEnd?: () => void;

  static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  constructor() {
    this.settings = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      volume: 1,
      rate: 1,
      pitch: 1
    };

    this.initializeSpeechRecognition();
    this.initializeSpeechSynthesis();
    this.loadSettings();
  }

  private initializeSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.settings.continuous;
    this.recognition.interimResults = this.settings.interimResults;
    this.recognition.maxAlternatives = this.settings.maxAlternatives;
    this.recognition.lang = this.settings.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onEnd?.();
    };

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      this.onResult?.(transcript, confidence);

      if (result.isFinal) {
        this.processCommand(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      const error = `Speech recognition error: ${event.error}`;
      console.error(error);
      this.onError?.(error);
    };
  }

  private initializeSpeechSynthesis() {
    if (typeof window === 'undefined') return;

    this.synthesis = window.speechSynthesis;

    if (!this.synthesis) {
      console.warn('Speech synthesis not supported in this browser');
    }
  }

  private loadSettings() {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('trakshya-voice-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.settings = { ...this.settings, ...settings };
        this.applySettings();
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
    }
  }

  private saveSettings() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('trakshya-voice-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save voice settings:', error);
    }
  }

  private applySettings() {
    if (this.recognition) {
      this.recognition.lang = this.settings.language;
      this.recognition.continuous = this.settings.continuous;
      this.recognition.interimResults = this.settings.interimResults;
      this.recognition.maxAlternatives = this.settings.maxAlternatives;
    }
  }

  private processCommand(transcript: string) {
    const normalizedTranscript = transcript.toLowerCase().trim();

    for (const command of this.commands) {
      const matches = normalizedTranscript.match(command.pattern);
      if (matches) {
        try {
          command.handler(matches);
          this.speak(`Executing: ${command.action}`);
          return;
        } catch (error) {
          console.error('Error executing voice command:', error);
          this.speak('Sorry, I could not execute that command.');
        }
      }
    }

    // If no command matched, treat as general query
    this.onResult?.(transcript, 1.0);
  }

  registerCommand(command: VoiceCommand) {
    this.commands.push(command);
  }

  unregisterCommand(action: string) {
    this.commands = this.commands.filter(cmd => cmd.action !== action);
  }

  startListening() {
    if (!this.recognition) {
      toast.error('Speech recognition not available');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      toast.error('Failed to start voice input');
      return false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  speak(text: string, options: Partial<VoiceSettings> = {}) {
    if (!this.synthesis) {
      console.warn('Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = options.volume ?? this.settings.volume;
    utterance.rate = options.rate ?? this.settings.rate;
    utterance.pitch = options.pitch ?? this.settings.pitch;

    if (options.voice || this.settings.voice) {
      utterance.voice = options.voice || this.settings.voice!;
    }

    this.synthesis.speak(utterance);
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  updateSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
    this.saveSettings();
  }

  setCallbacks(callbacks: {
    onResult?: (transcript: string, confidence: number) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
  }) {
    this.onResult = callbacks.onResult;
    this.onError = callbacks.onError;
    this.onStart = callbacks.onStart;
    this.onEnd = callbacks.onEnd;
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !!window.speechSynthesis;
  }

  getListeningState(): boolean {
    return this.isListening;
  }
}

// React hook for voice interaction
export function useVoiceInteraction() {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const voiceManager = useRef<VoiceManager | null>(null);

  useEffect(() => {
    voiceManager.current = VoiceManager.getInstance();
    setIsSupported(voiceManager.current.isSupported());

    voiceManager.current.setCallbacks({
      onResult: (transcript, confidence) => {
        setTranscript(transcript);
        setConfidence(confidence);
      },
      onError: (error) => {
        toast.error(`Voice error: ${error}`);
        setIsListening(false);
      },
      onStart: () => {
        setIsListening(true);
        toast.success(t('listening'));
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    // Register default commands
    registerDefaultCommands();

    return () => {
      voiceManager.current?.stopListening();
    };
  }, [t]);

  const registerDefaultCommands = useCallback(() => {
    if (!voiceManager.current) return;

    const commands: VoiceCommand[] = [
      {
        pattern: /show\s+(?:me\s+)?conflicts?\s+(?:in\s+)?(.+)/i,
        action: 'show-conflicts',
        handler: (matches) => {
          const region = matches[1];
          // Implement show conflicts logic
          toast.info(`Showing conflicts in ${region}`);
        },
        description: 'Show conflicts in a specific region',
        examples: ['Show me conflicts in North Zone', 'Show conflicts in Delhi']
      },
      {
        pattern: /(?:what\s+is\s+)?(?:the\s+)?status\s+of\s+train\s+(\w+)/i,
        action: 'train-status',
        handler: (matches) => {
          const trainId = matches[1];
          // Implement train status logic
          toast.info(`Checking status of train ${trainId}`);
        },
        description: 'Get status of a specific train',
        examples: ['What is the status of train 12345?', 'Status of train Rajdhani']
      },
      {
        pattern: /(?:generate|create|show)\s+energy\s+(?:efficiency\s+)?report/i,
        action: 'energy-report',
        handler: () => {
          // Implement energy report logic
          toast.info('Generating energy efficiency report');
        },
        description: 'Generate energy efficiency report',
        examples: ['Generate energy report', 'Show energy efficiency report']
      },
      {
        pattern: /run\s+(.+)\s+scenario/i,
        action: 'run-scenario',
        handler: (matches) => {
          const scenario = matches[1];
          // Implement scenario logic
          toast.info(`Running ${scenario} scenario`);
        },
        description: 'Run a specific scenario simulation',
        examples: ['Run fog scenario', 'Run track closure scenario']
      },
      {
        pattern: /optimize\s+route\s+for\s+train\s+(\w+)/i,
        action: 'optimize-route',
        handler: (matches) => {
          const trainId = matches[1];
          // Implement route optimization logic
          toast.info(`Optimizing route for train ${trainId}`);
        },
        description: 'Optimize route for a specific train',
        examples: ['Optimize route for train 12345', 'Optimize route for Shatabdi']
      }
    ];

    commands.forEach(cmd => voiceManager.current?.registerCommand(cmd));
  }, []);

  const startListening = useCallback(() => {
    if (!voiceManager.current?.isSupported()) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    voiceManager.current.startListening();
  }, []);

  const stopListening = useCallback(() => {
    voiceManager.current?.stopListening();
  }, []);

  const speak = useCallback((text: string, options?: Partial<VoiceSettings>) => {
    voiceManager.current?.speak(text, options);
  }, []);

  const registerCommand = useCallback((command: VoiceCommand) => {
    voiceManager.current?.registerCommand(command);
  }, []);

  const unregisterCommand = useCallback((action: string) => {
    voiceManager.current?.unregisterCommand(action);
  }, []);

  const updateSettings = useCallback((settings: Partial<VoiceSettings>) => {
    voiceManager.current?.updateSettings(settings);
  }, []);

  const getAvailableVoices = useCallback(() => {
    return voiceManager.current?.getAvailableVoices() || [];
  }, []);

  return {
    isListening,
    transcript,
    confidence,
    isSupported,
    startListening,
    stopListening,
    speak,
    registerCommand,
    unregisterCommand,
    updateSettings,
    getAvailableVoices
  };
}

// React component moved to TSX to avoid JSX-in-TS parsing issues
export { VoiceCommandHelp } from './VoiceCommandHelp';
