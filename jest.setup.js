// Jest setup file to handle global variables and polyfills for Node.js environment
// This ensures compatibility across different Node.js versions in CI

console.log(`Node.js version: ${process.version}`);

// Polyfill Web APIs that are missing in Node.js test environment
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(chunks, filename, options = {}) {
      this.chunks = chunks;
      this.name = filename;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
      this.size = chunks.reduce((size, chunk) => size + (chunk.length || 0), 0);
    }

    stream() {
      return new global.ReadableStream({
        start(controller) {
          this.chunks.forEach(chunk => controller.enqueue(chunk));
          controller.close();
        },
      });
    }

    text() {
      return Promise.resolve(this.chunks.join(''));
    }

    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(this.size));
    }
  };
}

if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this._data = new Map();
    }

    append(key, value) {
      if (this._data.has(key)) {
        const existing = this._data.get(key);
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          this._data.set(key, [existing, value]);
        }
      } else {
        this._data.set(key, value);
      }
    }

    get(key) {
      const value = this._data.get(key);
      return Array.isArray(value) ? value[0] : value;
    }

    getAll(key) {
      const value = this._data.get(key);
      return Array.isArray(value) ? value : [value];
    }

    has(key) {
      return this._data.has(key);
    }

    delete(key) {
      this._data.delete(key);
    }

    entries() {
      return this._data.entries();
    }

    keys() {
      return this._data.keys();
    }

    values() {
      return this._data.values();
    }
  };
}

// Polyfill Blob if missing
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(chunks = [], options = {}) {
      this.chunks = chunks;
      this.type = options.type || '';
      this.size = chunks.reduce((size, chunk) => size + (chunk.length || 0), 0);
    }

    text() {
      return Promise.resolve(this.chunks.join(''));
    }

    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(this.size));
    }
  };
}

// Polyfill ReadableStream if missing
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(source) {
      this.source = source;
    }
  };
}

// Suppress experimental warnings in tests
const originalEmit = process.emit;
process.emit = function (name, data, ..._args) {
  if (name === 'warning' && typeof data === 'object' && data.name === 'ExperimentalWarning') {
    return false;
  }
  return originalEmit.apply(process, arguments);
};
