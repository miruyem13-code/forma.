import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Play,
  TrendingUp,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { useEnrollments } from "../../hooks/useCourses";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeading,
  Progress,
  QueryState,
} from "../../components/common/UI";
import CourseArt from "../../components/courses/CourseArt";
import { lessonsOf, progressOf } from "../../utils/format";
import { isMock } from "../../api/client";

function LearningCard({ enrollment }) {
  const course = enrollment.course;
  const progress = progressOf(enrollment, course);
  const next =
    lessonsOf(course).find(
      (lesson) => !enrollment.completedLessons.includes(lesson.id),
    ) || lessonsOf(course)[0];
  return (
    <article className="card learning-card">
      <CourseArt course={course} />
      <div>
        <div className="course-meta">
          <span>{course.category}</span>
          <Badge className={progress === 100 ? "green" : ""}>
            {progress === 100
              ? "Completed"
              : progress > 0
                ? "In progress"
                : "Ready to start"}
          </Badge>
        </div>
        <Link to={`/courses/${course.slug}`}>
          <h3>{course.title}</h3>
        </Link>
        <p>{course.instructor.name}</p>
        <div className="progress-label">
          <span>
            {enrollment.completedLessons.length} of {lessonsOf(course).length}{" "}
            lessons
          </span>
          <strong>{progress}%</strong>
        </div>
        <Progress value={progress} />
        {next ? (
          <ButtonLink
            className="full-width"
            variant="outline"
            to={`/learn/${course.id}/${next.id}`}
          >
            <Play size={15} />
            {progress === 100
              ? "Revisit course"
              : progress > 0
                ? "Continue learning"
                : "Start learning"}
            <ArrowRight size={16} />
          </ButtonLink>
        ) : (
          <p className="muted">Your instructor is preparing the lessons.</p>
        )}
      </div>
    </article>
  );
}
export function MyLearning() {
  const query = useEnrollments();
  const [filter, setFilter] = useState("All courses");
  const courses = (query.data || []).filter(
    (item) =>
      filter === "All courses" ||
      (filter === "Completed"
        ? progressOf(item, item.course) === 100
        : progressOf(item, item.course) > 0 &&
          progressOf(item, item.course) < 100),
  );
  return (
    <div className="container section">
      <PageHeading
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title="Your learning, your pace."
        description="A space for your next big idea. Pick up where you left off."
        action={
          <ButtonLink variant="outline" to="/courses">
            Explore more <ArrowRight size={16} />
          </ButtonLink>
        }
      />
      <div className="segmented-tabs learning-tabs">
        {["All courses", "In progress", "Completed"].map((tab) => (
          <button
            className={filter === tab ? "active" : ""}
            key={tab}
            onClick={() => setFilter(tab)}
            aria-pressed={filter === tab}
          >
            {tab}
          </button>
        ))}
      </div>
      <QueryState query={query}>
        {courses.length ? (
          <div className="learning-grid">
            {courses.map((enrollment) => (
              <LearningCard enrollment={enrollment} key={enrollment.courseId} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              filter === "Completed"
                ? "Great things take a few small steps."
                : "Make your first move."
            }
            description={
              filter === "All courses"
                ? "Your enrolled courses will appear here. Find a skill you’re curious about."
                : "No courses in this view yet. Keep learning and your progress will appear here."
            }
            action={
              <ButtonLink
                to={filter === "All courses" ? "/courses" : "/my-learning"}
                onClick={() => setFilter("All courses")}
              >
                {filter === "All courses"
                  ? "Explore courses"
                  : "View all my courses"}
              </ButtonLink>
            }
          />
        )}
      </QueryState>
    </div>
  );
}
export default function Dashboard() {
  const { user } = useApp();
  const query = useEnrollments();
  const enrolled = query.data || [];
  const completed = enrolled.reduce(
    (sum, item) => sum + item.completedLessons.length,
    0,
  );
  const finished = enrolled.filter(
    (item) => progressOf(item, item.course) === 100,
  ).length;
  const hours =
    enrolled.reduce(
      (sum, item) =>
        sum +
        lessonsOf(item.course)
          .filter((lesson) => item.completedLessons.includes(lesson.id))
          .reduce((minutes, lesson) => {
            const [m, s] = lesson.duration.split(":").map(Number);
            return minutes + m + s / 60;
          }, 0),
      0,
    ) / 60;
  return (
    <div className="container section">
      <PageHeading
        eyebrow="YOUR PERSONAL LEARNING SPACE"
        title={`Keep growing, ${user.name.split(" ")[0]}.`}
        description="A little progress today can open up a whole new tomorrow."
        action={
          <ButtonLink variant="outline" to="/courses">
            Find something new <ArrowRight size={16} />
          </ButtonLink>
        }
      />
      <QueryState query={query}>
        <div className="stats-grid">
          {[
            [BookOpen, "Enrolled courses", enrolled.length],
            [CheckCircle2, "Completed lessons", completed],
            [Clock3, "Lesson hours completed", hours.toFixed(1)],
            [Award, "Courses completed", finished],
          ].map(([Icon, label, value]) => (
            <div className="card stat-card" key={label}>
              <span className="stat-icon">
                <Icon size={21} />
              </span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            </div>
          ))}
        </div>
        <div className="dashboard-banner">
          <span className="dashboard-banner-icon">
            <TrendingUp size={28} />
          </span>
          <div>
            <h2>Small steps. Meaningful progress.</h2>
            <p>
              {completed
                ? `You’ve completed ${completed} lessons. Keep that curiosity going.`
                : "Choose a lesson and take your first step today."}
            </p>
          </div>
          <ButtonLink variant="outline" to="/my-learning">
            Your learning <ArrowRight size={16} />
          </ButtonLink>
        </div>
        <div className="section-heading">
          <h2>Pick up where you left off.</h2>
          <Link className="text-link" to="/my-learning">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {enrolled.length ? (
          <div className="learning-grid">
            {enrolled.slice(0, 3).map((item) => (
              <LearningCard enrollment={item} key={item.courseId} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your learning journey starts here."
            description="Enrolled courses will appear in your personal workspace."
            action={
              <ButtonLink to="/courses">Find your first course</ButtonLink>
            }
          />
        )}
        <section className="certificates-section">
          <div>
            <span className="eyebrow">MILESTONES WORTH CELEBRATING</span>
            <h2>Your achievements</h2>
            <p>Certificates appear when they are issued by your instructor.</p>
          </div>
          <div className="card certificate-card">
            <Award size={34} />
            <div>
              {enrolled.some((item) => item.certificate?.url) ? (
                enrolled
                  .filter((item) => item.certificate?.url)
                  .map((item) => (
                    <a
                      key={item.courseId}
                      className="text-link"
                      href={item.certificate.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.course.title} <ArrowRight size={16} />
                    </a>
                  ))
              ) : (
                <>
                  <h3>A little effort. Something to be proud of.</h3>
                  <p>
                    {isMock
                      ? "Demo progress does not issue real certificates."
                      : "You have no issued certificates yet."}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </QueryState>
    </div>
  );
}
