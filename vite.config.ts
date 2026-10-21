// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        manifest: false,
        workbox: {
          // SSR app: no static index.html, so the visited "/" page is cached at runtime and served on offline reloads.
          navigateFallback: null,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,css,png,jpg,svg,woff2,webmanifest}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, url, sameOrigin }) =>
                sameOrigin && (request.mode === "navigate" || url.pathname === "/") && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/_serverFn"),
              handler: "NetworkFirst",
              options: { cacheName: "nexus-pages", networkTimeoutSeconds: 3, matchOptions: { ignoreSearch: true }, cacheableResponse: { statuses: [200] } },
            },
            {
              urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(png|jpg|webmanifest)$/.test(url.pathname),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "nexus-media" },
            },
            {
              // Offline voice (KittenTTS): code from esm.sh, model + voices from Hugging Face, wasm from jsDelivr.
              urlPattern: ({ url }) => /(^|\.)esm\.sh$|huggingface\.co$|hf\.co$|cdn\.jsdelivr\.net$|cdn-lfs.*\.hf\.co$|xethub\.hf\.co$/.test(url.hostname),
              handler: "CacheFirst",
              options: { cacheName: "nexus-voice", cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 200 } },
            },
          ],
        },
      }),
    ],
  },
});
