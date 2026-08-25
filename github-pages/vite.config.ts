import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** GitHub Pages 使用相对资源路径，同时兼容项目子路径和自定义域名。 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      /** 纯静态构建不使用服务端图片优化，映射到原生图片组件。 */
      "next/image": fileURLToPath(new URL("./next-image.tsx", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../dist-github-pages", import.meta.url)),
    emptyOutDir: true,
  },
});
