import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('react-syntax-highlighter') ||
            id.includes('highlight.js') ||
            id.includes('refractor') ||
            id.includes('prismjs')
          ) {
            return 'code-highlight';
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('micromark') ||
            id.includes('mdast-util') ||
            id.includes('hast-util') ||
            id.includes('unist-')
          ) {
            return 'markdown';
          }

          if (id.includes('katex')) {
            return 'katex';
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router') ||
            id.includes('scheduler')
          ) {
            return 'react-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return undefined;
        },
      },
    },
  },
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
