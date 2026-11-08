import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { assert } from '../utils/errors.js';
import { sign, constantEqual } from '../utils/crypto.js';

async function loadAdapter(modulePath, exportName, config, methods) {
  const module = await import(pathToFileURL(path.resolve(modulePath)).href);
  assert(typeof module[exportName] === 'function', 500, 'ADAPTER_INVALID', `Adapter must export ${exportName}`);
  const adapter = await module[exportName]({ config });
  for (const method of methods) assert(typeof adapter[method] === 'function', 500, 'ADAPTER_INVALID', `Adapter must implement ${method}`);
  return adapter;
}

export async function createProviders(config, repos) {
  const payment = config.PAYMENT_PROVIDER
    ? { ...await loadAdapter(config.PAYMENT_ADAPTER_MODULE, 'createPaymentAdapter', config, ['createCheckout', 'verifyWebhook']), enabled: true, provider: config.PAYMENT_PROVIDER }
    : { enabled: false, provider: null };
  const storage = config.STORAGE_PROVIDER === 'custom'
    ? await loadAdapter(config.STORAGE_ADAPTER_MODULE, 'createStorageAdapter', config, ['putAvatar', 'deleteAvatar'])
    : {
      async putAvatar({ bytes, userId }) {
        const asset = await repos.asset.create({ bytes, mimeType: 'image/webp', userId });
        return { id: asset.id, url: `/api/v1/assets/${asset.id}` };
      },
      deleteAvatar: ({ id }) => repos.asset.delete(id),
    };
  const video = config.VIDEO_PROVIDER === 'custom'
    ? await loadAdapter(config.VIDEO_ADAPTER_MODULE, 'createVideoAdapter', config, ['createPlayback'])
    : config.VIDEO_PROVIDER === 'signed-local' ? localVideo(config) : { createPlayback: async () => null };
  return { payment, storage, video };
}

// A local development adapter only. Files are never mounted as a public directory.
export function localVideo(config) {
  assert(config.NODE_ENV !== 'production', 500, 'INVALID_CONFIGURATION', 'Local video is disabled in production');
  const root = path.resolve(config.MEDIA_LOCAL_DIR);
  const payload = ({ assetId, lessonId, userId, sessionId, expires }) => `media:${assetId}:${lessonId}:${userId}:${sessionId}:${expires}`;
  return {
    async createPlayback(context) {
      assert(/^[a-zA-Z0-9_-]+$/.test(context.assetId), 400, 'INVALID_ASSET', 'Invalid media asset identifier');
      const file = path.join(root, `${context.assetId}.mp4`);
      try { assert((await stat(file)).isFile(), 404, 'MEDIA_UNAVAILABLE', 'Local media file is unavailable'); }
      catch { return null; }
      const expires = Math.floor(Date.now() / 1000) + 120;
      const signature = sign(config.SESSION_SECRET, payload({ ...context, expires }));
      return { url: `/api/v1/media/${context.lessonId}?expires=${expires}&signature=${signature}`, expiresAt: new Date(expires * 1000).toISOString(), type: 'video/mp4' };
    },
    resolve(context, expires, signature) {
      assert(Number.isSafeInteger(expires) && expires >= Math.floor(Date.now() / 1000) && expires <= Math.floor(Date.now() / 1000) + 120, 403, 'MEDIA_EXPIRED', 'Media link expired');
      assert(constantEqual(signature, sign(config.SESSION_SECRET, payload({ ...context, expires }))), 403, 'MEDIA_FORBIDDEN', 'Invalid media signature');
      assert(/^[a-zA-Z0-9_-]+$/.test(context.assetId), 403, 'MEDIA_FORBIDDEN', 'Invalid media asset');
      return path.join(root, `${context.assetId}.mp4`);
    },
  };
}
