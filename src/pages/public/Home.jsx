import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  Code2,
  Compass,
  GraduationCap,
  Play,
  Search,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useCategories, useCourses } from "../../hooks/useCourses";
import {
  ButtonLink,
  QueryState,
  SectionHeading,
} from "../../components/common/UI";
import CourseCard from "../../components/courses/CourseCard";

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <div className="hero-plus">✳</div>
      <div className="hero-course-window">
        <div className="hero-window-top">
          <span className="window-dots">● ● ●</span>
          <span>A little progress, every day.</span>
          <span>↗</span>
        </div>
        <div className="hero-design">
          <div className="hero-design-type">
            Ideas into
            <br />
            <em>possibilities.</em>
          </div>
          <div className="hero-shapes">
            <div className="shape-circle" />
            <div className="shape-arch" />
            <div className="shape-step" />
          </div>
          <div className="design-footer">
            <span>DESIGN YOUR NEXT CHAPTER</span>
            <div className="hero-play">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="hero-course-info">
          <div className="hero-instructor">MC</div>
          <div>
            <strong>UI/UX Design Masterclass</strong>
            <span>with Mia Chen · 8 lessons</span>
          </div>
          <span className="hero-course-rating">
            <Star size={12} fill="currentColor" />
            4.9
          </span>
        </div>
        <div className="hero-lesson-progress">
          <span />
        </div>
      </div>
      <div className="floating-achievement">
        <div>
          <Award size={24} />
        </div>
        <span>
          <strong>Your next level awaits</strong>
          <small>Real skills. Real possibilities.</small>
        </span>
        <Sparkles size={18} />
      </div>
      <div className="floating-learners">
        <div className="avatar-stack">
          <span>JL</span>
          <span>AM</span>
          <span>SK</span>
          <span>+</span>
        </div>
        <div>
          <div className="five-stars">★★★★★</div>
          <span>Made for curious minds</span>
        </div>
      </div>
      <span className="hero-handnote">
        a small step. a big difference. <ArrowUpRight size={19} />
      </span>
    </div>
  );
}
export default function Home() {
  const query = useCourses();
  const categories = useCategories();
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState("Featured");
  const navigate = useNavigate();
  const search = (event) => {
    event.preventDefault();
    navigate(
      `/courses?q=${encodeURIComponent(new FormData(event.currentTarget).get("q"))}`,
    );
  };
  let visible = (query.data || []).filter(
    (course) => category === "all" || course.category === category,
  );
  if (tab === "Popular")
    visible = [...visible].sort((a, b) => b.students - a.students);
  if (tab === "On sale")
    visible = [...visible]
      .filter((course) => course.originalPrice > course.price)
      .sort(
        (a, b) =>
          (b.originalPrice - b.price) / b.originalPrice -
          (a.originalPrice - a.price) / a.originalPrice,
      );
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span />A LITTLE CURIOSITY GOES A LONG WAY
            </div>
            <h1>
              Make room for
              <br />
              what’s <span>next.</span>
              <svg viewBox="0 0 200 15" aria-hidden="true">
                <path d="M4 11 Q95 -3 195 8" />
              </svg>
            </h1>
            <p>
              Big ambitions start with small steps. Learn practical skills from
              people who love what they do—and find your next possibility.
            </p>
            <div className="hero-buttons">
              <ButtonLink to="/courses">
                Explore courses <ArrowUpRight size={18} />
              </ButtonLink>
              <ButtonLink to="/categories" variant="outline">
                <Compass size={18} />
                Find your path
              </ButtonLink>
            </div>
            <form className="hero-search" onSubmit={search}>
              <Search size={19} />
              <input
                name="q"
                aria-label="What do you want to learn?"
                placeholder="What do you want to learn?"
              />
              <button aria-label="Find courses">
                <ArrowRight size={21} />
              </button>
            </form>
            <div className="hero-reassurance">
              <span>
                <Check size={14} />
                Learn at your own pace
              </span>
              <span>
                <Check size={14} />
                Practical, hands-on projects
              </span>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>
      <section className="tools-strip">
        <div className="container">
          <p>
            Build skills for the tools
            <br />
            <strong>you’ll actually use.</strong>
          </p>
          <div className="tool-logo figma-logo">
            <span>◒</span>Figma
          </div>
          <div className="tool-logo">
            <Code2 />
            React
          </div>
          <div className="tool-logo notion-logo">
            <span>ℕ</span>Notion
          </div>
          <div className="tool-logo webflow-logo">webflow</div>
          <div className="tool-logo python-logo">
            <span>⌘</span>Python
          </div>
        </div>
      </section>
      <section className="section container" id="discover">
        <SectionHeading
          eyebrow="INVEST IN YOUR CURIOSITY"
          title="Your next chapter starts here."
          description="Expert-led courses. Real-world skills. A world of possibilities."
          to="/courses"
        />
        <div className="catalog-toolbar">
          <div className="segmented-tabs" aria-label="Course collection">
            {["Featured", "Popular", "On sale"].map((label) => (
              <button
                key={label}
                onClick={() => setTab(label)}
                className={tab === label ? "active" : ""}
                aria-pressed={tab === label}
              >
                {label === "On sale" && <Zap size={14} />}
                {label}
                {label === "On sale" && <span className="tiny-dot" />}
              </button>
            ))}
          </div>
          <span className="toolbar-note">
            Find a little inspiration. Learn something new.
          </span>
        </div>
        <div className="category-pills">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
          >
            All categories
          </button>
          {(categories.data || []).map((item) => (
            <button
              className={category === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <QueryState query={query}>
          <div className="course-grid">
            {visible.slice(0, 4).map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </div>
          {visible.length === 0 && (
            <p className="no-results">
              New courses are on their way. Explore another category.
            </p>
          )}
        </QueryState>
        <div className="browse-more">
          <span>There’s always something more to discover.</span>
          <Link to="/courses" className="text-link">
            Browse the full catalog <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="value-section">
        <div className="container value-grid">
          <div>
            <span className="eyebrow">BUILT AROUND YOU</span>
            <h2>
              Learn a skill.
              <br />
              Open a door.
            </h2>
            <p>
              Your goals aren’t one-size-fits-all.
              <br />
              Your learning shouldn’t be either.
            </p>
            <Link to="/courses" className="text-link">
              Find your next step <ArrowUpRight size={17} />
            </Link>
          </div>
          {[
            [
              BookOpen,
              "Real skills, real projects",
              "Go beyond watching. Put what you learn into practice with projects that make it stick.",
            ],
            [
              GraduationCap,
              "Learn from people who do",
              "Get practical insights from passionate professionals who know their craft inside out.",
            ],
            [
              Award,
              "Your pace. Your place.",
              "Make progress on your terms, with bite-sized lessons that fit into your everyday life.",
            ],
          ].map(([Icon, title, text]) => (
            <div className="value-card" key={title}>
              <div className="value-icon">
                <Icon size={25} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section container">
        <SectionHeading
          eyebrow="FOLLOW YOUR INTERESTS"
          title="A new direction is one click away."
          to="/categories"
          linkText="All categories"
        />
        <div className="category-cards">
          {(categories.data || []).slice(0, 4).map((item, index) => (
            <Link
              to={`/courses?category=${item.id}`}
              key={item.id}
              className={`category-tile category-${index}`}
            >
              <span className="category-tile-icon">
                {["✳", "</>", "↗", "▥"][index]}
              </span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.count} courses to explore</p>
              </div>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="cta-panel">
          <div className="cta-art" aria-hidden="true">
            ✳
          </div>
          <div>
            <span className="eyebrow">STAY CURIOUS. KEEP GROWING.</span>
            <h2>The best investment is in you.</h2>
            <p>Make a little space for the person you want to become.</p>
          </div>
          <ButtonLink to="/courses">
            Find your next course <ArrowUpRight size={18} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
