/**
 * @author Shakib
 * @since 25/10/26
 */
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Veil — Smart Chat Privacy',
    short_name: 'Veil',
    description:
      'Blur WhatsApp Web, Telegram and Messenger until you hover. Hides codes, card numbers and other private details automatically. 100% on-device.',
    permissions: ['storage', 'contextMenus'],
    host_permissions: [
      'https://web.whatsapp.com/*',
      'https://web.telegram.org/*',
      'https://www.messenger.com/*',
      'https://www.facebook.com/*',
    ],
    commands: {
      panic: {
        suggested_key: { default: 'Alt+Shift+V' },
        description: 'Panic: cover every chat instantly (press again to restore)',
      },
      toggle: {
        suggested_key: { default: 'Alt+Shift+B' },
        description: 'Turn Veil protection on or off',
      },
    },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 128: '/icon/128.png' },
    action: {
      default_title: 'Veil',
      default_icon: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 128: '/icon/128.png' },
    },
  },
});
