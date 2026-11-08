import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  LockKeyhole,
  Play,
} from "lucide-react";
import { useState } from "react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/useApp";
import {
  Button,
  ErrorState,
  Progress,
  QueryState,
} from "../../components/common/UI";
import { downloadText, lessonsOf, progressOf } from "../../utils/format";
import { isMock } from "../../api/client";

export default function Player() {
  const { courseId, lessonId } = useParams();
  const { notify } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const courseQuery = useQuery({
    queryKey: ["learning-course", courseId],
    queryFn: () => api.learning.course(courseId),
    retry: false,
  });
  const lessonQuery = useQuery({
    queryKey: ["lesson", courseId, lessonId],
    queryFn: () => api.learning.lesson(courseId, lessonId),
    enabled: !!courseQuery.data,
    retry: false,
  });
  const course = courseQuery.data;
  const lesson = lessonQuery.data;
  const lessons = lessonsOf(course);
  const index = lessons.findIndex((item) => item.id === lessonId);
  const completed = course?.enrollment?.completedLessons || [];
  const isCompleted = completed.includes(lessonId);
  const mark = async () => {
    setSaving(true);
    try {
      await api.learning.progress(lessonId, !isCompleted);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["learning-course", courseId],
        }),
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
      ]);
      notify(
        isCompleted
          ? "Lesson marked as incomplete."
          : "A little progress. Nice work!",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const jump = (id) => {
    setVideoFailed(false);
    navigate(`/learn/${courseId}/${id}`);
  };
  return (
    <div className="player-page">
      <div className="container player-top">
        <Link to="/my-learning" className="text-link">
          <ArrowLeft size={16} />
          My learning
        </Link>
        <span>{course?.title || "Your classroom"}</span>
      </div>
      <div className="container">
        <QueryState query={courseQuery}>
          {course && (
            <div className="player-layout">
              <div>
                <QueryState query={lessonQuery}>
                  {lesson && (
                    <>
                      <div className="video-wrap">
                        {lesson.videoUrl && !videoFailed ? (
                          <video
                            key={lessonId}
                            controls
                            controlsList="nodownload"
                            preload="metadata"
                            onError={() => setVideoFailed(true)}
                            aria-label={lesson.title}
                          >
                            <source src={lesson.videoUrl} />
                            {(lesson.captionsUrl || isMock) && (
                              <track
                                kind="captions"
                                src={lesson.captionsUrl || "/demo-captions.vtt"}
                                srcLang="en"
                                label="English"
                                default={!!lesson.captionsUrl}
                              />
                            )}
                          </video>
                        ) : (
                          <ErrorState
                            error={{
                              message: videoFailed
                                ? "The video could not load. Check your connection or try again."
                                : "Your instructor has not uploaded this lesson’s video yet.",
                            }}
                            retry={
                              videoFailed
                                ? () => setVideoFailed(false)
                                : undefined
                            }
                          />
                        )}
                        {isMock && (
                          <span className="video-demo-label">
                            DEMO VIDEO · Sample footage, not course content
                          </span>
                        )}
                      </div>
                      <div className="lesson-heading">
                        <div>
                          <span className="eyebrow">
                            LESSON {index + 1} OF {lessons.length}
                          </span>
                          <h1>{lesson.title}</h1>
                        </div>
                        <Button
                          variant={isCompleted ? "outline" : "primary"}
                          onClick={mark}
                          loading={saving}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <Check size={17} />
                          )}
                          {isCompleted ? "Completed" : "Mark complete"}
                        </Button>
                      </div>
                      <div className="lesson-navigation">
                        <Button
                          variant="outline"
                          disabled={index <= 0}
                          onClick={() => jump(lessons[index - 1].id)}
                        >
                          <ArrowLeft size={16} />
                          Previous lesson
                        </Button>
                        {index < lessons.length - 1 ? (
                          <Button
                            variant="outline"
                            onClick={() => jump(lessons[index + 1].id)}
                          >
                            Next lesson <ArrowRight size={16} />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => navigate("/my-learning")}
                          >
                            Back to My Learning <ArrowRight size={16} />
                          </Button>
                        )}
                      </div>
                      <section className="detail-section">
                        <h2>About this lesson</h2>
                        <p>{lesson.description}</p>
                      </section>
                      <section className="detail-section">
                        <h2>Lesson resources</h2>
                        {lesson.resources?.length ? (
                          lesson.resources.map((resource) => (
                            <div
                              className="resource-row card"
                              key={resource.id}
                            >
                              <FileText size={22} />
                              <span>{resource.name}</span>
                              {resource.url ? (
                                <a
                                  className="text-link"
                                  href={resource.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download <Download size={16} />
                                </a>
                              ) : (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    downloadText(
                                      resource.name,
                                      resource.content,
                                    )
                                  }
                                >
                                  Download <Download size={16} />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="muted">
                            No additional resources for this lesson.
                          </p>
                        )}
                      </section>
                    </>
                  )}
                </QueryState>
              </div>
              <aside className="card player-sidebar">
                <div className="player-sidebar-heading">
                  <h2>Your learning roadmap</h2>
                  <div className="progress-label">
                    <span>
                      {completed.length} of {lessons.length} complete
                    </span>
                    <strong>{progressOf(course.enrollment, course)}%</strong>
                  </div>
                  <Progress value={progressOf(course.enrollment, course)} />
                </div>
                {course.sections.map((section, sectionIndex) => (
                  <details open key={section.id}>
                    <summary>
                      <span>
                        <small>SECTION {sectionIndex + 1}</small>
                        <strong>{section.title}</strong>
                      </span>
                      <ChevronDown size={17} />
                    </summary>
                    {section.lessons.map((item) => (
                      <button
                        key={item.id}
                        className={`player-lesson ${item.id === lessonId ? "active" : ""}`}
                        onClick={() => jump(item.id)}
                        disabled={item.locked}
                        aria-current={item.id === lessonId ? "step" : undefined}
                      >
                        {item.locked ? (
                          <LockKeyhole size={16} />
                        ) : completed.includes(item.id) ? (
                          <CheckCircle2 size={17} className="completed-icon" />
                        ) : (
                          <span className="lesson-number">
                            {lessons.findIndex(
                              (entry) => entry.id === item.id,
                            ) + 1}
                          </span>
                        )}
                        <span>
                          {item.title}
                          <small>{item.duration}</small>
                        </span>
                        {item.id === lessonId && (
                          <Play size={12} fill="currentColor" />
                        )}
                      </button>
                    ))}
                  </details>
                ))}
              </aside>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
