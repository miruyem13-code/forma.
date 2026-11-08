import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { api } from "../../services/api";
import { isMock } from '../../api/client';
import { useApp } from "../../hooks/useApp";
import { useCategories } from "../../hooks/useCourses";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  QueryState,
} from "../../components/common/UI";
import { lessonsOf, money, currency } from "../../utils/format";

export default function AdminCourses({ lessons = false }) {
  const query = useQuery({
    queryKey: ["admin-courses"],
    queryFn: api.admin.courses,
  });
  const queryClient = useQueryClient();
  const { notify } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const mutate = async (action, course) => {
    setBusy(true);
    try {
      if (action === "delete") await api.admin.deleteCourse(course.id);
      else
        await api.admin.updateCourse(course.id, {
          published: !course.published,
        });
      await queryClient.invalidateQueries();
      notify(
        action === "delete"
          ? "Course deleted."
          : course.published
            ? "Course unpublished."
            : "Course published.",
      );
      setDeleting(null);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const filtered = (query.data || []).filter(
    (course) =>
      course.title.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "published" ? course.published : !course.published)),
  );
  return (
    <>
      <PageHeading
        eyebrow="HELP SOMEONE TAKE THEIR NEXT STEP"
        title={lessons ? "Lessons & curriculum" : "Your course library"}
        description={
          lessons
            ? "Organize your curriculum and manage lessons in each course."
            : "Create, refine, and share learning that makes a difference."
        }
        action={
          <ButtonLink to="/admin/courses/new">
            <Plus size={17} />
            Create course
          </ButtonLink>
        }
      />
      <div className="card admin-table-card">
        <div className="admin-table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              placeholder="Search your courses"
              aria-label="Search courses"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Course status"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <QueryState query={query}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Category</th>
                  <th>{lessons ? "Curriculum" : "Price"}</th>
                  <th>Status</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link
                        className="table-strong"
                        to={`/admin/courses/${course.id}${lessons ? "#curriculum" : ""}`}
                      >
                        {course.title}
                      </Link>
                      <small className="table-subtext">
                        {course.instructor.name}
                      </small>
                    </td>
                    <td className="capitalize">{course.category}</td>
                    <td>
                      {lessons
                        ? `${course.sections.length} sections · ${lessonsOf(course).length} lessons`
                        : money(course.price)}
                    </td>
                    <td>
                      <Badge className={course.published ? "green" : "neutral"}>
                        {course.published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td>{course.students.toLocaleString()}</td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/admin/courses/${course.id}${lessons ? "#curriculum" : ""}`}
                          className="icon-button"
                          aria-label={`Edit ${course.title}`}
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          className="icon-button"
                          disabled={busy}
                          onClick={() => mutate("publish", course)}
                          aria-label={`${course.published ? "Unpublish" : "Publish"} ${course.title}`}
                        >
                          {course.published ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={busy}
                          onClick={() => setDeleting(course)}
                          aria-label={`Delete ${course.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <EmptyState
              title="No courses here yet."
              description="Create a new course, or adjust your search."
              action={
                <ButtonLink to="/admin/courses/new">Create a course</ButtonLink>
              }
            />
          )}
        </QueryState>
      </div>
      {deleting && (
        <Modal
          title="Delete this course?"
          onClose={() => !busy && setDeleting(null)}
        >
          <p>
            {isMock ? `“${deleting.title}” will be removed from the demo workspace. Enrolled courses must be unpublished instead.` : `“${deleting.title}” will be archived and unpublished. Existing purchases and learning progress will be preserved.`}
          </p>
          <div className="form-actions">
            <Button
              variant="danger"
              loading={busy}
              onClick={() => mutate("delete", deleting)}
            >
              Delete course
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep course
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
const schema = z
  .object({
    title: z.string().trim().min(5, "Use at least 5 characters.").max(150),
    slug: z
      .string()
      .min(3)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and hyphens.",
      ),
    description: z
      .string()
      .trim()
      .min(30, "Describe the course in at least 30 characters."),
    category: z.string().min(1, "Select a category."),
    level: z.string().min(1),
    price: z.coerce.number().min(0).max(999999999999),
    originalPrice: z.coerce.number().min(0).max(999999999999),
    instructorId: z.string().optional(),
    instructorName: z.string().trim().min(2),
    instructorRole: z.string().min(2),
    outcomes: z.string().min(10, "Add at least one learning outcome."),
    requirements: z.string().min(3, "Add at least one requirement."),
  })
  .refine((data) => data.originalPrice >= data.price, {
    message: "Original price must be at least the sale price.",
    path: ["originalPrice"],
  });
function Editor({ course }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const { notify, user } = useApp();
  const instructors = useQuery({ queryKey: ['admin-users'], queryFn: api.admin.users, enabled: !isMock });
  const [sections, setSections] = useState(course?.sections || []);
  const [thumbnail, setThumbnail] = useState(course?.thumbnail || "");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: course
      ? {
          ...course,
          instructorName: course.instructor.name,
          instructorRole: course.instructor.role,
          outcomes: course.outcomes.join("\n"),
          requirements: course.requirements.join("\n"),
        }
      : {
          category: isMock ? "design" : "",
          instructorId: user?.id,
          instructorName: isMock ? '' : user?.name,
          instructorRole: isMock ? '' : 'Instructor',
          level: "Beginner",
          price: isMock ? 29.99 : 280000,
          originalPrice: isMock ? 99.99 : 350000,
        },
  });
  const updateSection = (id, field, value) =>
    setSections((items) =>
      items.map((section) =>
        section.id === id ? { ...section, [field]: value } : section,
      ),
    );
  const updateLesson = (sectionId, lessonId, field, value) =>
    setSections((items) =>
      items.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lessons: section.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, [field]: value } : lesson,
              ),
            }
          : section,
      ),
    );
  const save = async (data) => {
    setError("");
    if (
      sections.some(
        (section) =>
          !section.title.trim() ||
          section.lessons.some(
            (lesson) =>
              !lesson.title.trim() ||
              !/^\d{1,3}:[0-5]\d$/.test(lesson.duration) ||
              (lesson.videoUrl && !(isMock ? /^https?:\/\// : /^[A-Za-z0-9_-]{1,200}$/).test(lesson.videoUrl)),
          ),
      )
    ) {
      setError(
        `Every section and lesson needs a title. Use mm:ss durations and ${isMock ? 'an HTTP(S) video URL' : 'a private video asset ID (letters, digits, underscores, hyphens)'}.`,
      );
      return;
    }
    const seconds = sections
      .flatMap((section) => section.lessons)
      .reduce((sum, lesson) => {
        const [minutes, sec] = lesson.duration.split(":").map(Number);
        return sum + minutes * 60 + sec;
      }, 0);
    const payload = {
      title: data.title,
      slug: data.slug,
      description: data.description,
      category: data.category,
      level: data.level,
      price: data.price,
      originalPrice: data.originalPrice,
      instructorId: data.instructorId,
      instructor: {
        name: data.instructorName,
        role: data.instructorRole,
        bio: course?.instructor.bio || "",
      },
      outcomes: data.outcomes
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      requirements: data.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      thumbnail,
      sections,
      duration: `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`,
    };
    try {
      if (course) await api.admin.updateCourse(course.id, payload);
      else await api.admin.createCourse(payload);
      await queryClient.invalidateQueries();
      notify(
        course
          ? "Your course has been updated."
          : "Your draft course is ready.",
      );
      navigate("/admin/courses");
    } catch (err) {
      setError(err.message);
    }
  };
  const upload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      notify("Choose a JPG, PNG, or WebP image under 2 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setThumbnail(reader.result);
    reader.onerror = () =>
      notify("Could not read this image. Try another file.", "error");
    reader.readAsDataURL(file);
  };
  const deleteItem = () => {
    if (deleteTarget.lessonId)
      setSections((items) =>
        items.map((section) =>
          section.id === deleteTarget.sectionId
            ? {
                ...section,
                lessons: section.lessons.filter(
                  (lesson) => lesson.id !== deleteTarget.lessonId,
                ),
              }
            : section,
        ),
      );
    else
      setSections((items) =>
        items.filter((section) => section.id !== deleteTarget.sectionId),
      );
    setDeleteTarget(null);
  };
  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <PageHeading
        eyebrow={course ? "MAKE IT EVEN BETTER" : "SHARE WHAT YOU KNOW"}
        title={course ? "Edit your course" : "Create something worth learning."}
        description="Build a clear path from curiosity to confidence."
        action={
          <Button type="submit" loading={isSubmitting}>
            <Save size={17} />
            Save {course ? "changes" : "draft"}
          </Button>
        }
      />
      <div className="editor-grid">
        <div>
          <section className="card editor-section">
            <h2>The essentials</h2>
            <Field label="Course title" error={errors.title}>
              <input
                {...register("title")}
                placeholder="e.g. An introduction to thoughtful design"
              />
            </Field>
            <Field label="URL slug" error={errors.slug}>
              <input
                {...register("slug")}
                placeholder="introduction-to-design"
              />
            </Field>
            <Field label="Description" error={errors.description}>
              <textarea
                {...register("description")}
                rows={4}
                placeholder="What will learners discover?"
              />
            </Field>
            <div className="form-grid">
              <Field label="Category" error={errors.category}>
                <select {...register("category")}>
                  {!isMock && <option value="">Select a category</option>}
                  {categories.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Experience level" error={errors.level}>
                <select {...register("level")}>
                  {["Beginner", "Intermediate", "All levels"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="What students will learn"
              error={errors.outcomes}
              hint="One outcome per line."
            >
              <textarea {...register("outcomes")} rows={4} />
            </Field>
            <Field
              label="Course requirements"
              error={errors.requirements}
              hint="One requirement per line."
            >
              <textarea {...register("requirements")} rows={3} />
            </Field>
          </section>
          <section className="card editor-section" id="curriculum">
            <div className="section-heading">
              <h2>Your curriculum</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSections((items) => [
                    ...items,
                    {
                      id: crypto.randomUUID(),
                      title: `Section ${items.length + 1}`,
                      lessons: [],
                    },
                  ])
                }
              >
                <Plus size={15} />
                Add section
              </Button>
            </div>
            {sections.length === 0 && (
              <div className="inline-empty">
                <BookOpen size={25} />
                <p>Add your first section to begin building the roadmap.</p>
              </div>
            )}
            {sections.map((section, sectionIndex) => (
              <div className="section-editor" key={section.id}>
                <div className="section-editor-title">
                  <GripVertical size={16} />
                  <label className="sr-only" htmlFor={section.id}>
                    Section {sectionIndex + 1} title
                  </label>
                  <input
                    id={section.id}
                    value={section.title}
                    onChange={(event) =>
                      updateSection(section.id, "title", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete section ${section.title}`}
                    onClick={() =>
                      setDeleteTarget({
                        sectionId: section.id,
                        title: section.title,
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {section.lessons.map((lesson, lessonIndex) => (
                  <div className="lesson-editor" key={lesson.id}>
                    <div className="lesson-editor-top">
                      <Video size={17} />
                      <strong>Lesson {lessonIndex + 1}</strong>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() =>
                          setDeleteTarget({
                            sectionId: section.id,
                            lessonId: lesson.id,
                            title: lesson.title,
                          })
                        }
                        aria-label={`Delete lesson ${lesson.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <Field label="Lesson title">
                      <input
                        value={lesson.title}
                        onChange={(event) =>
                          updateLesson(
                            section.id,
                            lesson.id,
                            "title",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Duration (mm:ss)">
                        <input
                          value={lesson.duration}
                          onChange={(event) =>
                            updateLesson(
                              section.id,
                              lesson.id,
                              "duration",
                              event.target.value,
                            )
                          }
                          placeholder="10:00"
                        />
                      </Field>
                            <Field label={isMock ? "Video URL" : "Private video asset ID"}>
                        <input
                                type={isMock ? "url" : "text"}
                          value={lesson.videoUrl || ""}
                          onChange={(event) =>
                            updateLesson(
                              section.id,
                              lesson.id,
                              "videoUrl",
                              event.target.value,
                            )
                          }
                                placeholder={isMock ? "https://..." : "course-intro-video"}
                        />
                      </Field>
                    </div>
                    <Field label="Lesson description">
                      <textarea
                        rows={2}
                        value={lesson.description || ""}
                        onChange={(event) =>
                          updateLesson(
                            section.id,
                            lesson.id,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    updateSection(section.id, "lessons", [
                      ...section.lessons,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        duration: "10:00",
                        videoUrl: "",
                        description: "",
                      },
                    ])
                  }
                >
                  <Plus size={15} />
                  Add lesson
                </Button>
              </div>
            ))}
          </section>
        </div>
        <aside>
          <section className="card editor-section">
            <h2>Course thumbnail</h2>
            {thumbnail ? (
              <img
                className="thumbnail-preview"
                src={thumbnail}
                alt="Course thumbnail preview"
              />
            ) : (
              <div className="thumbnail-placeholder">
                <Upload size={30} />
                <span>Make a great first impression</span>
              </div>
            )}
            {isMock ? <label className="btn btn-outline full-width upload-label">
              <Upload size={16} />
              Choose image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={upload}
              />
            </label> : <Field label="Thumbnail HTTPS URL" hint="The connected backend stores a hosted image URL. File uploads are available for profile avatars only."><input type="url" value={thumbnail} onChange={(event) => setThumbnail(event.target.value)} placeholder="https://..." /></Field>}
            {isMock && <small className="muted">JPG, PNG or WebP. Maximum 2 MB.</small>}
            {thumbnail && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setThumbnail("")}
              >
                Remove image
              </Button>
            )}
          </section>
          <section className="card editor-section">
            <h2>Pricing</h2>
            <Field label={`Original price (${currency})`} error={errors.originalPrice}>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("originalPrice")}
              />
            </Field>
            <Field label={`Sale price (${currency})`} error={errors.price}>
              <input type="number" step="0.01" min="0" {...register("price")} />
            </Field>
          </section>
          <section className="card editor-section">
            <h2>Instructor</h2>
            {isMock ? <Field label="Full name" error={errors.instructorName}>
              <input {...register("instructorName")} />
            </Field> : <Field label="Instructor account" error={errors.instructorId}><select {...register('instructorId')}>{instructors.data?.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.email})</option>)}</select></Field>}
            <Field label="Professional role" error={errors.instructorRole}>
              <input {...register("instructorRole")} />
            </Field>
          </section>
        </aside>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="editor-footer">
        <ButtonLink to="/admin/courses" variant="outline">
          <ArrowLeft size={16} />
          Cancel
        </ButtonLink>
        <Button type="submit" loading={isSubmitting}>
          Save {course ? "changes" : "draft"} <ArrowRight size={16} />
        </Button>
      </div>
      {deleteTarget && (
        <Modal
          title="Remove from curriculum?"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            Remove “{deleteTarget.title || "Untitled lesson"}”
            {!deleteTarget.lessonId && " and all of its lessons"}? This takes
            effect when you save the course.
          </p>
          <div className="form-actions">
            <Button type="button" variant="danger" onClick={deleteItem}>
              Remove
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Keep it
            </Button>
          </div>
        </Modal>
      )}
    </form>
  );
}
export function CourseEditor() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: isMock ? ["admin-courses"] : ["admin-course", id],
    queryFn: isMock ? api.admin.courses : () => api.admin.course(id),
    enabled: !!id,
  });
  if (!id) return <Editor />;
  const course = isMock ? query.data?.find((item) => item.id === id) : query.data;
  return (
    <QueryState query={query}>
      {course ? (
        <Editor key={course.id} course={course} />
      ) : (
        <EmptyState
          title="Course not found"
          description="It may have been removed from the library."
          action={<ButtonLink to="/admin/courses">Back to courses</ButtonLink>}
        />
      )}
    </QueryState>
  );
}
