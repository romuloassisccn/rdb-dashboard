import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Adicionamos a chave vite para estender as configurações base
  vite: {
    server: {
      allowedHosts: ["rdb-dashboard.2see.io"],
    },
  },
});
