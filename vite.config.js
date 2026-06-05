// Rapier WASM 은 pre-bundling 제외 — 안 그러면 Vite 가 wasm 깨먹음
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'esnext', // top-level await 사용 (Rapier WASM init)
  },
});
