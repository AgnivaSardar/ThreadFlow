# ThreadFlow — Production Deployment & Operations Guide (`deployment.md`)

This runbook provides complete, production-grade instructions for provisioning, containerizing, deploying, and maintaining the **ThreadFlow** platform for Company A's knitwear operations in Tiruppur.

---

## 1. System Requirements & Hardware Sizing

### Host Environment Sizing (Production Monolith)
* **Target Server:** 1x Linux Virtual Machine (Ubuntu 22.04 LTS / 24.04 LTS)
* **Compute:** 4 vCPUs (x86_64 or ARM64)
* **Memory:** 8 GB RAM (minimum 4 GB RAM)
* **Disk:** 80 GB NVMe SSD (ext4) with automated snapshot support
* **Network:** Static Public IPv4, Port 80 & 443 open, TLS 1.3 enabled
* **Recommended Cloud Options:** AWS Lightsail / EC2 (`t4g.xlarge`), Hetzner Cloud (`CPX31` @ €14/mo), or DigitalOcean Droplet ($24/mo).

### Client Floor Device Requirements
* **Supervisor Hardware:** Android 9.0+ smartphone with 2 GB RAM minimum (e.g. Redmi 9A, Samsung Galaxy M04).
* **Browser:** Chrome 108+ (supports PWA installation, Service Worker background sync, and Web Speech API `ta-IN`).

---

## 2. Production Environment Configuration (`.env.production`)

Store secrets strictly in the cloud provider's Secret Manager (or a secured `.env.production` file with `chmod 600` permissions on the host server). Never commit real secrets to source control.

```bash
# ==========================================
# THREADFLOW PRODUCTION ENVIRONMENT VARIABLES
# ==========================================

# Core Server Configuration
NODE_ENV=production
PORT=4000
APP_ORIGIN=https://threadflow.yourdomain.com
API_PREFIX=/api/v1

# Relational Database (PostgreSQL 16)
DATABASE_URL="postgresql://threadflow_admin:SECURE_PG_PASSWORD_HERE@postgres:5432/threadflow_prod?schema=public&sslmode=prefer"
POSTGRES_USER=threadflow_admin
POSTGRES_PASSWORD=SECURE_PG_PASSWORD_HERE
POSTGRES_DB=threadflow_prod

# Cryptographic Tokens & Authentication
JWT_ACCESS_SECRET="GENERATE_64_CHAR_HEX_RANDOM_ACCESS_SECRET"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_SECRET="GENERATE_64_CHAR_HEX_RANDOM_REFRESH_SECRET"
JWT_REFRESH_EXPIRY="7d"
COOKIE_DOMAIN=".yourdomain.com"
COOKIE_SECURE=true

# AI Provider Configuration (Tamil Voice/Text Semantic Classification)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_API_KEY="AIzaSy_YOUR_GEMINI_PRODUCTION_API_KEY"
AI_TIMEOUT_MS=3000
AI_CONFIDENCE_THRESHOLD=0.65

# Encrypted Private Object Storage (Floor Photos & Quality Proofs)
S3_ENDPOINT="https://s3.ap-south-1.amazonaws.com" # Or Cloudflare R2 endpoint
S3_REGION="ap-south-1" # Mumbai region for low latency in Tamil Nadu
S3_BUCKET="threadflow-production-evidence"
S3_ACCESS_KEY="AKIA_YOUR_PRODUCTION_ACCESS_KEY"
S3_SECRET_KEY="YOUR_PRODUCTION_SECRET_KEY"
S3_FORCE_PATH_STYLE=false

# Operational Feature Flags
ENABLE_TAMIL_VOICE_KEYPAD=true
ENABLE_WHAT_IF_SIMULATOR=true
SIMULATED_TODAY_DATE="2026-11-02" # Used for seed/demo calibration
```

---

## 3. Multi-Stage Docker Build Architecture

### Backend Production Dockerfile (`backend/Dockerfile`)
```dockerfile
# Stage 1: Dependency resolution and build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

# Security hardening: Run as non-root user
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
```

### Frontend Production Dockerfile (`frontend/Dockerfile`)
```dockerfile
# Stage 1: Build Vite React PWA
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: High-Performance Static Nginx Web Server
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

---

## 4. Production Orchestration (`docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: threadflow_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/prisma/backups:/backups
    networks:
      - threadflow_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: threadflow_api
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - threadflow_internal
      - threadflow_public
    expose:
      - "4000"

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: threadflow_web
    restart: unless-stopped
    depends_on:
      - api
    networks:
      - threadflow_public
    expose:
      - "80"

  reverse_proxy:
    image: nginx:alpine
    container_name: threadflow_proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_certs:/etc/letsencrypt
    depends_on:
      - web
      - api
    networks:
      - threadflow_public

volumes:
  pgdata:
  certbot_certs:

networks:
  threadflow_internal:
    internal: true
  threadflow_public:
```

---

## 5. Step-by-Step Deployment Runbook

### Step 1: Clone Repository and Configure Host
```bash
# 1. Update system packages and install Docker + Compose plugin
sudo apt update && sudo apt install -y curl git ufw docker.io docker-compose-v2
sudo systemctl enable --now docker

