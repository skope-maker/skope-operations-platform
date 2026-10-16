import axios from 'axios';
import { toast } from 'sonner';

// Backend origin. VITE_BACKEND_URL is preferred; REACT_APP_BACKEND_URL is still
// honoured so existing .env files keep working. When neither is set the app
// calls same-origin `/api` (proxied to the backend by `vite dev`/`vite preview`).
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? import.meta.env.REACT_APP_BACKEND_URL ?? '';
const API = `${BACKEND_URL.replace(/\/+$/, '')}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kitchen_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('kitchen_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const d = e.response?.data?.detail;
  if (!d) return e.message || 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(' ');
  return String(d);
}

export const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0);
export const inr = (n) => `₹${fmt(Math.round((n ?? 0) * 100) / 100)}`;

export function toCSV(rows, filename) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function openDataUrl(dataUrl) {
  try {
    const [meta, b64] = dataUrl.split(',');
    const mime = (meta.match(/data:(.*?);/) || [])[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    toast.error('Unable to open attachment');
  }
}

// ---- Object storage helpers ----
export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await api.post('/files/upload', fd);
  return r.data; // { id, path, name, content_type, size }
}

export function fileUrl(path) {
  const token = localStorage.getItem('kitchen_token') || '';
  return `${API}/files/${path}?auth=${encodeURIComponent(token)}`;
}

export function isImagePath(nameOrPath) {
  return /\.(png|jpe?g|gif|webp)$/i.test(nameOrPath || '');
}

// Opens either a legacy base64 data URL or an object-storage path in a new tab.
export function openAttachment(attachment) {
  if (!attachment) return;
  if (attachment.startsWith('data:')) return openDataUrl(attachment);
  window.open(fileUrl(attachment), '_blank');
}
