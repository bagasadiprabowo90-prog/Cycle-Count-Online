import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './index.css';
import { registerServiceWorker } from './lib/sw-register';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

// Register PWA service worker in browser
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    await registerServiceWorker();
  });
}

