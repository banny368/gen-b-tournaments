/**
 * Gen B Tournaments — Configuration File
 * =======================================
 * Replace placeholder values with your actual credentials.
 * NEVER commit real keys to a public repository.
 */

const GENBCONFIG = {
  // ─── Supabase ────────────────────────────────────────────────────────────────
  supabase: {
    url: 'https://uuimjtabzepnoeevkjas.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aW1qdGFiemVwbm9lZXZramFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MzMzNzgsImV4cCI6MjA2MzMxOTM3OH0.6VvHXu7Xv5-i-eJ8-g8Q2F5zP_Qf8g49lQf8g49lQf8',
  },

  // ─── Cloudinary ──────────────────────────────────────────────────────────────
  cloudinary: {
    cloudName: 'ddmbdhanp',
    uploadPreset: 'mmvtshql',   // Create unsigned preset in Cloudinary dashboard
    baseUrl: 'https://res.cloudinary.com/ddmbdhanp/image/upload/',
  },

  // ─── OneSignal ───────────────────────────────────────────────────────────────
  oneSignal: {
    appId: '579e0b76-ecaa-4d31-ab79-817b9aea6e80',
    restApiKey: 'os_v2_app_k6paw5xmvjgtdk3zqf5zv2toqcsmbuinwcwuab4a54poflz5gvhf7kuledj76sjuo4k7td6yeimzvenpquzwqif7ltmfdys3ofo6nli',
  },

  // ─── App Settings ────────────────────────────────────────────────────────────
  app: {
    name: 'Gen B Tournaments',
    tagline: 'Show Your Skill And Earn Real Cash',
    currency: '₹',
    currencyCode: 'INR',
    version: '1.0.0',
    supportEmail: 'support@genbtournaments.com',
    telegramLink: 'https://t.me/genbtournaments',
    whatsappLink: 'https://wa.me/91XXXXXXXXXX',
  },

  // ─── Admin Settings ──────────────────────────────────────────────────────────
  admin: {
    roles: ['super_admin', 'admin', 'moderator'],
    defaultAdminEmail: 'admin@genbtournaments.com',
  },

  // ─── Feature Flags ───────────────────────────────────────────────────────────
  features: {
    referralSystem: true,
    clanSystem: true,
    chatSystem: true,
    spinWheel: true,
    dailyRewards: true,
    levelSystem: true,
    pushNotifications: true,
  },

  // ─── Game Categories ─────────────────────────────────────────────────────────
  games: [
    { id: 'bgmi', name: 'BGMI', icon: '🎮', color: '#ff6b35' },
    { id: 'freefire', name: 'Free Fire', icon: '🔥', color: '#ff2d78' },
    { id: 'cod', name: 'COD Mobile', icon: '💥', color: '#00d4ff' },
  ],

  // ─── Wallet Config ───────────────────────────────────────────────────────────
  wallet: {
    minDeposit: 50,
    maxDeposit: 50000,
    minWithdraw: 100,
    maxWithdraw: 10000,
    withdrawProcessingDays: 1,
    referralBonus: 10,      // ₹ per referral
  },

  // ─── Level System ────────────────────────────────────────────────────────────
  levels: [
    { level: 1, title: 'Recruit', xpRequired: 0, color: '#9ca3af' },
    { level: 2, title: 'Soldier', xpRequired: 100, color: '#22c55e' },
    { level: 3, title: 'Warrior', xpRequired: 300, color: '#3b82f6' },
    { level: 4, title: 'Elite', xpRequired: 600, color: '#8b5cf6' },
    { level: 5, title: 'Champion', xpRequired: 1000, color: '#f59e0b' },
    { level: 6, title: 'Legend', xpRequired: 1500, color: '#ef4444' },
    { level: 7, title: 'Mythic', xpRequired: 2500, color: '#ec4899' },
    { level: 8, title: 'Immortal', xpRequired: 4000, color: '#00d4ff' },
    { level: 9, title: 'Grandmaster', xpRequired: 6000, color: '#b14aed' },
    { level: 10, title: 'Gen B Pro', xpRequired: 10000, color: '#ffd700' },
  ],

  // ─── Spin Wheel Config ───────────────────────────────────────────────────────
  spinWheel: {
    cooldownHours: 24,
    prizes: [
      { label: '₹5', value: 5, type: 'cash', probability: 20, color: '#00d4ff' },
      { label: '₹10', value: 10, type: 'cash', probability: 15, color: '#b14aed' },
      { label: '₹20', value: 20, type: 'cash', probability: 10, color: '#ff2d78' },
      { label: '₹50', value: 50, type: 'cash', probability: 5, color: '#ffd700' },
      { label: '50 XP', value: 50, type: 'xp', probability: 20, color: '#22c55e' },
      { label: '100 XP', value: 100, type: 'xp', probability: 15, color: '#f59e0b' },
      { label: 'Try Again', value: 0, type: 'none', probability: 10, color: '#6b7280' },
      { label: '₹100', value: 100, type: 'cash', probability: 3, color: '#ff6b35' },
      { label: '200 XP', value: 200, type: 'xp', probability: 2, color: '#3b82f6' },
    ],
  },

  // ─── Daily Rewards ───────────────────────────────────────────────────────────
  dailyRewards: [
    { day: 1, reward: '₹5', type: 'cash', value: 5 },
    { day: 2, reward: '50 XP', type: 'xp', value: 50 },
    { day: 3, reward: '₹10', type: 'cash', value: 10 },
    { day: 4, reward: '100 XP', type: 'xp', value: 100 },
    { day: 5, reward: '₹20', type: 'cash', value: 20 },
    { day: 6, reward: '200 XP', type: 'xp', value: 200 },
    { day: 7, reward: '₹50', type: 'cash', value: 50 },
  ],
};

// Freeze config to prevent accidental mutation
Object.freeze(GENBCONFIG);
