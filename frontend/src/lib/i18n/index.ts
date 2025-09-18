import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      scenarios: 'Scenarios',
      settings: 'Settings',
      
      // Dashboard
      'active-trains': 'Active Trains',
      'avg-delay': 'Average Delay',
      'energy-efficiency': 'Energy Efficiency',
      'network-throughput': 'Network Throughput',
      'conflict-zones': 'Conflict Zones',
      'total-savings': 'Total Savings',
      
      // AI Assistant
      'ai-assistant': 'AI Assistant',
      'voice-input': 'Voice Input',
      'type-message': 'Type your message...',
      'send-message': 'Send Message',
      'listening': 'Listening...',
      'processing': 'Processing...',
      
      // Recommendations
      'recommendations': 'Recommendations',
      'confidence': 'Confidence',
      'accept': 'Accept',
      'reject': 'Reject',
      'modify': 'Modify',
      'save-changes': 'Save Changes',
      'cancel': 'Cancel',
      'ai-reasoning': 'AI Reasoning',
      'affected-trains': 'Affected Trains',
      'action-parameters': 'Action Parameters',
      
      // Scenarios
      'what-if-scenarios': 'What-If Scenarios',
      'run-simulation': 'Run Simulation',
      'simulation-results': 'Simulation Results',
      'ai-impact-analysis': 'AI Impact Analysis',
      'save-scenario': 'Save Scenario',
      'load-scenario': 'Load Scenario',
      'export-scenarios': 'Export Scenarios',
      'import-scenarios': 'Import Scenarios',
      
      // Energy Analytics
      'energy-analytics': 'Energy Analytics',
      'baseline': 'Baseline',
      'optimized': 'Optimized',
      'actual': 'Actual',
      'efficiency': 'Efficiency',
      'cost-saved': 'Cost Saved',
      'carbon-reduced': 'Carbon Reduced',
      'peak-hour': 'Peak Hour',
      
      // Conflict Analysis
      'conflict-analysis': 'Conflict Analysis',
      'time-distance-heatmap': 'Time-Distance Heatmap',
      'severity-filter': 'Severity Filter',
      'time-range': 'Time Range',
      'export-data': 'Export Data',
      
      // Common
      'loading': 'Loading...',
      'error': 'Error',
      'success': 'Success',
      'warning': 'Warning',
      'info': 'Information',
      'close': 'Close',
      'save': 'Save',
      'delete': 'Delete',
      'edit': 'Edit',
      'view': 'View',
      'refresh': 'Refresh',
      'export': 'Export',
      'import': 'Import',
      'search': 'Search',
      'filter': 'Filter',
      'sort': 'Sort',
      'live': 'Live',
      'offline': 'Offline',
      'connected': 'Connected',
      'disconnected': 'Disconnected',
      
      // Units
      'minutes': 'minutes',
      'hours': 'hours',
      'seconds': 'seconds',
      'kilometers': 'kilometers',
      'percentage': 'percentage',
      'rupees': 'rupees',
      'kilowatts': 'kilowatts',
      'kilograms': 'kilograms',
      
      // Status
      'on-time': 'On Time',
      'delayed': 'Delayed',
      'cancelled': 'Cancelled',
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
      
      // Accessibility
      'skip-to-content': 'Skip to main content',
      'main-navigation': 'Main navigation',
      'search-trains': 'Search trains',
      'map-controls': 'Map controls',
      'zoom-in': 'Zoom in',
      'zoom-out': 'Zoom out',
      'toggle-layer': 'Toggle layer',
      'play-pause': 'Play/Pause',
      'previous': 'Previous',
      'next': 'Next',
      
      // Voice Commands
      'voice-commands': {
        'show-conflicts': 'Show me conflicts in {{region}}',
        'train-status': 'What is the status of train {{trainId}}?',
        'energy-report': 'Generate energy efficiency report',
        'run-scenario': 'Run {{scenario}} scenario',
        'optimize-route': 'Optimize route for train {{trainId}}'
      }
    }
  },
  hi: {
    translation: {
      // Navigation
      dashboard: 'डैशबोर्ड',
      analytics: 'विश्लेषण',
      scenarios: 'परिदृश्य',
      settings: 'सेटिंग्स',
      
      // Dashboard
      'active-trains': 'सक्रिय ट्रेनें',
      'avg-delay': 'औसत देरी',
      'energy-efficiency': 'ऊर्जा दक्षता',
      'network-throughput': 'नेटवर्क थ्रूपुट',
      'conflict-zones': 'संघर्ष क्षेत्र',
      'total-savings': 'कुल बचत',
      
      // AI Assistant
      'ai-assistant': 'AI सहायक',
      'voice-input': 'आवाज इनपुट',
      'type-message': 'अपना संदेश टाइप करें...',
      'send-message': 'संदेश भेजें',
      'listening': 'सुन रहा है...',
      'processing': 'प्रसंस्करण...',
      
      // Recommendations
      'recommendations': 'सिफारिशें',
      'confidence': 'विश्वास',
      'accept': 'स्वीकार करें',
      'reject': 'अस्वीकार करें',
      'modify': 'संशोधित करें',
      'save-changes': 'परिवर्तन सहेजें',
      'cancel': 'रद्द करें',
      'ai-reasoning': 'AI तर्क',
      'affected-trains': 'प्रभावित ट्रेनें',
      'action-parameters': 'कार्य पैरामीटर',
      
      // Scenarios
      'what-if-scenarios': 'क्या-यदि परिदृश्य',
      'run-simulation': 'सिमुलेशन चलाएं',
      'simulation-results': 'सिमुलेशन परिणाम',
      'ai-impact-analysis': 'AI प्रभाव विश्लेषण',
      'save-scenario': 'परिदृश्य सहेजें',
      'load-scenario': 'परिदृश्य लोड करें',
      'export-scenarios': 'परिदृश्य निर्यात करें',
      'import-scenarios': 'परिदृश्य आयात करें',
      
      // Energy Analytics
      'energy-analytics': 'ऊर्जा विश्लेषण',
      'baseline': 'आधारभूत',
      'optimized': 'अनुकूलित',
      'actual': 'वास्तविक',
      'efficiency': 'दक्षता',
      'cost-saved': 'लागत बचत',
      'carbon-reduced': 'कार्बन कमी',
      'peak-hour': 'पीक आवर',
      
      // Conflict Analysis
      'conflict-analysis': 'संघर्ष विश्लेषण',
      'time-distance-heatmap': 'समय-दूरी हीटमैप',
      'severity-filter': 'गंभीरता फिल्टर',
      'time-range': 'समय सीमा',
      'export-data': 'डेटा निर्यात करें',
      
      // Common
      'loading': 'लोड हो रहा है...',
      'error': 'त्रुटि',
      'success': 'सफलता',
      'warning': 'चेतावनी',
      'info': 'जानकारी',
      'close': 'बंद करें',
      'save': 'सहेजें',
      'delete': 'हटाएं',
      'edit': 'संपादित करें',
      'view': 'देखें',
      'refresh': 'रीफ्रेश करें',
      'export': 'निर्यात करें',
      'import': 'आयात करें',
      'search': 'खोजें',
      'filter': 'फिल्टर करें',
      'sort': 'क्रमबद्ध करें',
      'live': 'लाइव',
      'offline': 'ऑफलाइन',
      'connected': 'जुड़ा हुआ',
      'disconnected': 'डिस्कनेक्ट',
      
      // Units
      'minutes': 'मिनट',
      'hours': 'घंटे',
      'seconds': 'सेकंड',
      'kilometers': 'किलोमीटर',
      'percentage': 'प्रतिशत',
      'rupees': 'रुपये',
      'kilowatts': 'किलोवाट',
      'kilograms': 'किलोग्राम',
      
      // Status
      'on-time': 'समय पर',
      'delayed': 'देरी से',
      'cancelled': 'रद्द',
      'critical': 'गंभीर',
      'high': 'उच्च',
      'medium': 'मध्यम',
      'low': 'कम',
      
      // Accessibility
      'skip-to-content': 'मुख्य सामग्री पर जाएं',
      'main-navigation': 'मुख्य नेवीगेशन',
      'search-trains': 'ट्रेन खोजें',
      'map-controls': 'मैप नियंत्रण',
      'zoom-in': 'ज़ूम इन',
      'zoom-out': 'ज़ूम आउट',
      'toggle-layer': 'लेयर टॉगल करें',
      'play-pause': 'चलाएं/रोकें',
      'previous': 'पिछला',
      'next': 'अगला',
      
      // Voice Commands
      'voice-commands': {
        'show-conflicts': '{{region}} में संघर्ष दिखाएं',
        'train-status': 'ट्रेन {{trainId}} की स्थिति क्या है?',
        'energy-report': 'ऊर्जा दक्षता रिपोर्ट तैयार करें',
        'run-scenario': '{{scenario}} परिदृश्य चलाएं',
        'optimize-route': 'ट्रेन {{trainId}} के लिए मार्ग अनुकूलित करें'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
