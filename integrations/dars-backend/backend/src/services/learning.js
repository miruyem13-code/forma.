import { randomUUID } from 'node:crypto';
import { assert, found } from '../utils/errors.js';
import { pagination, paginated } from '../validators/index.js';

export function learningService(repos, videoAdapter) {
  async function enrolled(userId, courseId, r = repos) {
    assert(await r.enrollment.get(userId, courseId), 403, 'NOT_ENROLLED', 'Course enrollment is required');
  }
  async function course(userId, courseId) {
    await enrolled(userId, courseId);
    const detail = found(await repos.course.learning(courseId));
    const progress = await repos.progress.list(userId, courseId);
    const byLesson = new Map(progress.map(p => [p.lessonId, p]));
    let number = 0;
    const sections = detail.sections.map(section => ({ ...section, lessons: section.lessons.map(lesson => ({ ...lesson, number: ++number, progress: byLesson.get(lesson.id) ?? { completed: false, completedAt: null, lastPositionSeconds: 0 } })) }));
    const completed = progress.filter(p => p.completed).length;
    return { ...detail, sections, progress: { completedLessons: completed, totalLessons: number, percentage: number ? Math.floor(completed * 100 / number) : 0 } };
  }
  return {
    course,
    async enrollments(userId, query) {
      const { skip, take } = pagination(query);
      return paginated(await repos.enrollment.list(userId, skip, take), await repos.enrollment.count(userId), query);
    },
    async enrollment(userId, courseId) { await enrolled(userId, courseId); return { enrollment: await repos.enrollment.get(userId, courseId), course: await course(userId, courseId) }; },
    async lesson(userId, sessionId, courseId, lessonId) {
      await enrolled(userId, courseId);
      const lesson = found(await repos.lesson.get(lessonId));
      assert(lesson.section.courseId === courseId, 404, 'NOT_FOUND', 'Lesson not found in this course');
      const detail = await course(userId, courseId);
      const lessons = detail.sections.flatMap(s => s.lessons);
      const index = lessons.findIndex(l => l.id === lessonId);
      const playback = lesson.videoUrl ? await videoAdapter.createPlayback({ assetId: lesson.videoUrl, lessonId, userId, sessionId }) : null;
      return { ...lessons[index], playback, previousLessonId: lessons[index - 1]?.id ?? null, nextLessonId: lessons[index + 1]?.id ?? null };
    },
    async progress(userId, lessonId, input) {
      return repos.transaction(async r => {
        await r.lock(`progress:${userId}:${lessonId}`);
        const lesson = found(await r.lesson.get(lessonId));
        await enrolled(userId, lesson.section.courseId, r);
        if (input.lastPositionSeconds !== undefined) assert(input.lastPositionSeconds <= lesson.durationSeconds, 400, 'INVALID_POSITION', 'Playback position exceeds the lesson duration');
        const previous = await r.progress.get(userId, lessonId);
        const data = { ...input };
        if (input.completed !== undefined) data.completedAt = input.completed ? previous?.completedAt ?? new Date() : null;
        return r.progress.upsert(userId, lessonId, data);
      });
    },
    async certificate(userId, courseId) {
      return repos.transaction(async r => {
        await r.lock(`certificate:${userId}:${courseId}`);
        await enrolled(userId, courseId, r);
        const detail = found(await r.course.learning(courseId));
        const lessons = detail.sections.flatMap(s => s.lessons);
        const progress = await r.progress.list(userId, courseId);
        assert(lessons.length > 0 && lessons.every(l => progress.some(p => p.lessonId === l.id && p.completed)), 409, 'COURSE_INCOMPLETE', 'Complete all lessons before requesting a certificate');
        return r.certificate.create({ userId, courseId, certificateCode: randomUUID() });
      });
    },
  };
}
