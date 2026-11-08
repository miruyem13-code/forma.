import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  ChartColumn,
  Code2,
  BriefcaseBusiness,
  Megaphone,
  Palette,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCategories, useCourses } from "../../hooks/useCourses";
import {
  Button,
  ButtonLink,
  EmptyState,
  PageHeading,
  QueryState,
} from "../../components/common/UI";
import CourseCard from "../../components/courses/CourseCard";

export function Categories() {
  const query = useCategories();
  const icons = {
    design: Palette,
    development: Code2,
    business: BriefcaseBusiness,
    data: ChartColumn,
    marketing: Megaphone,
    photography: Camera,
  };
  return (
    <div className="container section">
      <PageHeading
        eyebrow="SO MANY WAYS TO GROW"
        title="Follow your curiosity."
        description="Explore a new field, sharpen a skill, or find something you didn’t know you loved."
      />
      <QueryState query={query}>
        <div className="category-page-grid">
          {query.data?.map((category, index) => {
            const Icon = icons[category.id] || Palette;
            return (
              <article
                className={`card category-page-card category-${index % 4}`}
                key={category.id}
              >
                <div className="value-icon">
                  <Icon size={28} />
                </div>
                <h2>{category.name}</h2>
                <p>{category.description}</p>
                <div>
                  <span>{category.count} courses</span>
                  <ButtonLink
                    variant="outline"
                    to={`/courses?category=${category.id}`}
                  >
                    Explore <ArrowRight size={16} />
                  </ButtonLink>
                </div>
              </article>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
export default function Catalog() {
  const query = useCourses();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "all";
  const level = params.get("level") || "all";
  const sort = params.get("sort") || "featured";
  const set = (key, value) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      next.delete("page");
      return next;
    });
  let filtered = (query.data || []).filter(
    (course) =>
      (category === "all" || course.category === category) &&
      (level === "all" || course.level === level) &&
      `${course.title} ${course.description} ${course.instructor.name}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  filtered = [...filtered].sort((a, b) =>
    sort === "price-low"
      ? a.price - b.price
      : sort === "price-high"
        ? b.price - a.price
        : sort === "popular"
          ? b.students - a.students
          : sort === "rating"
            ? b.rating - a.rating
            : 0,
  );
  const page = Math.max(
    1,
    Math.min(
      Number(params.get("page")) || 1,
      Math.ceil(filtered.length / 8) || 1,
    ),
  );
  return (
    <div className="container section">
      <PageHeading
        eyebrow="A WORLD OF POSSIBILITIES"
        title="What will you learn next?"
        description="Find your next skill in our collection of practical, expert-led courses."
      />
      <div className="catalog-layout">
        <aside className="filter-panel card">
          <h3>
            <SlidersHorizontal size={18} />
            Refine your search
          </h3>
          <fieldset>
            <legend>Category</legend>
            {[
              { id: "all", name: "All categories" },
              ...(categories.data || []),
            ].map((item) => (
              <label className="radio-label" key={item.id}>
                <input
                  type="radio"
                  name="category"
                  checked={category === item.id}
                  onChange={() => set("category", item.id)}
                />
                {item.name}
                <span>{item.count}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Experience level</legend>
            {["all", "Beginner", "Intermediate", "All levels"].map((item) => (
              <label className="radio-label" key={item}>
                <input
                  type="radio"
                  name="level"
                  checked={level === item}
                  onChange={() => set("level", item)}
                />
                {item === "all" ? "Any experience" : item}
              </label>
            ))}
          </fieldset>
          <Button variant="ghost" onClick={() => setParams({})}>
            Reset all filters <X size={14} />
          </Button>
        </aside>
        <div>
          <div className="catalog-search-row">
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Search courses"
                value={q}
                onChange={(event) => set("q", event.target.value)}
                placeholder="Search courses, skills, or instructors"
              />
              {q && (
                <button onClick={() => set("q", "")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>
            <select
              aria-label="Sort courses"
              value={sort}
              onChange={(event) => set("sort", event.target.value)}
            >
              <option value="featured">Featured first</option>
              <option value="popular">Most popular</option>
              <option value="rating">Highest rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          <div className="results-count">
            {filtered.length} courses
            {q && (
              <>
                {" "}
                for <strong>“{q}”</strong>
              </>
            )}
          </div>
          <QueryState query={query}>
            {filtered.length ? (
              <div className="course-grid catalog-grid">
                {filtered.slice((page - 1) * 8, page * 8).map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="No courses found"
                description="Try another search or give your filters a little more room."
                action={
                  <Button onClick={() => setParams({})}>Clear filters</Button>
                }
              />
            )}
          </QueryState>
          {filtered.length > 8 && (
            <nav className="pagination" aria-label="Course pages">
              {Array.from(
                { length: Math.ceil(filtered.length / 8) },
                (_, index) => (
                  <button
                    key={index}
                    aria-current={page === index + 1 ? "page" : undefined}
                    className={page === index + 1 ? "active" : ""}
                    onClick={() =>
                      setParams((previous) => {
                        const next = new URLSearchParams(previous);
                        next.set("page", index + 1);
                        return next;
                      })
                    }
                  >
                    {index + 1}
                  </button>
                ),
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
