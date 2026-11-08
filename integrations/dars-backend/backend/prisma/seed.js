import { readConfig } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { hashPassword, randomToken } from '../src/utils/crypto.js';
const config = readConfig();
if (config.NODE_ENV === 'production') throw new Error('Development seed is disabled in production');
const db = createDatabase(config.DATABASE_URL);
try {
  // No usable fixed password and no seeded administrator account.
  const instructor = await db.user.upsert({ where: { email: 'instructor@example.invalid' }, update: {}, create: {
    email: 'instructor@example.invalid', fullName: 'Dars Academy', bio: 'Practical software engineering courses.', passwordHash: await hashPassword(randomToken()),
  } });
  const category = await db.category.upsert({ where: { slug: 'software-development' }, update: {}, create: { name: 'Software Development', slug: 'software-development', description: 'Build reliable web applications with practical projects.' } });
  for (const entry of [
    { title: 'Modern JavaScript Foundations', slug: 'modern-javascript-foundations', price: '350000.00', discountPrice: '280000.00', description: 'Learn JavaScript fundamentals, asynchronous programming, and testing through practical exercises.' },
    { title: 'Building REST APIs with Node.js', slug: 'building-rest-apis-nodejs', price: '590000.00', discountPrice: null, description: 'Build modular APIs with Express, validation, authentication, and PostgreSQL transactions.' },
    { title: 'PostgreSQL for Application Developers', slug: 'postgresql-application-developers', price: '490000.00', discountPrice: '420000.00', description: 'Model relational data, write efficient queries, and maintain database integrity.' },
  ]) {
    const course = await db.course.upsert({ where: { slug: entry.slug }, update: {}, create: { ...entry, instructorId: instructor.id, categoryId: category.id, published: true } });
    for (const [index, title] of ['Getting Started', 'Practical Project'].entries()) {
      const section = await db.section.upsert({ where: { courseId_position: { courseId: course.id, position: index + 1 } }, update: {}, create: { courseId: course.id, position: index + 1, title } });
      for (const [lessonIndex, lessonTitle] of (index === 0 ? ['Introduction and learning goals', 'Core concepts'] : ['Build the project', 'Review and next steps']).entries()) {
        await db.lesson.upsert({ where: { sectionId_position: { sectionId: section.id, position: lessonIndex + 1 } }, update: {}, create: { sectionId: section.id, title: lessonTitle, description: 'Practice the concepts and complete the lesson exercises.', position: lessonIndex + 1, durationSeconds: 600, isPreview: index === 0 && lessonIndex === 0 } });
      }
    }
  }
  console.log('Development catalog seeded. No admin, purchases, enrollments, or video assets were created.');
} finally { await db.$disconnect(); }
