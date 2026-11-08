import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Info,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../hooks/useApp";
import { api } from "../../services/api";
import { isMock } from "../../api/client";
import {
  Button,
  ButtonLink,
  EmptyState,
  PageHeading,
  QueryState,
} from "../../components/common/UI";
import CourseArt from "../../components/courses/CourseArt";
import { money, currency } from "../../utils/format";

export default function Cart({ checkout = false }) {
  const { cart, cartQuery, cartTotals, removeFromCart, removing, user, notify } = useApp();
  const navigate = useNavigate();
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: api.orders.mine,
    enabled: checkout && !!user && !isMock,
  });
  const subtotal = cartTotals?.subtotal ?? cart.reduce((sum, item) => sum + item.originalPrice, 0);
  const total = cartTotals?.total ?? cart.reduce((sum, item) => sum + item.price, 0);
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link to="/courses">Courses</Link>
        <span>/</span>
        <Link to="/cart">Your cart</Link>
        {checkout && (
          <>
            <span>/</span>
            <span>Checkout</span>
          </>
        )}
      </div>
      <PageHeading
        eyebrow={checkout ? "ONE STEP CLOSER" : "YOUR NEXT CHAPTER"}
        title={checkout ? "Checkout" : "A little investment in you."}
        description={
          checkout
            ? "Review your courses and purchase information."
            : `${cart.length} ${cart.length === 1 ? "course" : "courses"} in your cart. A world of possibilities ahead.`
        }
      />
      {!isMock && !user ? (
        <EmptyState
          title="Sign in to view your cart"
          description="Your cart is saved to your account."
          action={<ButtonLink to="/login?next=/cart">Sign in</ButtonLink>}
        />
      ) : (
        <QueryState query={cartQuery}>
          {!cart.length ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your next possibility is waiting."
              description="Your cart is empty. Find a course that sparks your curiosity."
              action={
                <ButtonLink to="/courses">
                  Explore courses <ArrowRight size={17} />
                </ButtonLink>
              }
            />
          ) : (
            <div className="cart-layout">
              <div>
                {cart.map((course) => (
                  <article className="cart-course card" key={course.id}>
                    <Link to={`/courses/${course.slug}`}>
                      <CourseArt course={course} />
                    </Link>
                    <div>
                      <span className="eyebrow">{course.category}</span>
                      <Link to={`/courses/${course.slug}`}>
                        <h3>{course.title}</h3>
                      </Link>
                      <p>{course.instructor.name}</p>
                      <span className="muted">
                        {course.level} · {course.duration}
                      </span>
                    </div>
                    <div className="cart-course-price">
                      <strong>{money(course.price)}</strong>
                      <del>{money(course.originalPrice)}</del>
                      <button
                        className="text-button danger"
                        onClick={() => removeFromCart(course.id)}
                        disabled={removing}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
                {checkout && (
                  <div className="card checkout-message">
                    <div className="empty-icon">
                      <CreditCard size={26} />
                    </div>
                    <h2>Payment integration coming next.</h2>
                    <p>
                      {isMock
                        ? "You’re exploring a demo workspace. Checkout is unavailable, and no payment will be taken."
                        : "A payment provider has not been connected to this frontend. Checkout is currently unavailable."}
                    </p>
                    <div className="info-note">
                      <Info size={18} />
                      <span>
                        Courses are only unlocked after the backend confirms
                        payment. {isMock ? 'To explore the player now, use a clearly labeled demo account.' : 'Existing enrolled courses remain available in My Learning.'}
                      </span>
                    </div>
                    {isMock && (
                      <ButtonLink
                        variant="outline"
                        to="/login?next=/my-learning"
                      >
                        Explore demo learning <ArrowRight size={16} />
                      </ButtonLink>
                    )}
                  </div>
                )}
                {checkout && orders.data?.length > 0 && (
                  <div className="card padded">
                    <h3>Recent order status</h3>
                    {orders.data.map((order) => (
                      <p key={order.id}>
                        {order.id}: <strong>{order.status}</strong>
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <aside className="card order-summary">
                <h2>Order summary</h2>
                <div>
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="discount-row">
                  <span>Course discounts</span>
                  <span>−{money(subtotal - total)}</span>
                </div>
                <div className="order-total">
                  <strong>Total</strong>
                  <strong>{money(total)}</strong>
                </div>
                <small>
                  Prices in {currency}. Any applicable tax is calculated by the payment
                  provider.
                </small>
                {checkout ? (
                  <Button className="full-width" disabled>
                    <CreditCard size={17} />
                    Payments unavailable
                  </Button>
                ) : (
                  <Button
                    className="full-width"
                    onClick={() => {
                      if (!user) {
                        notify("Sign in to continue to checkout.", "info");
                        navigate("/login?next=/checkout");
                      } else navigate("/checkout");
                    }}
                  >
                    Continue to checkout <ArrowRight size={17} />
                  </Button>
                )}
                <Link
                  to={checkout ? "/cart" : "/courses"}
                  className="summary-back"
                >
                  {checkout ? "Back to cart" : "Keep exploring"}
                </Link>
              </aside>
            </div>
          )}
        </QueryState>
      )}
    </div>
  );
}
