const fs = require('fs');
const path = require('path');

class Telemetry {
  constructor() {
    this.workspaceRoot = null;
    this.storageFile = null;
    this.configFile = null;
    this.config = { enabled: false, anonymousId: null, optInTimestamp: undefined, optOutTimestamp: undefined };
    this.queue = [];
    this.initialized = false;
  }

  async init({ workspaceRoot, optIn } = {}) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    const dir = path.join(this.workspaceRoot, '.kiro');
    this.storageFile = path.join(dir, 'telemetry.json');
    this.configFile = path.join(dir, 'telemetry-config.json');

    await this.ensureDir(dir);
    await this.loadConfig();

    if (optIn === true) {
      await this.optIn();
    }

    this.initialized = true;
  }

  isEnabled() {
    return this.config.enabled === true;
  }

  async optIn() {
    this.config.enabled = true;
    this.config.optInTimestamp = Date.now();
    this.config.optOutTimestamp = undefined;
    if (!this.config.anonymousId) this.config.anonymousId = this.generateAnonymousId();
    await this.saveConfig();
  }

  async optOut() {
    this.config.enabled = false;
    this.config.optOutTimestamp = Date.now();
    this.config.optInTimestamp = undefined;
    await this.saveConfig();
  }

  async trackEvent(type, data = {}) {
    try {
      if (!this.isEnabled()) return;
      const event = {
        type,
        timestamp: Date.now(),
        anonymousId: this.config.anonymousId || this.generateAnonymousId(),
        data: this.sanitizeData(data)
      };

      let existing = [];
      try {
        if (fs.existsSync(this.storageFile)) {
          const raw = fs.readFileSync(this.storageFile, 'utf8');
          existing = JSON.parse(raw || '[]');
        }
      } catch (e) {
        // ignore
      }

      existing.push(event);
      // keep last 10000
      const recent = existing.slice(-10000);
      fs.writeFileSync(this.storageFile, JSON.stringify(recent, null, 2), 'utf8');
    } catch (e) {
      // swallow telemetry errors
    }
  }

  sanitizeData(data) {
    if (!data || typeof data !== 'object') return {};
    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      const lk = k.toLowerCase();
      if (lk.includes('email') || lk.includes('password') || lk.includes('token') || lk.includes('secret') || lk.includes('key') || lk.includes('username') || lk.includes('name') || lk.includes('path') || lk.includes('file')) {
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeData(v);
      } else if (Array.isArray(v)) {
        sanitized[k] = v.map(item => (typeof item === 'object' ? this.sanitizeData(item) : item));
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  async ensureDir(dir) {
    return new Promise((resolve, reject) => {
      fs.mkdir(dir, { recursive: true }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        this.config = Object.assign(this.config, parsed);
      } else {
        this.config.anonymousId = this.generateAnonymousId();
        await this.saveConfig();
      }
    } catch (e) {
      // ignore
    }
  }

  async saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  generateAnonymousId() {
    return (Math.random().toString(36).slice(2) + Date.now().toString(36)).substr(0, 32);
  }
}

module.exports = new Telemetry();
