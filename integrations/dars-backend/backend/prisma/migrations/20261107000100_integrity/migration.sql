-- Business invariants are enforced by PostgreSQL as well as request validation.
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK (email = lower(btrim(email)));
ALTER TABLE "Course" ADD CONSTRAINT "Course_price_valid" CHECK (price >= 0 AND ("discountPrice" IS NULL OR ("discountPrice" >= 0 AND "discountPrice" < price)));
ALTER TABLE "Section" ADD CONSTRAINT "Section_position_positive" CHECK (position > 0);
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_position_positive" CHECK (position > 0);
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_duration_nonnegative" CHECK ("durationSeconds" >= 0);
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_position_nonnegative" CHECK ("lastPositionSeconds" >= 0);
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_completion_valid" CHECK ((completed AND "completedAt" IS NOT NULL) OR (NOT completed AND "completedAt" IS NULL));
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_valid" CHECK (subtotal >= 0 AND "discountTotal" >= 0 AND total >= 0 AND subtotal - "discountTotal" = total AND currency = 'UZS');
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_valid" CHECK ("priceSnapshot" >= 0 AND "discountSnapshot" >= 0 AND "discountSnapshot" <= "priceSnapshot");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_valid" CHECK (amount >= 0 AND currency = 'UZS');
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_source_valid" CHECK (source IN ('PAYMENT', 'DEVELOPMENT'));
CREATE UNIQUE INDEX "Order_one_pending_per_user" ON "Order" ("userId") WHERE status = 'PENDING_PAYMENT';
