import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';

// 插件：在构建后创建 .nojekyll 文件
const nojekyllPlugin = () => {
  return {
    name: 'nojekyll',
    closeBundle() {
      try {
        writeFileSync(path.resolve(__dirname, 'dist/.nojekyll'), '');
      } catch (error) {
        // 忽略错误，文件可能已经存在
      }
    },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: {
          strict: false,
        },
      },
      plugins: [react(), nojekyllPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: undefined,
          },
        },
      },
    };
});
