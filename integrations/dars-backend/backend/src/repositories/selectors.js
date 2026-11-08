export const publicUser = { id: true, fullName: true, email: true, avatarUrl: true, bio: true, role: true, createdAt: true, updatedAt: true };
export const instructor = { id: true, fullName: true, avatarUrl: true, bio: true };
export const lessonMetadata = { id: true, sectionId: true, title: true, description: true, durationSeconds: true, position: true, isPreview: true };
export const curriculum = { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, select: lessonMetadata } } };
export const courseCard = {
  level: true, outcomes: true, requirements: true, instructorRole: true,
  sections: curriculum, reviews: { where: { hidden: false }, select: { rating: true } },
  id: true, title: true, slug: true, description: true, thumbnailUrl: true, price: true, discountPrice: true,
  published: true, createdAt: true, updatedAt: true, category: true, instructor: { select: instructor },
  _count: { select: { enrollments: true } },
};
export const orderInclude = { items: true, payments: { select: { id: true, provider: true, amount: true, currency: true, status: true, createdAt: true } } };
