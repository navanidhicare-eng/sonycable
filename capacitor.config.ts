import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sonycable.app',
  appName: 'Sony Cable',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
