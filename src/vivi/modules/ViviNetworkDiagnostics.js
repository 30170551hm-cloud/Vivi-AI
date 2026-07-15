import { ModuleBase } from '../core/ModuleBase';
import { EVENTS } from '../events';
import { toast } from '@/components/ui/use-toast';

export default class ViviNetworkDiagnostics extends ModuleBase {
  constructor(bus) {
    super('network_diagnostics', bus);
    this._online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this._pingInProgress = false;
  }

  async init(registry) {
    await super.init(registry);
    this._diag('Network Diagnostics module initialized.');

    if (typeof window !== 'undefined') {
      this._setupListeners();
      this._setupFetchInterceptor();
    }
  }

  _setupListeners() {
    window.addEventListener('online', () => this._handleOnlineChange(true));
    window.addEventListener('offline', () => this._handleOnlineChange(false));
  }

  async _handleOnlineChange(online) {
    if (this._online === online) return;

    if (online) {
      // Before trusting navigator.onLine, run a quick real-world ping check to be sure
      const realOnline = await this.checkRealConnectivity();
      if (!realOnline) {
        this._diag('navigator.onLine claims ONLINE but real ping test failed.');
        return;
      }
    }

    this._online = online;
    this._diag(`Network status changed to ${online ? 'ONLINE' : 'OFFLINE'}`);
    this.emit('network:status', { online });

    if (!online) {
      this._showOfflineToast();
    } else {
      this._showOnlineToast();
    }
  }

  isOnline() {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine && this._online;
    }
    return this._online;
  }

  async checkRealConnectivity() {
    if (typeof window === 'undefined') return false;
    if (this._pingInProgress) return this._online;

    this._pingInProgress = true;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1500);

      const res = await window.fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);
      this._pingInProgress = false;
      return res.ok;
    } catch (err) {
      this._pingInProgress = false;
      return false;
    }
  }

  _showOfflineToast() {
    try {
      toast({
        variant: "destructive",
        title: "⚠️ Sin Conexión",
        description: "Vivi ha detectado que se perdió la conexión a internet.",
      });
    } catch { /* noop */ }
  }

  _showOnlineToast() {
    try {
      toast({
        title: "⚡ Conexión Restablecida",
        description: "Vivi está en línea de nuevo.",
      });
    } catch { /* noop */ }
  }

  _setupFetchInterceptor() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      
      const isApiRequest = url.includes('/api/') || 
                           url.includes('firestore.googleapis.com') || 
                           url.includes('identitytoolkit.googleapis.com');

      if (isApiRequest) {
        // 1. Immediate offline check
        if (!self.isOnline()) {
          self._diag('Pre-empted API call due to offline status', { url });
          self._showOfflineAttemptToast(url);
          throw new Error(`CONEXIÓN PERDIDA: No se puede conectar con el servidor para la petición: ${url}`);
        }

        // 2. Wrap request to detect sudden network drops
        try {
          return await originalFetch.call(this, input, init);
        } catch (err) {
          self._diagError('API request fetch exception detected. Verifying real connectivity...', err);
          
          const stillOnline = await self.checkRealConnectivity();
          if (!stillOnline) {
            self._online = false;
            self.emit('network:status', { online: false });
            self._showOfflineToast();
            throw new Error(`CONEXIÓN PERDIDA: La petición falló por pérdida repentina de red.`);
          }
          throw err;
        }
      }

      return originalFetch.call(this, input, init);
    };
  }

  _showOfflineAttemptToast(url) {
    try {
      toast({
        variant: "destructive",
        title: "⚠️ Petición Cancelada",
        description: "No se puede completar la operación porque estás sin conexión a internet.",
      });
    } catch { /* noop */ }
  }

  health() {
    return { name: this.name, healthy: this._initialized, online: this.isOnline() };
  }
}
