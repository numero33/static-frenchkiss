import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": process.env,
    },
    resolve: {
        alias: {
            "@i18n": path.resolve(__dirname, "./src/i18n"),
        },
    },
});
