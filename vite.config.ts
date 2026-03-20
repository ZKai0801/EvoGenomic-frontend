import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // 允许外部网络访问
    port: 3000,
    open: false,  // 服务器端不需要自动打开浏览器
    hmr: {
      // 允许远程 HMR 连接（通过客户端浏览器地址自动连接）
      clientPort: 5173,
    },
  },
  preview: {
    host: '0.0.0.0',  // 公网服务器需要监听所有接口
    port: 80,          // 标准 HTTP 端口
  },
})
