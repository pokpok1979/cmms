# AGE CMMS PWA

Build with `npm run build` and serve with `npm start` over HTTPS.
Local testing can use `http://localhost:3000`. Plain HTTP on a LAN IP
(for example `http://192.168.18.89:3000`) does not support service workers.
The worker and custom install prompt are enabled only in production builds.

Chrome/Edge/Android: use the install button when offered or the browser's
Install app menu. iPhone/iPad: open in Safari, then Share → Add to Home Screen.
The installed app uses the existing authentication and permissions.

The service worker caches only the public offline page and app icons.
API requests, authenticated HTML, React Server Component payloads and
attachments are never stored by it. Reading and saving business records
requires a network connection. There is no offline submission queue or Web
Push subscription; existing email notifications continue independently.

When disconnected, an already-open window shows an offline banner. A failed
full navigation shows the public fallback page. Its retry link opens the app.
Updates wait until existing windows close to preserve unsaved forms.
Increment `CACHE` in `public/sw.js` when offline assets change.

After deployment, verify in browser DevTools → Application:

1. Manifest has valid 192/512 PNG icons and standalone display.
2. Service worker activates at `/` and `/sw.js` has no-cache headers.
3. Install and launch; confirm authentication works.
4. With the worker active, enable Offline and reload: fallback appears.
5. Return online and retry; confirm APIs and form submission work.
6. Cache Storage contains only public offline assets, including after logout.
7. Deploy an updated worker; existing forms stay open until windows close.

Reference: https://nextjs.org/docs/app/guides/progressive-web-apps
