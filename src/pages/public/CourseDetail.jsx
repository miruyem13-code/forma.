import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Globe,
  LockKeyhole,
  MonitorPlay,
  ShoppingCart,
  Star,
  Users,
} from "lucide-react";
import { api } from "../../services/api";
import { isMock } from "../../api/client";
import { useApp } from "../../hooks/useApp";
import {
  Badge,
  Button,
  ButtonLink,
  QueryState,
} from "../../components/common/UI";
import CourseArt from "../../components/courses/CourseArt";
import { compact, initials, lessonsOf, money } from "../../utils/format";

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, cart, addToCart, adding } = useApp();
  const query = useQuery({
    queryKey: ["course", slug],
    queryFn: () => api.courses.get(slug),
  });
  const enrollments = useQuery({
    queryKey: ["enrollments"],
    queryFn: api.learning.enrollments,
    enabled: !!user,
  });
  const course = query.data;
  const enrolled = enrollments.data?.some(
    (item) => item.courseId === course?.id,
  );
  const inCart = cart.some((item) => item.id === course?.id);
  const purchase = async (checkout = false) => {
    if (!isMock && !user)
      return navigate(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
    try {
      if (!inCart) await addToCart(course.id);
      if (checkout) navigate("/checkout");
    } catch {
      /* error is shown by cart context */
    }
  };
  return (
    <div className="container section">
      <QueryState query={query}>
        {course && (
          <>
            <div className="breadcrumbs">
              <Link to="/courses">Courses</Link>
              <span>/</span>
              <Link to={`/courses?category=${course.category}`}>
                {course.category}
              </Link>
              <span>/</span>
              <span>{course.title}</span>
            </div>
            <div className="detail-layout">
              <div>
                <div className="detail-intro">
                  <div className="inline-badges">
                    <Badge>{course.badge || "Course"}</Badge>
                    <span>{course.level}</span>
                  </div>
                  <h1>{course.title}</h1>
                  <p className="detail-description">{course.description}</p>
                  <div className="detail-rating">
                    <span className="rating">
                      <Star size={16} fill="currentColor" />
                      <strong>{course.rating || "New"}</strong>
                    </span>
                    <a href="#reviews">
                      {course.reviews.length} {isMock ? "sample " : ""}reviews
                    </a>
                    <span>
                      <Users size={15} />
                      {compact(course.students)} students
                    </span>
                  </div>
                  <div className="instructor-row">
                    <span className="avatar">
                      {initials(course.instructor.name)}
                    </span>
                    <span>
                      Created by <strong>{course.instructor.name}</strong>
                    </span>
                  </div>
                  <div className="detail-facts">
                    <span>
                      <Globe size={15} />
                      {course.language || "English"}
                    </span>
                    <span>
                      <Clock3 size={15} />
                      Updated {course.updatedAt}
                    </span>
                  </div>
                </div>
                <section className="card learn-outcomes">
                  <h2>Make your next move with confidence.</h2>
                  <p>By the end of this course, you’ll be able to:</p>
                  <div>
                    {course.outcomes.map((outcome) => (
                      <span key={outcome}>
                        <Check size={18} />
                        {outcome}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="detail-section">
                  <h2>Your learning roadmap</h2>
                  <p>
                    {course.sections.length} sections ·{" "}
                    {lessonsOf(course).length} lessons · {course.duration} total
                  </p>
                  <div className="curriculum">
                    {course.sections.map((section, index) => (
                      <details key={section.id} open={index === 0}>
                        <summary>
                          <ChevronDown size={17} />
                          <strong>{section.title}</strong>
                          <span>{section.lessons.length} lessons</span>
                        </summary>
                        {section.lessons.map((lesson) => (
                          <div className="curriculum-lesson" key={lesson.id}>
                            <MonitorPlay size={16} />
                            <span>{lesson.title}</span>
                            {enrolled ? (
                              <Link to={`/learn/${course.id}/${lesson.id}`}>
                                Open lesson
                              </Link>
                            ) : (
                              <LockKeyhole
                                size={14}
                                aria-label="Enrollment required"
                              />
                            )}
                            <small>{lesson.duration}</small>
                          </div>
                        ))}
                      </details>
                    ))}
                  </div>
                </section>
                <section className="detail-section">
                  <h2>Before you begin</h2>
                  <ul className="requirements">
                    {course.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section className="detail-section">
                  <h2>Learn from someone who loves their craft.</h2>
                  <div className="instructor-bio">
                    <span className="avatar large">
                      {initials(course.instructor.name)}
                    </span>
                    <div>
                      <h3>{course.instructor.name}</h3>
                      <span className="muted">{course.instructor.role}</span>
                      <p>{course.instructor.bio}</p>
                    </div>
                  </div>
                </section>
                <section className="detail-section" id="reviews">
                  <h2>What learners are saying</h2>
                  {!course.reviews.length && (
                    <p className="muted">
                      This course is new. Reviews will appear here as learners
                      share their experiences.
                    </p>
                  )}
                  {course.reviews.map((review) => (
                    <article className="review" key={review.id}>
                      <span className="avatar">{initials(review.name)}</span>
                      <div>
                        <div className="review-heading">
                          <strong>{review.name}</strong>
                          <small>{review.date}</small>
                        </div>
                        <span
                          className="five-stars"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          {"★".repeat(review.rating)}
                        </span>
                        <p>{review.text}</p>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
              <aside>
                <div className="card purchase-card">
                  <CourseArt course={course} />
                  <div className="purchase-body">
                    <div className="purchase-price">
                      <strong>{money(course.price)}</strong>
                      <del>{money(course.originalPrice)}</del>
                      <Badge>
                        {Math.round(
                          (1 -
                            course.price /
                              (course.originalPrice || course.price || 1)) *
                            100,
                        )}
                        % off
                      </Badge>
                    </div>
                    {enrolled ? (
                      <ButtonLink
                        className="full-width"
                        to={`/learn/${course.id}/${lessonsOf(course)[0]?.id || "start"}`}
                      >
                        Continue learning <ArrowRight size={17} />
                      </ButtonLink>
                    ) : (
                      <>
                        <Button
                          className="full-width"
                          loading={adding}
                          onClick={
                            inCart ? () => navigate("/cart") : () => purchase()
                          }
                        >
                          <ShoppingCart size={17} />
                          {inCart ? "View in cart" : "Add to cart"}
                        </Button>
                        <Button
                          className="full-width"
                          variant="outline"
                          onClick={() => purchase(true)}
                          loading={adding}
                        >
                          Buy now <ArrowRight size={17} />
                        </Button>
                      </>
                    )}
                    <small className="purchase-note">
                      {isMock
                        ? "Demo catalog · checkout is unavailable"
                        : "Payment status is verified by the backend"}
                    </small>
                    <h4>This course includes</h4>
                    <ul className="includes">
                      <li>
                        <MonitorPlay size={17} />
                        {course.duration} of video lessons
                      </li>
                      <li>
                        <BookOpen size={17} />
                        {lessonsOf(course).length} thoughtfully structured
                        lessons
                      </li>
                      <li>
                        <Check size={17} />
                        Hands-on projects & lesson resources
                      </li>
                      <li>
                        <Award size={17} />
                        Certificate when issued by your instructor
                      </li>
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
