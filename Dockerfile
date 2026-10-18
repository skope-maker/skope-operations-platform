# One image, one service: build the React app, then serve it and the API from the FastAPI server.

# ---- 1. build the frontend ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines
COPY frontend/ ./
# Production build: no demo-login box (and no passwords) in the shipped code; call the API on the same address.
ENV VITE_SHOW_DEMO_LOGINS=false
ENV VITE_BACKEND_URL=
RUN yarn build

# ---- 2. run the backend, with the built frontend next to it ----
FROM python:3.14-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY backend/requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt
COPY backend/ ./backend/
COPY --from=web /web/build ./frontend/build
WORKDIR /app/backend
ENV STORAGE_BACKEND=local UPLOAD_DIR=/tmp/uploads
EXPOSE 8001
# Hosting platforms provide the port in $PORT.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
