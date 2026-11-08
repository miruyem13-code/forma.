import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  ButtonLink,
  EmptyState,
  PageHeading,
} from "../../components/common/UI";
export function NotFound() {
  return (
    <div className="container section">
      <EmptyState
        title="A little off the beaten path."
        description="We couldn’t find this page. Your next possibility is still out there."
        action={
          <ButtonLink to="/">
            Back to home <ArrowRight size={17} />
          </ButtonLink>
        }
      />
    </div>
  );
}
export default function Info({ type }) {
  const privacy = type === "privacy";
  const help = type === "help";
  return (
    <div className="container section info-page">
      <PageHeading
        eyebrow="A LITTLE CLARITY"
        title={
          help
            ? "How can we help?"
            : privacy
              ? "Your privacy matters."
              : "Terms of this preview"
        }
        description={
          help
            ? "A few useful answers to keep you moving forward."
            : "Information about this frontend demonstration."
        }
      />
      {help ? (
        <div className="faq-list">
          {[
            [
              "How do I try the learning experience?",
              <>
                Go to <Link to="/login">Sign in</Link> and choose Student demo.
                Open My Learning to explore the sample courses and lesson
                player.
              </>,
            ],
            [
              "Can I purchase a course?",
              "Payments are unavailable in this frontend preview. The cart works, but no payment is collected and no paid enrollment is created.",
            ],
            [
              "Where is my progress saved?",
              "In demo mode, your profile, cart, courses, and learning progress are stored in this browser. Clearing browser storage resets them. In API mode, the backend stores your data.",
            ],
            [
              "How do I try the admin workspace?",
              <>
                Choose Admin demo on the <Link to="/login">sign-in page</Link>.
                You can create drafts, edit curricula, upload sample thumbnails,
                and publish or unpublish courses in the demo catalog.
              </>,
            ],
            [
              "Why can’t I change roles or moderate reviews?",
              "These actions require additional authorized backend endpoints. The current contract provides read-only access to users and reviews.",
            ],
            [
              "I can’t play a video.",
              "The demo player loads public sample footage from MDN. Check your internet connection. Real lessons must be served by the backend after verifying enrollment.",
            ],
          ].map(([title, text]) => (
            <details key={title}>
              <summary>{title}</summary>
              <p>{text}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className="card padded legal-copy">
          {privacy ? (
            <>
              <h2>Demo data stays in your browser</h2>
              <p>
                In demo mode, Forma uses local storage for sample profiles,
                carts, course edits, progress, and your theme preference. Demo
                passwords are never saved or verified. Please use fictional
                profile details.
              </p>
              <h2>External requests</h2>
              <p>
                The demo video player requests sample footage from MDN. When
                real API mode is enabled, requests go to the configured backend
                using session cookies.
              </p>
              <h2>Before a public launch</h2>
              <p>
                This explanatory notice is not a production privacy policy. The
                operator must provide its legal identity, retention rules,
                data-processing details, and privacy contact before collecting
                real personal information.
              </p>
            </>
          ) : (
            <>
              <h2>A preview for exploring</h2>
              <p>
                This application demonstrates the Forma learning marketplace.
                Sample courses, reviews, analytics, and users are illustrative.
                Demo access does not represent a purchase or grant access to
                real paid course content.
              </p>
              <h2>Payments and certificates</h2>
              <p>
                No payment is collected by this frontend. Real enrollments must
                be granted by a backend after payment verification. Certificates
                appear only when the backend provides an issued certificate.
              </p>
              <h2>Before a public launch</h2>
              <p>
                The platform operator must publish final terms covering its
                identity, course licensing, payment terms, refund policy, and
                support arrangements.
              </p>
            </>
          )}
        </div>
      )}
      <ButtonLink to="/courses" variant="outline">
        Keep exploring <ArrowRight size={16} />
      </ButtonLink>
    </div>
  );
}
