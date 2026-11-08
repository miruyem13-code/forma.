import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Header";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Logo />
          <p>
            A little curiosity.
            <br />A world of possibilities.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/courses">All courses</Link>
          <Link to="/categories">Browse categories</Link>
          <Link to="/courses?sort=popular">Popular courses</Link>
        </div>
        <div>
          <h4>Your learning</h4>
          <Link to="/my-learning">My Learning</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Your account</Link>
        </div>
        <div className="footer-note">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h3>Keep your curiosity alive.</h3>
          <Link to="/courses" className="text-link">
            Find your next course <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Forma Learning. Made for your next
          chapter.
        </span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/help">Help center</Link>
        </div>
        <span className="footer-language">English · {import.meta.env.VITE_USE_MOCKS === 'true' ? 'USD' : 'UZS'}</span>
      </div>
    </footer>
  );
}
