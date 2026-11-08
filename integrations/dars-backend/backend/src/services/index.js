import { authService } from './auth.js';
import { catalogService } from './catalog.js';
import { commerceService } from './commerce.js';
import { learningService } from './learning.js';
import { adminService } from './admin.js';
import { profileService } from './profile.js';
import { assert, found } from '../utils/errors.js';

export function createServices(repos, config, providers, logger) {
  return {
    auth: authService(repos, config), catalog: catalogService(repos), commerce: commerceService(repos, providers.payment),
    learning: learningService(repos, providers.video), admin: adminService(repos, config, logger), profile: profileService(repos, providers.storage, config),
    async health() { await repos.health(); return { status: 'ok', database: 'connected' }; },
    async media(userId, sessionId, lessonId, expires, signature) {
      assert(config.VIDEO_PROVIDER === 'signed-local' && providers.video.resolve, 404, 'NOT_FOUND', 'Media endpoint is unavailable');
      const lesson = found(await repos.lesson.get(lessonId));
      assert(await repos.enrollment.get(userId, lesson.section.courseId), 403, 'NOT_ENROLLED', 'Course enrollment is required');
      return providers.video.resolve({ assetId: lesson.videoUrl, lessonId, userId, sessionId }, expires, signature);
    },
  };
}
