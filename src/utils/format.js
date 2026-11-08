export const currency = import.meta.env.VITE_USE_MOCKS === 'true' ? 'USD' : 'UZS';
export const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
export const compact = (value) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
export const initials = (name = "Learner") =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
export const progressOf = (enrollment, course) =>
  course?.sections?.length
    ? Math.round(
        ((enrollment?.completedLessons?.length || 0) /
          course.sections.flatMap((section) => section.lessons).length) *
          100,
      )
    : 0;
export const lessonsOf = (course) =>
  course?.sections?.flatMap((section) => section.lessons) || [];
export function downloadText(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
