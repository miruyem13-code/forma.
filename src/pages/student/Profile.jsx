import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  Pencil,
  User,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { useEnrollments } from "../../hooks/useCourses";
import { api } from "../../services/api";
import { isMock } from "../../api/client";
import { initials, progressOf } from "../../utils/format";
import {
  Button,
  ButtonLink,
  Field,
  PageHeading,
  QueryState,
} from "../../components/common/UI";
import PasswordInput from "../../components/forms/PasswordInput";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().email("Enter a valid email."),
  bio: z.string().max(500, "Keep your bio under 500 characters."),
});
const securitySchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
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
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });
function ProfileForm({ user, security }) {
  const queryClient = useQueryClient();
  const { notify } = useApp();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(security ? securitySchema : profileSchema),
    defaultValues: security
      ? {}
      : { name: user.name, email: user.email, bio: user.bio || "" },
  });
  const submit = async (data) => {
    setError("");
    try {
      if (security) {
        await api.profile.password({
          currentPassword: data.currentPassword,
          newPassword: data.password,
        });
        reset();
        queryClient.clear();
        queryClient.setQueryData(['session'], null);
        notify("Your password has been changed. Please sign in again.");
      } else {
        const updated = await api.profile.update(data);
        queryClient.setQueryData(["session"], updated);
        reset({
          name: updated.name,
          email: updated.email,
          bio: updated.bio || "",
        });
        notify("Your profile has been updated.");
      }
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form
      className="card profile-form"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <h2>{security ? "Password & security" : "A little about you"}</h2>
      <p className="muted">
        {security
          ? "Choose a strong password that you don’t use elsewhere."
          : "Keep your details up to date and make this space your own."}
      </p>
      {security ? (
        <>
          {isMock && (
            <div className="info-note">
              Demo profiles don’t store passwords. Password changes require the
              real backend.
            </div>
          )}
          <Field label="Current password" error={errors.currentPassword}>
            <PasswordInput
              registration={register("currentPassword")}
              autoComplete="current-password"
            />
          </Field>
          <Field
            label="New password"
            error={errors.password}
            hint={isMock ? "At least 8 characters, including a letter and number." : "At least 12 characters with uppercase, lowercase, and a number."}
          >
            <PasswordInput
              registration={register("password")}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword}>
            <PasswordInput
              registration={register("confirmPassword")}
              autoComplete="new-password"
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Full name" error={errors.name}>
            <input {...register("name")} autoComplete="name" />
          </Field>
          <Field label="Email address" error={errors.email}>
            <input {...register("email")} type="email" autoComplete="email" readOnly={!isMock} />
            {!isMock && <small>Email changes are not supported by the connected backend.</small>}
          </Field>
          <Field
            label="Bio"
            error={errors.bio}
            hint="A few words about what makes you curious."
          >
            <textarea {...register("bio")} rows={4} maxLength={500} />
          </Field>
        </>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isDirty || (security && isMock)}
        >
          {security ? "Update password" : "Save changes"}
        </Button>
        <ButtonLink to="/profile" variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
export default function Profile({ view = "overview" }) {
  const { user, logout } = useApp();
  const enrollments = useEnrollments();
  return (
    <div className="container section">
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your account"
        description="Your details, your progress, your next chapter."
      />
      <div className="profile-layout">
        <aside className="card profile-sidebar">
          <span className="avatar xlarge">{initials(user.name)}</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="badge">
            {user.role === "admin" ? "Administrator" : "Lifelong learner"}
          </span>
          <nav aria-label="Profile navigation">
            {[
              [User, "Overview", "/profile"],
              [Pencil, "Edit profile", "/profile/edit"],
              [LockKeyhole, "Security", "/profile/security"],
            ].map(([Icon, label, path]) => (
              <NavLink key={path} to={path} end>
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
            <button onClick={logout}>
              <LogOut size={17} />
              Sign out
            </button>
          </nav>
        </aside>
        {view === "overview" ? (
          <div>
            <section className="card padded">
              <div className="section-heading">
                <h2>Your profile</h2>
                <Link className="text-link" to="/profile/edit">
                  Edit <Pencil size={15} />
                </Link>
              </div>
              <dl className="profile-details">
                <div>
                  <dt>Full name</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>About you</dt>
                  <dd>{user.bio || "Add a bio to tell your story."}</dd>
                </div>
              </dl>
            </section>
            <section className="card padded profile-progress">
              <h2>Your learning at a glance</h2>
              <QueryState query={enrollments}>
                <div className="profile-stats">
                  <div>
                    <BookOpen size={21} />
                    <strong>{enrollments.data?.length || 0}</strong>
                    <span>Enrolled courses</span>
                  </div>
                  <div>
                    <CheckCircle2 size={21} />
                    <strong>
                      {enrollments.data?.filter(
                        (item) => progressOf(item, item.course) === 100,
                      ).length || 0}
                    </strong>
                    <span>Completed courses</span>
                  </div>
                </div>
                <ButtonLink to="/my-learning" variant="outline">
                  Go to My Learning <ArrowRight size={16} />
                </ButtonLink>
              </QueryState>
            </section>
          </div>
        ) : (
          <ProfileForm key={view} user={user} security={view === "security"} />
        )}
      </div>
    </div>
  );
}
