/**
 * Screenshot Monitoring Configuration
 */

export const SCREENSHOT_CONFIG = {
  // Feature flags
  ENABLED_BY_DEFAULT: true,
  
  // Vision server URLs
  VISION_SERVER_URL: {
    development: 'http://10.0.2.2:5050/analyze', // Android emulator localhost
    production: 'https://your-production-server.com/analyze',
  },

  // Capture settings
  CAPTURE_COOLDOWN_MS: 60000, // 1 minute between captures per app
  MAX_IMAGE_SIZE_KB: 500, // Max image size before compression
  IMAGE_QUALITY: 0.8, // JPEG quality (0.0-1.0)
  IMAGE_FORMAT: 'jpg', // 'jpg' or 'png'

  // Analysis settings
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
  REQUEST_TIMEOUT_MS: 30000, // 30 seconds

  // Offline queue settings
  MAX_QUEUE_SIZE: 50, // Max items in offline queue
  QUEUE_EXPIRY_HOURS: 24, // Auto-remove items older than this
  AUTO_SYNC_ON_RECONNECT: true,

  // Risk thresholds (create alerts for these levels)
  ALERT_RISK_LEVELS: ['MEDIUM', 'HIGH', 'CRITICAL'], // Exclude 'LOW'

  // Suspicious app patterns (apps that trigger screenshot capture)
  SUSPICIOUS_PATTERNS: [
    // Social media
    'facebook',
    'instagram',
    'snapchat',
    'tiktok',
    'twitter',
    'telegram',
    'whatsapp',
    'messenger',
    'discord',
    'reddit',
    'tumblr',
    'pinterest',
    
    // Browsers
    'chrome',
    'firefox',
    'opera',
    'edge',
    'brave',
    'safari',
    'browser',
    'duckduckgo',
    
    // Messaging
    'sms',
    'messages',
    'signal',
    'viber',
    'line',
    'wechat',
    'kik',
    'skype',
    
    // Video platforms
    'youtube',
    'vimeo',
    'twitch',
    'dailymotion',
    
    // Dating apps
    'tinder',
    'bumble',
    'hinge',
    'okcupid',
    'match',
    'pof',
    
    // Anonymous/private apps
    'incognito',
    'vault',
    'calculator', // Often disguised vaults
    'private',
    'secret',
    'anonymous',
    
    // Gaming/chat
    'roblox',
    'fortnite',
    'minecraft',
    'among',
  ],

  // Apps to EXCLUDE from monitoring (false positives)
  EXCLUDE_PATTERNS: [
    'settings',
    'launcher',
    'systemui',
    'android',
    'google.android',
    'familyguard', // Don't capture our own app
  ],

  // Privacy settings
  PRIVACY: {
    DELETE_AFTER_UPLOAD: true, // Delete local screenshots after analysis
    STORE_SCREENSHOTS_IN_FIRESTORE: false, // Don't store full images (just alerts)
    LOG_ANALYSIS_RESULTS: true, // Log SafeSearch scores for debugging
  },
};

/**
 * Get vision server URL based on environment
 */
export const getVisionServerUrl = () => {
  return __DEV__ 
    ? SCREENSHOT_CONFIG.VISION_SERVER_URL.development
    : SCREENSHOT_CONFIG.VISION_SERVER_URL.production;
};

/**
 * Check if an app should be excluded from monitoring
 */
export const isExcludedApp = (packageName) => {
  const lowerPackage = packageName.toLowerCase();
  return SCREENSHOT_CONFIG.EXCLUDE_PATTERNS.some((pattern) =>
    lowerPackage.includes(pattern)
  );
};

/**
 * Check if a risk level should trigger an alert
 */
export const shouldCreateAlert = (riskLevel) => {
  return SCREENSHOT_CONFIG.ALERT_RISK_LEVELS.includes(riskLevel);
};
