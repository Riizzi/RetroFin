import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.retrofin',
  appName: 'RetroFin',
  webDir: 'dist',
  backgroundColor: '#FAF7F2',
  plugins: {
    SystemBars: { style: 'LIGHT' },
  },
};

export default config;
