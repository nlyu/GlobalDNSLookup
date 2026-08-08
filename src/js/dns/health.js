const RETRY_DELAY_MS = 60_000;

export class ProviderHealth {
  constructor() {
    this.providers = new Map();
  }

  canTry(provider) {
    const state = this.providers.get(provider);
    return !state || state.retryAt <= Date.now();
  }

  success(provider) {
    this.providers.delete(provider);
  }

  failure(provider) {
    this.providers.set(provider, { retryAt: Date.now() + RETRY_DELAY_MS });
  }
}
