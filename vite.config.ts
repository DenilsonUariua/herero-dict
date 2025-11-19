import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3400,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      includeAssets: [
        "favicon.ico",
        "og-image.svg",
        "facebook.png",
        "placeholder.svg",
        "index.html",
      ],
      manifest: {
        name: "Otjiherero Dictionary",
        short_name: "Herero Dict",
        description: "Offline-friendly Otjiherero Dictionary",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#3f2d16",
        icons: [
          {
            src: "/facebook.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/facebook.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp}"],
        // Ensure SPA navigations always fall back to index.html when offline
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // HTML navigation requests (SPA routes)
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Static assets
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "asset-cache",
            },
          },
          {
            // Images
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
