import sharp from 'sharp';
import { assert, found, AppError } from '../utils/errors.js';

export function profileService(repos, storage, config) {
  return {
    get: async id => found(await repos.user.get(id)),
    update: (id, input) => repos.user.update(id, input),
    async avatar(userId, file) {
      assert(file, 400, 'VALIDATION_ERROR', 'Attach an avatar file');
      let bytes;
      try {
        const image = sharp(file.buffer, { limitInputPixels: 16000000, animated: false, failOn: 'warning' });
        const metadata = await image.metadata();
        assert(['jpeg', 'png', 'webp'].includes(metadata.format) && (metadata.pages ?? 1) === 1, 400, 'INVALID_IMAGE', 'Use a non-animated JPEG, PNG, or WebP image');
        // Decode/re-encode removes metadata and rejects files that only spoof MIME types.
        bytes = await image.rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(400, 'INVALID_IMAGE', 'Invalid or unsupported image content');
      }
      if (config.STORAGE_PROVIDER === 'database') {
        return repos.transaction(async r => {
          await r.lock(`user:${userId}`);
          const asset = await r.asset.create({ bytes, userId, mimeType: 'image/webp' });
          const user = await r.user.update(userId, { avatarUrl: `/api/v1/assets/${asset.id}` });
          await r.asset.removeOld(userId, asset.id);
          return user;
        });
      }
      const asset = await storage.putAvatar({ userId, bytes, contentType: 'image/webp' });
      assert(asset && typeof asset.id === 'string' && typeof asset.url === 'string' && (asset.url.startsWith('/api/v1/assets/') || asset.url.startsWith('https://')), 500, 'ADAPTER_INVALID', 'Storage adapter returned an invalid asset');
      try {
        const user = await repos.transaction(async r => {
          await r.lock(`user:${userId}`);
          const updated = await r.user.update(userId, { avatarUrl: asset.url });
          return updated;
        });
        return user;
      } catch (error) { await storage.deleteAvatar(asset).catch(() => {}); throw error; }
    },
    asset: async id => found(await repos.asset.get(id)),
  };
}
