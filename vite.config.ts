import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 開発時はViteが5173番、サーバーが3001番で動くため、socket.io/APIをプロキシする。
// 本番は `npm run build` で生成した dist/ をサーバー(3001番)が直接配信する。
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 開発中もLAN内のタブレットから確認できるように
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
});