# 2. Configure UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (ACME challenge & redirects)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 3. Clone Repository
git clone https://github.com/your-org/threadflow.git /opt/threadflow
cd /opt/threadflow
```

### Step 2: Configure Environment and Secrets
```bash
# Copy and edit production environment file
cp .env.example .env.production
nano .env.production
chmod 600 .env.production
```

### Step 3: Zero-Downtime Database Migration & Seeding
```bash
# Start PostgreSQL database first
docker compose -f docker-compose.prod.yml up -d postgres

# Run Prisma production migrations (applies schema changes transactionally)
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# Seed baseline reference data, units, and calibrated orders
docker compose -f docker-compose.prod.yml run --rm api npx prisma db seed
```

### Step 4: Launch Full Application Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 5: Verify Deployment Health
```bash
# 1. Query the health endpoint
curl -f https://threadflow.yourdomain.com/api/v1/health

# Expected response:
# {"status":"UP","timestamp":"2026-11-02T08:15:00.000Z","database":"CONNECTED","version":"1.0.0"}

# 2. Inspect running container status
docker compose -f docker-compose.prod.yml ps
```

---

## 6. Reverse Proxy & Security Hardening (Nginx)

Place this configuration in `nginx/nginx.conf`:

```nginx
events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Rate Limiting: 120 requests/min per IP
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=120r/m;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https://threadflow-production-evidence.s3.ap-south-1.amazonaws.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://generativelanguage.googleapis.com;" always;

    # Gzip & Brotli Compression for Mobile Efficiency
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    server {
        listen 80;
        server_name threadflow.yourdomain.com;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name threadflow.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/threadflow.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/threadflow.yourdomain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Static React PWA Frontend
        location / {
            proxy_pass http://web:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Express REST API
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://api:4000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
```

---

## 7. Offline PWA Caching & Cache Invalidation Strategy

The frontend service worker (`public/sw.js`) manages offline capability on low-cost Android phones:

* **App Shell (Cache-First):** HTML, CSS, JavaScript chunks, Tamil UI icons, and Web Fonts are cached immediately during service worker installation (`threadflow-shell-v1`).
* **API Invalidation (Network-First, Fallback to IndexedDB):** Dynamic queries (`/api/v1/orders`, `/api/v1/supervisor/work`) always attempt the network first. If offline, the client reads the last synchronized snapshot from IndexedDB.
* **Service Worker Update Trigger:** When a new frontend release is deployed, Vite generates hashed chunk names (`index-C3e8a.js`). The service worker detects changes in `version.json`, installs the new cache in the background, and prompts the user with a discreet toast: *"Update Available — Tap to Refresh"*.

---

## 8. Automated Backup & Disaster Recovery Plan

### Automated Nightly PostgreSQL Backups
Add a cron job on the host server (`/etc/cron.d/threadflow-backup`):

```bash
# Run daily at 02:00 AM IST (Tiruppur off-shift)
0 2 * * * root docker exec threadflow_postgres pg_dump -U threadflow_admin threadflow_prod | gzip > /backups/threadflow_$(date +\%Y\%m\%d_\%H\%M).sql.gz

# Sync to secondary AWS S3 / Cloudflare R2 backup bucket
15 2 * * * root aws s3 sync /backups s3://threadflow-offsite-backups/database/ --delete
```

### Recovery Point Objective (RPO) & Recovery Time Objective (RTO)
* **RPO:** $< 24$ hours (full dump) + $< 15$ minutes (PostgreSQL Write-Ahead Logging replication).
* **RTO:** $< 30$ minutes to spin up an identical Docker stack on a new VPS using the latest verified `.sql.gz` dump.

---

## 9. Observability, Health Checks & Log Rotation

* **Liveness & Readiness Probes:**
  * Endpoint: `GET /api/v1/health`
  * Checks: Database connectivity, Prisma client pool status, disk storage space, and AI provider latency.
* **Structured JSON Logging:** Every HTTP request outputs structured JSON containing:
  * `timestamp`, `level`, `correlationId`, `method`, `url`, `statusCode`, `responseTimeMs`, `userId`, `userRole`.
* **Docker Log Rotation:** Enforced via `/etc/docker/daemon.json` to prevent disk saturation:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "20m",
      "max-file": "5"
    }
  }
  ```

---

## 10. 6-Week Rollout & Deployment Milestones

```mermaid
gantt
    title ThreadFlow 6-Week Factory Rollout Schedule
    dateFormat  YYYY-MM-DD
    section Phase 1: Core Setup
    Docker, Postgres & Prisma Setup        :done, p1_1, 2026-11-03, 5d
    Auth, RBAC & Order Management API      :done, p1_2, 2026-11-08, 5d
    section Phase 2: Floor PWA
    IndexedDB Queue & Canvas Compression   :active, p2_1, 2026-11-13, 6d
    Tamil Keypad & Voice UI Integration    :p2_2, 2026-11-19, 5d
    section Phase 3: Risk & Buyer
    Deterministic Run-Rate Risk Engine     :p3_1, 2026-11-24, 4d
    Buyer Portal & Scoped Magic Links      :p3_2, 2026-11-28, 4d
    section Phase 4: Factory Pilot
    Unit 1 Pilot (Tiruppur Floor Testing)  :p4_1, 2026-12-02, 5d
    Floor Training, Pen-Test & Go-Live     :p4_2, 2026-12-07, 5d
```

---
*ThreadFlow Production Deployment Runbook — Built for Zero Downtime and Maximum Reliability.*
