import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // GitHub Pages 部署配置
    // 如果仓库名是 username.github.io，则 base 为 '/'
    // 如果仓库名是其他名称（如 interview-），则 base 为 '/interview-/'
    // 可以通过环境变量 VITE_BASE_PATH 覆盖，或在 GitHub Actions 中设置
    const base = process.env.VITE_BASE_PATH 
      || (process.env.GITHUB_REPOSITORY 
        ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
        : '/'); // 本地开发时使用根路径
    
    return {
      base, // GitHub Pages 部署路径
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
