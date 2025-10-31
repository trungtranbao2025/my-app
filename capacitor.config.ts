import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ibst.qlda',
  appName: 'IBST BIM - Quản lý Dự án',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  ios: {
    // You must add these to ios/App/App/Info.plist after adding iOS platform
    // NSCameraUsageDescription / NSMicrophoneUsageDescription
    // so OCR (camera upload) and Voice Input work properly
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#ffffff'
  },
  android: {
    allowMixedContent: false
  },
  // Allow navigation to Supabase domains (auth redirects/embeds)
  // Edit if you use custom domains
  // @ts-ignore - Supported in runtime by Capacitor WebView
  allowNavigation: ['*.supabase.co']
}

export default config
