import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';


export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [react()],  
    resolve: {
      alias: {
        '@': './*'
      }
    }
  }),
  webExt: {
    startUrls: ["https://wikipedia.org"],  
  },
  manifest: {
    name: 'TrackJobs',
    description: 'Track and manage your job applications with ease',
    version: '1.2.2',
    permissions: ['activeTab', 'storage', 'scripting', 'cookies'],
    //These are personal configs... just for testing purpose adjust accordingly
    host_permissions: [
      'http://localhost:3000/*',
      'https://localhost:3000/*',
      'https://trackjobs.co/*'
    ],
    action: {
      default_icon: {
        '48': '/icons/trackjobs_logo_48.png',
        '128': '/icons/trackjobs_logo_128.png',
        '256': '/icons/trackjobs_logo_256.png'
      }
    },
    icons: {
      '48': '/icons/trackjobs_logo_48.png',
      '128': '/icons/trackjobs_logo_128.png',
      '256' : '/icons/trackjobs_logo_256.png'
    },
    web_accessible_resources: [
      {
        resources: ['*.html', '*.png', 'fonts/*.ttf', '*.js', '*.css'],
        matches: ['https://*/*']
      }
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';"
    }
  },
});

