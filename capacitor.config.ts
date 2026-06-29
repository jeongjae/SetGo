import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.setgo.mobile',
  appName: 'SetGo',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/SetGoDatabase',
      iosIsEncryption: false,
    },
  },
};

export default config;
