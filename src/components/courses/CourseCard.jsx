import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  ShoppingCart,
  Star,
  Users,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { isMock } from "../../api/client";
import { money, compact } from "../../utils/format";
import CourseArt from "./CourseArt";

export default function CourseCard({ course }) {
  const { cart, addToCart, adding, user } = useApp();
  const navigate = useNavigate();
  const inCart = cart.some((item) => item.id === course.id);
  const add = async () => {
    if (!isMock && !user) return navigate("/login?next=/courses");
    try {
      await addToCart(course.id);
    } catch {
      /* toast handles API errors */
    }
  };
  return (
    <article className="course-card card">
      <Link
        to={`/courses/${course.slug}`}
        className="course-cover"
        aria-label={`View ${course.title}`}
      >
        <CourseArt course={course} />
        {course.originalPrice > course.price && (
          <span className="cover-discount">
            {Math.round((1 - course.price / course.originalPrice) * 100)}% off
          </span>
        )}
        {course.badge && (
          <span
            className={`cover-badge ${course.badge === "New" ? "new" : ""}`}
          >
            {course.badge}
          </span>
        )}
        <span className="cover-arrow">
          <ArrowRight size={19} />
        </span>
      </Link>
      <div className="course-body">
        <div className="course-meta">
          <span>
            {course.category === "data" ? "Data & Analytics" : course.category}
          </span>
          <span>{course.level}</span>
        </div>
        <Link className="course-title" to={`/courses/${course.slug}`}>
          <h3>{course.title}</h3>
        </Link>
        <p className="instructor">{course.instructor.name}</p>
        <div className="rating">
          <Star size={14} fill="currentColor" />
          <strong>{course.rating || "New"}</strong>
          <span>({compact(course.students)} students)</span>
        </div>
        <div className="course-facts">
          <span>
            <Clock3 size={13} />
            {course.duration}
          </span>
          <span>
            <Users size={13} />
            {course.sections.flatMap((section) => section.lessons).length}{" "}
            lessons
          </span>
        </div>
        <div className="course-price">
          <div>
            <strong>{money(course.price)}</strong>
            <del>{money(course.originalPrice)}</del>
          </div>
          <button
            className={`cart-add ${inCart ? "added" : ""}`}
            aria-label={
              inCart
                ? `View cart with ${course.title}`
                : `Add ${course.title} to cart`
            }
            title={inCart ? "View cart" : "Add to cart"}
            disabled={adding}
            onClick={inCart ? () => navigate("/cart") : add}
          >
            {inCart ? <Check size={18} /> : <ShoppingCart size={18} />}
          </button>
        </div>
        <Link className="card-details" to={`/courses/${course.slug}`}>
          View course details <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}
