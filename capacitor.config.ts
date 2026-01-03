import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goalseek.app',
  appName: 'GoalSeek',
  webDir: 'out', // Next.js static export directory
  server: {
    // For development - load from local dev server
    // Comment out or remove for production builds
    url: 'http://192.168.86.33:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scheme: 'GoalSeek',
  },
  plugins: {
    // Photo library plugin configuration
  },
};

export default config;
