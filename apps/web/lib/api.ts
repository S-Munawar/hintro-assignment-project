import axios from "axios";
import { supabase } from "./supabaseClient";
import type { ApiResponse } from "@/types";

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ─── Request Interceptor: Attach Supabase JWT ────────────────────────
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ─── Response Interceptor: Unwrap errors ─────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.data?.error?.message) {
      return Promise.reject(new Error(error.response.data.error.message));
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Convenience helpers ─────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await api.get<ApiResponse<T>>(url, { params });
  return res.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  const res = await api.post<ApiResponse<T>>(url, data);
  return res.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  const res = await api.put<ApiResponse<T>>(url, data);
  return res.data;
}

export async function apiDelete<T = void>(url: string): Promise<ApiResponse<T>> {
  const res = await api.delete<ApiResponse<T>>(url);
  return res.data;
}

// ─── Domain helpers ──────────────────────────────────────────────────

export interface UserSearchResult {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

/** Search users by email or name. */
export async function searchUsers(query: string, limit = 10): Promise<UserSearchResult[]> {
  const res = await apiGet<UserSearchResult[]>("/users/search", { q: query, limit });
  return res.data;
}
