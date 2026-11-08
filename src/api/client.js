import axios from "axios";

export const isMock = import.meta.env.VITE_USE_MOCKS === "true";
export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
  timeout: 15000,
});
let csrfToken;
let csrfRequest;
export function clearCsrf() { csrfToken = undefined; }
async function csrf() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) csrfRequest = client.get('/auth/csrf').then(({ data }) => {
    csrfToken = data.data.csrfToken;
    return csrfToken;
  }).finally(() => { csrfRequest = undefined; });
  return csrfRequest;
}
client.interceptors.request.use(async (config) => {
  if (!isMock && !['get', 'head', 'options'].includes(config.method || 'get')) {
    config.headers['X-CSRF-Token'] = await csrf();
  }
  return config;
});
client.interceptors.response.use(
  (response) => {
    if (response.data?.data?.csrfToken) csrfToken = response.data.data.csrfToken;
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const details = error.response?.data?.error;
    if (details?.code === 'CSRF_INVALID' && !error.config._csrfRetried) {
      clearCsrf();
      return client.request({ ...error.config, _csrfRetried: true });
    }
    error.message =
      details?.message ||
      error.response?.data?.message ||
      (status === 401
        ? "Your session has expired. Please sign in again."
        : status === 403
          ? "You do not have permission to access this resource."
          : !error.response
            ? "We couldn’t connect. Check your connection and try again."
            : "Something went wrong. Please try again.");
    error.fields = error.response?.data?.errors;
    error.code = details?.code || error.code;
    error.details = details?.details;
    if (Array.isArray(details?.details)) error.fields = Object.fromEntries(details.details.map((item) => [item.path === 'fullName' ? 'name' : item.path, item.message]));
    if (status === 401) clearCsrf();
    if (status === 401 && !error.config?.url?.startsWith("/auth/"))
      window.dispatchEvent(new Event("forma:session-expired"));
    return Promise.reject(error);
  },
);
