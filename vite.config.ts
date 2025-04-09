import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { v4 as uuidv4 } from 'uuid';
import basicSsl from '@vitejs/plugin-basic-ssl';
import qs from 'qs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), basicSsl()],
    server: {
      proxy: {
        '/auth-proxy': {
          target: env.VITE_AUTH_URL, // Используем значение из .env
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/auth-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if ('body' in req && req.body) {
                const bodyData = qs.stringify(req.body);
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
              }
              proxyReq.setHeader('RqUID', uuidv4());
            });
          }
        },
        '/api-proxy': {
          target: env.VITE_BASE_URL, // Используем значение из .env
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept', 'application/json');
            });
          }
        }
      }
    }
  };
});