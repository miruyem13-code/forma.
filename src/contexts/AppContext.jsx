import { createContext, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { isMock } from "../api/client";

// Context is exported separately from hooks to keep consumer code simple.
// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext(null);
export function AppProvider({ children }) {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("forma-theme") || "light",
  );
  const notify = useCallback((message, kind = "success") => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-3), { id, message, kind }]);
    setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== id)),
      5000,
    );
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("forma-theme", theme);
  }, [theme]);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (error) {
        if (error.response?.status === 401) return null;
        throw error;
      }
    },
    retry: false,
  });
  const user = session.data;
  const cart = useQuery({
    queryKey: ["cart", user?.id || "guest"],
    queryFn: api.cart.get,
    enabled: isMock || !!user,
    retry: false,
  });
  useEffect(() => {
    const expire = () => {
      queryClient.clear();
      queryClient.setQueryData(["session"], null);
      notify("Your session expired. Please sign in again.", "error");
    };
    window.addEventListener("forma:session-expired", expire);
    return () => window.removeEventListener("forma:session-expired", expire);
  }, [queryClient, notify]);
  const authenticate = async (action, data) => {
    const next = await api.auth[action](data);
    queryClient.clear();
    queryClient.setQueryData(["session"], next.user || next);
    return next;
  };
  const logout = async () => {
    try {
      await api.auth.logout();
      queryClient.clear();
      queryClient.setQueryData(["session"], null);
      notify("You’ve been signed out.");
    } catch (error) {
      notify(error.message, "error");
    }
  };
  const add = useMutation({
    mutationFn: api.cart.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      notify("Added to your cart.");
    },
    onError: (error) => notify(error.message, "error"),
  });
  const remove = useMutation({
    mutationFn: api.cart.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      notify("Course removed from cart.");
    },
    onError: (error) => notify(error.message, "error"),
  });
  return (
    <AppContext.Provider
      value={{
        user,
        session,
        authenticate,
        logout,
        cart: Array.isArray(cart.data) ? cart.data : cart.data?.items || [],
        cartTotals: !isMock && cart.data ? cart.data : null,
        cartQuery: cart,
        addToCart: add.mutateAsync,
        adding: add.isPending,
        removeFromCart: remove.mutate,
        removing: remove.isPending,
        theme,
        setTheme,
        notify,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.kind}`}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <span>{toast.kind === "error" ? "!" : "✓"}</span>
            {toast.message}
            <button
              aria-label="Dismiss notification"
              onClick={() =>
                setToasts((items) =>
                  items.filter((item) => item.id !== toast.id),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
