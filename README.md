# Digital PSSR Portal

Enterprise-grade Digital Pre Startup Safety Review (PSSR) platform designed for refinery and industrial operations environments.

The platform digitizes and standardizes the complete PSSR lifecycle including personnel authorization, workflow approvals, safety verification, auditability, operational documentation, and department-level coordination.

Built with a scalable enterprise architecture using React, FastAPI, PostgreSQL, and RBAC-driven access control.

---

# Enterprise Objectives

The Digital PSSR Portal is being developed to solve operational and compliance challenges in industrial refinery environments by providing:

- Centralized PSSR workflow management
- Enterprise-grade role-based authorization
- Secure authentication and session handling
- Department-level operational visibility
- Audit logging and traceability
- Scalable process automation
- Cross-functional refinery coordination
- Future-ready DevSecOps deployment architecture

---

# Current Development Status

## Phase 1 Completed
### Enterprise Frontend + Backend Foundation

The project currently includes a fully integrated enterprise application foundation with:

- React frontend architecture
- FastAPI backend architecture
- PostgreSQL integration
- JWT authentication
- RBAC authorization system
- Enterprise dashboard routing
- Protected application routes
- Live backend API integration
- Paginated enterprise user directory
- Cached frontend data layer
- Virtualized rendering for large datasets
- Skeleton loaders and Suspense boundaries
- Centralized logging and middleware
- Scalable modular backend structure

---

# Enterprise Features Implemented

## Authentication & Security

- JWT Bearer authentication
- Role-based access control (RBAC)
- Protected frontend routing
- Session token persistence
- Centralized authentication middleware
- Backend authorization dependencies
- Enterprise login gateway UI
- Secure password hashing using bcrypt
- FastAPI dependency-based authorization
- Token-aware API service layer

---

## User & Access Management

- Enterprise personnel directory
- PostgreSQL-backed live user system
- Server-side pagination
- Department filtering
- Search functionality
- Role segregation:
  - ADMIN
  - AREA_OWNER
  - TEAM_MEMBER
- User virtualization using `react-window`
- Cached server state using `TanStack Query`
- Dynamic enterprise dashboards per role

---

## Frontend Architecture

- Modular scalable React architecture
- Shared component system
- Layout abstraction
- Protected route wrappers
- Role routers
- Enterprise navigation sidebar
- Responsive admin dashboard
- Reusable loading skeletons
- Lazy-loaded routes with Suspense
- Type-safe TypeScript architecture

---

## Backend Architecture

- FastAPI enterprise backend
- SQLAlchemy ORM integration
- PostgreSQL database integration
- Modular route architecture
- Centralized settings management
- Structured middleware system
- Request logging middleware
- Exception handling middleware
- Enterprise service layer architecture
- Health check endpoints
- Scalable API prefixing strategy

---

## Performance Optimizations

- Paginated backend queries
- Bounded SQL reads
- Query projection optimization
- Indexed user directory fields
- Debounced frontend searching
- React Query caching
- Virtualized rendering for large tables
- Skeleton UI loading states
- Optimized API response contracts

---

# Tech Stack

## Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- TanStack Query
- React Window
- Framer Motion
- Lucide React

---

## Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Passlib
- JWT Authentication
- Uvicorn

---

## Testing & QA

- Playwright
- Manual QA Documentation
- Smoke Testing
- Route Verification
- Backend Health Checks

---

# Project Structure

```bash
digital-pssr/
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   │
│   ├── tests/
│   └── playwright/
│
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── scripts/
│   │   ├── services/
│   │   └── main.py
│   │
│   └── requirements.txt
│
├── docs/
├── architecture/
└── README.md
=======
Enterprise Pre-Startup Safety Review (PSSR) portal for refinery operations.

## Current Scope

The application now includes a backend-integrated Admin Center with role-based navigation and an Annexure Master Template Management module.

The annexure module is for reusable master definitions only. It manages annexure metadata, section/question templates, revision history, department visibility, Word template upload/download, and soft archive/restore controls. Runtime checklist execution, pass/fail completion, evidence review queues, and live task progress belong to separate PSSR execution workflows.

## Annexure Management

The Admin Annexures page contains exactly three tabs:

* Placeholder 1
* Placeholder 2
* Manage Annexures

Manage Annexures provides:

* Searchable, paginated annexure master list
* Active, archived, revision, department, template, and recently modified filters
* Centralized split-pane layout for master list and selected annexure detail
* Master metadata and audit-oriented revision information
* Soft archive and restore controls
* Department visibility chips
* Controlled Word template upload and download
* Section builder with accordion-style section review
* Question builder with response type dropdowns, severity, ownership, guidance notes, remarks, attachment, and punch-point toggles
* 25 refinery-specific annexure definitions with unique section/question content

## Backend

Backend services are implemented with FastAPI and SQLAlchemy under `backend/app`.

Relevant annexure structure:

* `backend/app/models/annexures/`
* `backend/app/routes/annexures/`
* `backend/app/services/annexures/`
* `backend/app/repositories/annexures/`
* `backend/app/schemas/annexures/`
* `backend/app/scripts/seed_annexures.py`

Key annexure endpoints are mounted under `/api/v1/annexures`.

## Frontend

Frontend is built with React, TypeScript, Vite, Tailwind CSS v4, React Query, and Lucide React.

Relevant annexure files:

* `Frontend/src/pages/admin/AnnexuresPage.tsx`
* `Frontend/src/hooks/useAnnexures.ts`
* `Frontend/src/services/annexureService.ts`
* `Frontend/src/types/annexure.types.ts`

## Development

Install frontend dependencies:

```bash
cd Frontend
npm install
```

Run the frontend:

```bash
npm run dev
```

Verify frontend:

```bash
npm run lint
npm run build
```

Verify backend syntax:

```bash
python3 -m compileall backend/app
```

Run the annexure seed script from an environment with backend dependencies installed:

```bash
cd backend
python3 -m app.scripts.seed_annexures
```
>>>>>>> 3f26ceb (feat: implement enterprise annexure management architecture and workflow engine)
