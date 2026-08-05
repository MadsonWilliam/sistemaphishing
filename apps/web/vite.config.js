import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Em dev, faz proxy da API e do rastreio para o backend (porta 3333).
// Em produção o NestJS serve este build na mesma origem — sem proxy/CORS.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3333',
            '/t': 'http://localhost:3333',
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
});
