// vite.config.ts
import { defineConfig } from "file:///C:/dev/herero-dict/node_modules/vite/dist/node/index.js";
import react from "file:///C:/dev/herero-dict/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///C:/dev/herero-dict/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/dev/herero-dict/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\dev\\herero-dict";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3400,
    proxy: {
      // Local translation proxy (scripts/rag-server.mjs). In production this
      // path is served by api/translate.mjs on the same origin.
      "/api": {
        target: "http://localhost:3401",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", () => {
          });
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true
      },
      includeAssets: [
        "favicon.ico",
        "og-image.svg",
        "facebook.png",
        "placeholder.svg",
        "index.html"
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
            type: "image/png"
          },
          {
            src: "/facebook.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        // json: lexicon.json (dictionary data) + manifest must survive offline
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,json}"],
        // Ensure SPA navigations always fall back to index.html when offline
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // HTML navigation requests (SPA routes)
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 3
            }
          },
          {
            // Static assets
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "asset-cache"
            }
          },
          {
            // Images
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    }),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxkZXZcXFxcaGVyZXJvLWRpY3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXGRldlxcXFxoZXJlcm8tZGljdFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovZGV2L2hlcmVyby1kaWN0L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiAzNDAwLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgLy8gTG9jYWwgdHJhbnNsYXRpb24gcHJveHkgKHNjcmlwdHMvcmFnLXNlcnZlci5tanMpLiBJbiBwcm9kdWN0aW9uIHRoaXNcclxuICAgICAgLy8gcGF0aCBpcyBzZXJ2ZWQgYnkgYXBpL3RyYW5zbGF0ZS5tanMgb24gdGhlIHNhbWUgb3JpZ2luLlxyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjM0MDFcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHkpID0+IHtcclxuICAgICAgICAgIC8vIHRoZSBwcm94eSBpcyBvcHRpb25hbDogc2lsZW5jZSBjb25uZWN0aW9uIG5vaXNlIHdoZW4gaXQgaXMgbm90IHJ1bm5pbmdcclxuICAgICAgICAgIHByb3h5Lm9uKFwiZXJyb3JcIiwgKCkgPT4ge30pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG4gICAgICBpbmplY3RSZWdpc3RlcjogXCJhdXRvXCIsXHJcbiAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbXHJcbiAgICAgICAgXCJmYXZpY29uLmljb1wiLFxyXG4gICAgICAgIFwib2ctaW1hZ2Uuc3ZnXCIsXHJcbiAgICAgICAgXCJmYWNlYm9vay5wbmdcIixcclxuICAgICAgICBcInBsYWNlaG9sZGVyLnN2Z1wiLFxyXG4gICAgICAgIFwiaW5kZXguaHRtbFwiLFxyXG4gICAgICBdLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6IFwiT3RqaWhlcmVybyBEaWN0aW9uYXJ5XCIsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogXCJIZXJlcm8gRGljdFwiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIk9mZmxpbmUtZnJpZW5kbHkgT3RqaWhlcmVybyBEaWN0aW9uYXJ5XCIsXHJcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9cIixcclxuICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjZmZmZmZmXCIsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzNmMmQxNlwiLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogXCIvZmFjZWJvb2sucG5nXCIsXHJcbiAgICAgICAgICAgIHNpemVzOiBcIjE5MngxOTJcIixcclxuICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogXCIvZmFjZWJvb2sucG5nXCIsXHJcbiAgICAgICAgICAgIHNpemVzOiBcIjUxMng1MTJcIixcclxuICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIC8vIGpzb246IGxleGljb24uanNvbiAoZGljdGlvbmFyeSBkYXRhKSArIG1hbmlmZXN0IG11c3Qgc3Vydml2ZSBvZmZsaW5lXHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXCIqKi8qLntqcyxjc3MsaHRtbCxzdmcscG5nLGljbyx3ZWJwLGpzb259XCJdLFxyXG4gICAgICAgIC8vIEVuc3VyZSBTUEEgbmF2aWdhdGlvbnMgYWx3YXlzIGZhbGwgYmFjayB0byBpbmRleC5odG1sIHdoZW4gb2ZmbGluZVxyXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6IFwiaW5kZXguaHRtbFwiLFxyXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIEhUTUwgbmF2aWdhdGlvbiByZXF1ZXN0cyAoU1BBIHJvdXRlcylcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogKHsgcmVxdWVzdCB9KSA9PiByZXF1ZXN0Lm1vZGUgPT09IFwibmF2aWdhdGVcIixcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJodG1sLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgbmV0d29ya1RpbWVvdXRTZWNvbmRzOiAzLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gU3RhdGljIGFzc2V0c1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAoeyByZXF1ZXN0IH0pID0+XHJcbiAgICAgICAgICAgICAgW1wic3R5bGVcIiwgXCJzY3JpcHRcIiwgXCJ3b3JrZXJcIl0uaW5jbHVkZXMocmVxdWVzdC5kZXN0aW5hdGlvbiksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiU3RhbGVXaGlsZVJldmFsaWRhdGVcIixcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJhc3NldC1jYWNoZVwiLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gSW1hZ2VzXHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46ICh7IHJlcXVlc3QgfSkgPT4gcmVxdWVzdC5kZXN0aW5hdGlvbiA9PT0gXCJpbWFnZVwiLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJpbWFnZS1jYWNoZVwiLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOE8sU0FBUyxvQkFBb0I7QUFDM1EsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFKeEIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQTtBQUFBLE1BR0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsV0FBVyxDQUFDLFVBQVU7QUFFcEIsZ0JBQU0sR0FBRyxTQUFTLE1BQU07QUFBQSxVQUFDLENBQUM7QUFBQSxRQUM1QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZ0JBQWdCO0FBQUEsTUFDaEIsWUFBWTtBQUFBLFFBQ1YsU0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBLGVBQWU7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLFNBQVM7QUFBQSxRQUNULGtCQUFrQjtBQUFBLFFBQ2xCLGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQTtBQUFBLFFBRVAsY0FBYyxDQUFDLDBDQUEwQztBQUFBO0FBQUEsUUFFekQsa0JBQWtCO0FBQUEsUUFDbEIsZ0JBQWdCO0FBQUEsVUFDZDtBQUFBO0FBQUEsWUFFRSxZQUFZLENBQUMsRUFBRSxRQUFRLE1BQU0sUUFBUSxTQUFTO0FBQUEsWUFDOUMsU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1AsV0FBVztBQUFBLGNBQ1gsdUJBQXVCO0FBQUEsWUFDekI7QUFBQSxVQUNGO0FBQUEsVUFDQTtBQUFBO0FBQUEsWUFFRSxZQUFZLENBQUMsRUFBRSxRQUFRLE1BQ3JCLENBQUMsU0FBUyxVQUFVLFFBQVEsRUFBRSxTQUFTLFFBQVEsV0FBVztBQUFBLFlBQzVELFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxZQUNiO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQTtBQUFBLFlBRUUsWUFBWSxDQUFDLEVBQUUsUUFBUSxNQUFNLFFBQVEsZ0JBQWdCO0FBQUEsWUFDckQsU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1AsV0FBVztBQUFBLGNBQ1gsWUFBWSxFQUFFLFlBQVksS0FBSyxlQUFlLEtBQUssS0FBSyxLQUFLLEdBQUc7QUFBQSxZQUNsRTtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0QsU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUEsRUFDNUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
