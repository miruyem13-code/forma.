import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ArrowUpRight, BookOpen, Info, Shield } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { isMock } from "../../api/client";
import { Button, Field } from "../../components/common/UI";
import PasswordInput from "../../components/forms/PasswordInput";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
const registerSchema = loginSchema
  .extend({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    password: z
      .string()
      .min(isMock ? 8 : 12, isMock ? "Use at least 8 characters." : "Use at least 12 characters.")
      .max(128)
      .refine((value) => isMock || (/[a-z]/.test(value) && /[A-Z]/.test(value)), 'Include uppercase and lowercase letters.')
      .regex(/[A-Za-z]/, "Include a letter.")
      .regex(/[0-9]/, "Include a number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Your passwords don’t match.",
    path: ["confirmPassword"],
  });
export default function Auth({ register: isRegister = false }) {
  const { authenticate, notify } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [demoLoading, setDemoLoading] = useState("");
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
  });
  const requestedNext = params.get("next") || "/dashboard";
  const next =
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : "/dashboard";
  const submit = async (data) => {
    setError("");
    try {
      await authenticate(isRegister ? "register" : "login", data);
      notify(
        isRegister
          ? "Your profile is ready. Welcome to Forma."
          : "Welcome back.",
      );
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.fields)
        Object.entries(err.fields).forEach(([name, message]) =>
          setFieldError(name, {
            message: Array.isArray(message) ? message[0] : message,
          }),
        );
    }
  };
  const demo = async (role) => {
    setError("");
    setDemoLoading(role);
    try {
      await authenticate("demo", role);
      notify(`You’re exploring the ${role} demo.`);
      navigate(role === "admin" ? "/admin" : next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDemoLoading("");
    }
  };
  return (
    <div className="container auth-layout">
      <div className="auth-story">
        <div className="eyebrow">A NEW CHAPTER, A NEW YOU</div>
        <h1>
          A little curiosity.
          <br />
          <em>Endless possibility.</em>
        </h1>
        <p>
          Your next skill, your next idea, your next opportunity. It all starts
          here.
        </p>
        <div className="auth-illustration">
          <div className="auth-orbit" />
          <span>✳</span>
          <div className="auth-mini-card">
            <BookOpen size={24} />
            <strong>Keep becoming.</strong>
            <small>One lesson at a time.</small>
            <div className="progress">
              <span style={{ width: "64%" }} />
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>Learn on your terms.</span>
          <ArrowUpRight />
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">
            {isRegister ? "START SOMETHING GOOD" : "GOOD TO SEE YOU AGAIN"}
          </span>
          <h2>{isRegister ? "Make room for what’s next." : "Welcome back."}</h2>
          <p>
            {isRegister
              ? "Create your account and take your first step."
              : "Pick up where your curiosity left off."}
          </p>
          {isMock && (
            <div className="info-note">
              <Info size={18} />
              <span>
                Demo mode: profiles are stored in this browser. Passwords are
                not saved or verified. Use sample details only.
              </span>
            </div>
          )}
          <form onSubmit={handleSubmit(submit)} noValidate>
            {isRegister && (
              <Field label="Full name" error={errors.name}>
                <input
                  {...register("name")}
                  placeholder="Your full name"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                />
              </Field>
            )}
            <Field label="Email address" error={errors.email}>
              <input
                {...register("email")}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <PasswordInput
                registration={register("password")}
                placeholder={
                  isRegister ? (isMock ? "At least 8 characters" : "12+ characters, uppercase, lowercase and number") : "Enter your password"
                }
                autoComplete={isRegister ? "new-password" : "current-password"}
                aria-invalid={!!errors.password}
              />
            </Field>
            {isRegister && (
              <Field label="Confirm password" error={errors.confirmPassword}>
                <PasswordInput
                  registration={register("confirmPassword")}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                />
              </Field>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button
              className="full-width"
              type="submit"
              loading={isSubmitting}
              disabled={!!demoLoading}
            >
              {isRegister ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
            {isRegister && (
              <p className="form-legal">
                By creating an account, you agree to the{" "}
                <Link to="/terms">Terms</Link> and{" "}
                <Link to="/privacy">Privacy policy</Link>.
              </p>
            )}
          </form>
          <p className="auth-switch">
            {isRegister ? "Already part of Forma?" : "New around here?"}{" "}
            <Link
              to={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {isMock && (
            <div className="demo-accounts">
              <div className="divider-label">OR EXPLORE THE DEMO</div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => demo("student")}
                  loading={demoLoading === "student"}
                  disabled={isSubmitting || !!demoLoading}
                >
                  <BookOpen size={16} />
                  Student demo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => demo("admin")}
                  loading={demoLoading === "admin"}
                  disabled={isSubmitting || !!demoLoading}
                >
                  <Shield size={16} />
                  Admin demo
                </Button>
              </div>
              <small>Sample accounts and enrollments. No real purchases.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
