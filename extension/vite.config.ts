import { defineConfig } from 'vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Unpolish',
  version: '0.1.0',
  description: 'Rewrite the text you\'re typing in a casual or professional tone, on any site.',
  permissions: ['storage'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true
    }
  ],
  options_page: 'src/options/options.html',
  action: {
    default_title: 'Unpolish options'
  }
});

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'esnext',
    sourcemap: true,
    emptyOutDir: true
  }
});
