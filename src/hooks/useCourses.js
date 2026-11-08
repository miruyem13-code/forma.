import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
export const useCourses = () =>
  useQuery({ queryKey: ["courses"], queryFn: api.courses.list });
export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: api.categories });
export const useEnrollments = () =>
  useQuery({ queryKey: ["enrollments"], queryFn: api.learning.enrollments });
