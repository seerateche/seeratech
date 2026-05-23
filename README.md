# 🛡️ Seera Platform v4 — Enterprise Control

> **شريكك التكنولوجي المتكامل في الإسكندرية**  
> Your Total Tech Partner in Alexandria | Ваш технологический партнер в Александрии

![Seera Platform](https://img.shields.io/badge/Seera-Platform%20v4-6366f1?style=for-the-badge&logo=shield)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?style=flat-square&logo=nestjs)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env and set production values (especially ENCRYPTION_KEY and JWT secrets)
```

### 2. Generate Secure Keys
```bash
# AES-256 Encryption Key (32 bytes = 64 hex chars)
openssl rand -hex 32

# JWT Secrets
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Start with Docker (Recommended)
```bash
npm run docker:up
# Platform will be available at http://localhost:80
```

### 4. Start in Development
```bash
# Start PostgreSQL & Redis
docker compose -f infra/docker-compose.yml up postgres redis -d

# Install dependencies
npm install

# Run database migrations
npm run db:generate
npm run db:migrate

# Seed initial data
cd apps/api && npx ts-node seed.ts

# Start all services
npm run dev
```

---

## 🔑 Default Login Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Super Admin | `superadmin@seera.local` | `Change_Me_2025!` | God Mode access |
| Company Admin | `admin@demo-isp.local` | `Demo_Admin_2025!` | Slug: `demo-isp` |

> ⚠️ **CHANGE ALL PASSWORDS IN PRODUCTION!**

---

## 🏗️ Architecture

```
sira-platform/
├── apps/
│   ├── api/              # NestJS 10 Backend
│   │   ├── src/
│   │   │   ├── database/     # Drizzle ORM + PostgreSQL
│   │   │   ├── security/     # AES-256-GCM Service
│   │   │   └── modules/
│   │   │       ├── auth/         # JWT + RBAC
│   │   │       ├── companies/    # Multi-tenant
│   │   │       ├── devices/      # Device CRUD
│   │   │       ├── mikrotik/     # RouterOS API
│   │   │       ├── vouchers/     # Hotspot Engine
│   │   │       ├── zkteco/       # Biometric Attendance
│   │   │       ├── cctv/         # RTSP→HLS Proxy
│   │   │       └── terminal/     # WebSocket Gateway
│   │   └── Dockerfile
│   └── web/              # React 18 + Vite Frontend
│       ├── src/
│       │   ├── pages/        # Login, Dashboard, Devices...
│       │   ├── components/   # Shared UI components
│       │   ├── stores/       # Zustand state
│       │   └── utils/        # API client
│       └── Dockerfile
├── packages/
│   └── shared/           # Shared TypeScript types
└── infra/
    └── docker-compose.yml
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **Device Credentials** | AES-256-GCM encrypted at rest |
| **Authentication** | JWT (15min) + Refresh Token (7d) |
| **Authorization** | RBAC: SuperAdmin / CompanyAdmin / Viewer |
| **Rate Limiting** | 100 req/min global, 10 req/min on auth |
| **Account Lockout** | 5 failed attempts → 15min lock |
| **NAT Traversal** | WireGuard VPN tunnel |
| **Multi-tenancy** | Complete data isolation by companyId |

---

## 📡 Modules

### 🌐 MikroTik (Direct API — No RADIUS)
- Connect via `node-routeros` API
- Generate & push hotspot vouchers directly to `/ip hotspot user`
- Sync usage status back to PostgreSQL
- FTP upload of HTML hotspot templates
- CPE/AP remote control via MikroTik tunnel
- WebBox terminal for live CLI access

### 🎫 Voucher Engine
- Batch generation with custom prefix/profile
- Professional A4 PDF with QR codes + barcodes
- Real-time sync from RouterOS

### 👆 ZKTeco Biometric
- TCP/IP connection to ZK devices
- Real-time attendance via WebSocket events
- Daily attendance reports

### 📹 CCTV Streaming
- RTSP → HLS transcoding via FFmpeg
- Native browser playback (no plugins)
- Multi-camera grid view

### 👑 God Mode (Super Admin)
- Global dashboard of all companies
- WebBox terminal to any MikroTik

---

## 🌍 Supported Languages
- 🇸🇦 Arabic (RTL, default)
- 🇬🇧 English
- 🇷🇺 Russian

---

## 📞 Support
**Seera Platform** — الإسكندرية، مصر  
`fghdhttdsffgyhd-ops.github.io/seera-alex2026`  
دعم فني دائم | Constant Technical Support | Постоянная техническая поддержка
