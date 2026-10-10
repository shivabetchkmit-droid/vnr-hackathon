/// <reference types="vite/client" />
import { SnvAiApi } from '../electron/preload';

declare global {
  interface Window {
    snvAi: SnvAiApi;
  }
}
