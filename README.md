# Digital PSSR Portal

Enterprise Digital Pre Startup Safety Review platform for refinery operations.

The portal follows the SRS workflow: admins manage users, refinery structure, annexure masters, department orchestration, and workflow permissions; PSSR initiators create new PSSR workflows; department members complete assigned annexures; area owners review, approve, reject, or send work back; punch points remain tracked until closure.

## Architecture

The application is split into a React frontend and FastAPI backend.

```text
Frontend/
  src/pages/admin/DepartmentsPage.tsx
  src/pages/admin/PSSRInitiatorManagementPage.tsx
  src/pages/admin/AnnexuresPage.tsx
  src/pages/team/DashboardPage.tsx
  src/pages/area-owner/DashboardPage.tsx
  src/services/api.ts
  src/hooks/

backend/app/
  models/
  routes/
  schemas/
  services/
  repositories/
  database/
  scripts/
```

Core principles:

- RBAC and capability checks are enforced by backend dependencies and services.
- PSSR initiator access is user-centric, not PSSR-record-centric.
- Department configuration is the operational orchestration layer.
- Annexure master templates are global, while department visibility and ownership are configurable.
- Annexure execution is PSSR-specific.
- Soft deletion and audit logs preserve compliance history.

## Department Architecture

The Department module is not simple CRUD. It is the system of record for refinery organization, operational visibility, workflow routing, annexure responsibility, checklist ownership, area-owner approval routing, and department-level RBAC.

### UI Structure

The Department page uses a centered enterprise workspace instead of an edge-to-edge admin table.

Responsive structure:

```text
Centered page shell, max width 1440px
  Header and primary actions
  KPI grid, max width 1120px
  Workspace grid
    Left department navigator, 320px-340px, internal vertical scroll
    Right department detail workspace, max width 960px
      Sticky wrapping tab navigation
      Section cards and compact configuration drawers
      Internal scrolling only for long personnel/configuration lists
```

Reusable frontend layout pieces in `Frontend/src/pages/admin/DepartmentsPage.tsx`:

- `DepartmentCard`: navigation card for the left department rail.
- `TeamMemberCard`: compact personnel row replacement that groups identity, workflow role, unit, workload, and a single action menu.
- `ConfigCard`: reusable workflow/annexure/unit/permission/area-owner configuration card.
- `InfoPanel`: bounded metadata and workload sections.
- `ActivityList`: audit and workflow activity feed.
- `DialogShell`: centered, constrained modal shell for department and mapping forms.

Responsive strategy:

- The page is capped at `1440px` and centered to avoid unreadable ultra-wide scanning.
- The detail workspace is capped at `960px`, keeping the operator's eye movement local to the active department.
- The left department list becomes normal stacked content below laptop/tablet breakpoints and sticky fixed-width navigation on wide screens.
- Team members are rendered as stacked operational cards, not wide tables.
- Advanced filters are collapsible so the toolbar remains compact during normal review.
- Tabs wrap into readable buttons instead of forcing horizontal scrolling.
- Annexure visibility is summarized by counts and configuration cards rather than dense chip walls.

Screenshot capture guidance:

- Desktop/laptop: capture the centered workspace with the department rail and detail panel visible.
- 1366px width: confirm the workspace remains centered and no horizontal page scroll appears.
- Tablet landscape: confirm department navigation stacks above or beside the detail panel without clipped actions.
- Team Members tab: confirm cards show left identity, center role/unit/initiator, right workload/actions.

The admin detail panel contains:

- Overview
- Team Members
- Annexures
- Operational Units
- Workflow Responsibilities
- Permissions & Visibility
- Area Owners
- Activity History

Department API responses include metadata, personnel counts, initiator counts, area-owner counts, workload metrics, mapped annexures, operational units, workflow responsibilities, permission policies, area-owner mappings, and activity history.

## Database Relationships

Department orchestration tables:

- `departments`: department master, code, name, active state, soft-delete metadata.
- `refinery_units`: operational units and zones visible during PSSR creation.
- `department_unit_mappings`: department-to-unit visibility, workflow scope, unit area owner, active state, soft delete.
- `department_annexure_mappings`: department-to-annexure many-to-many mapping, mandatory/optional flag, visibility scope, checklist owner role, workflow stage, priority, active state, soft delete.
- `department_workflow_responsibilities`: workflow stage responsibility matrix, owner role, escalation role, due-day ownership, punch-point owner, approval requirement, active state, soft delete.
- `department_permission_configs`: department-level RBAC capabilities by role and scope.
- `department_area_owner_mappings`: area-owner approval and escalation routing by department and optional operational unit.
- `department_activity_logs`: append-only audit feed for orchestration changes.

Related workflow tables:

- `users`: permanent identity, role, department, operational location, active and soft-delete metadata.
- `user_permissions`: auditable capability grants and revocations.
- `annexures`: global annexure master templates.
- `annexure_departments`: legacy/global annexure visibility seed source.
- `pssr_tasks`: assigned workflow/checklist records.
- `annexure_punch_points`: punch points with owning department.

## RBAC Model

Permanent roles:

- `ADMIN`
- `TEAM_MEMBER`
- `AREA_OWNER`

Capability codes include:

- `VIEW_PSSR`
- `EDIT_ASSIGNED_CHECKLIST`
- `CREATE_PUNCH_POINT`
- `UPLOAD_EVIDENCE`
- `CLOSE_CHECKLIST`
- `CREATE_PSSR`
- `INITIATE_PSSR`
- `APPROVE_PSSR`
- `MANAGE_DEPARTMENT_USERS`
- `MANAGE_ASSIGNED_DEPARTMENTS`
- `REVIEW_PSSR`

Department permission configuration stores which role can perform each capability within department scope. User-specific capability grants are stored separately in `user_permissions`.

## Initiator Capability Model

A PSSR Initiator is:

```text
TEAM_MEMBER + active INITIATE_PSSR permission
```

Initiator is not a PSSR assignment and is not a permanent role. Admins enable or revoke initiator access from the PSSR Initiator page or Department Team Members tab.

Once enabled, the user can create new PSSR workflows. The creation flow must use department configuration to determine available departments, operational units, visible annexures, default checklist ownership, candidate team members, and area-owner routing.

Current frontend implementation:

- The PSSR Initiator Dashboard opens a `Create New PSSR` form from the `Create New PSSR` button.
- The form captures plant/unit, date, time, equipment/system, and MOC or Non-MOC PSSR selection.
- MOC PSSR displays an MOC number and description field; Non-MOC PSSR hides that field.
- PSSR team leader and team member selection uses the seeded user directory and supports search by employee name, email, or employee ID.
- Selected leader and team member employee code, designation, and department are auto-filled from directory data.
- The optional questionnaire section allows annexure selection and maps the `Checked by` column from selected PSSR team members.
- The team member directory is exposed through a TEAM_MEMBER-accessible read-only route so PSSR initiators do not require admin access for assignment search.

## Annexure Mapping System

Annexures are globally managed in the Annexure module. Department-specific behavior is configured in `department_annexure_mappings`.

Each mapping supports:

- many-to-many department/annexure ownership
- mandatory or optional requirement
- department visibility scope
- checklist owner role
- workflow stage relevance
- priority/order
- active/inactive mapping state
- soft deletion

Mapped annexures drive checklist generation and visibility. Removing a mapping deactivates the relationship without deleting the global annexure master or historical workflow evidence.

## Workflow Routing System

Workflow responsibility rows define how a department participates in:

- PSSR creation support
- checklist execution
- evidence upload
- punch-point routing
- due-date ownership
- escalation
- pending area-owner approval
- completion authority

The current baseline stages are seeded per department and can be configured by admins. Future PSSR creation and workflow services should call the department payload or service methods as the source of truth before assigning checklists, approvals, or escalation owners.

## Operational Unit Relationships

Operational units are workflow-aware. Department mappings define:

- unit visibility
- workflow scope
- unit-level area owner
- active/inactive mapping state
- soft deletion metadata

Operational visibility affects PSSR creation and user filtering. Team members can be assigned to operational units through their user profile plant location, and unit mappings control which units a department participates in.

## Area Owner Architecture

Area owners review completed PSSR records, punch points, pending approvals, and approved/completed flows.

Department area-owner mappings define:

- department-wide or unit-specific approval scope
- primary area owner user
- escalation user
- active/inactive state
- soft deletion metadata

PSSR approval routing should resolve area owners from department and unit mappings before falling back to manually assigned task ownership.

## Audit Logging

Department activity logs track orchestration changes:

- user status and permission changes through personnel management
- annexure mapped or unmapped
- initiator access changed
- workflow responsibilities changed
- permission policy changed
- operational units updated
- area-owner routing changed

Logs are append-only and exposed in the Activity History tab.

## Soft Delete Behavior

The system avoids hard deletion for compliance-sensitive records.

Soft-deleted objects include:

- users
- departments
- department/unit mappings
- department/annexure mappings
- workflow responsibilities
- permission configs
- area-owner mappings
- annexure masters

Soft delete uses active flags plus `deleted_at` and `deleted_by_user_id` where applicable. Historical PSSR records, approvals, and audit evidence remain queryable.

## Global Impact

Department configuration is consumed across the portal:

- PSSR creation uses active departments, operational units, initiator capability, annexure visibility, checklist ownership, and area-owner routing.
- Checklist generation uses active department annexure mappings, priority, mandatory/optional flags, and workflow stage relevance.
- Assigned users come from department personnel and operational-unit alignment.
- Visibility rules use department permission configs and user capabilities.
- Workflow routing uses workflow responsibilities and area-owner mappings.
- Approval routing uses unit and department area-owner configuration.
- Dashboard statistics use PSSR tasks, pending approvals, punch points, and department workload.

## Admin APIs

Department routes:

- `GET /api/v1/admin/departments`
- `POST /api/v1/admin/departments`
- `PATCH /api/v1/admin/departments/{department_id}`
- `DELETE /api/v1/admin/departments/{department_id}`
- `GET /api/v1/admin/departments/{department_id}/users`
- `PATCH /api/v1/admin/departments/{department_id}/annexures`
- `DELETE /api/v1/admin/departments/{department_id}/annexures/{mapping_id}`
- `PATCH /api/v1/admin/departments/{department_id}/units`
- `PATCH /api/v1/admin/departments/{department_id}/workflow-responsibilities`
- `PATCH /api/v1/admin/departments/{department_id}/permissions`
- `PATCH /api/v1/admin/departments/{department_id}/area-owners`

User and initiator routes:

- `PATCH /api/v1/admin/users/{user_id}`
- `PATCH /api/v1/admin/users/{user_id}/status`
- `PATCH /api/v1/admin/users/{user_id}/permissions`
- `DELETE /api/v1/admin/users/{user_id}`
- `GET /api/v1/pssr/initiators`
- `GET /api/v1/pssr/initiators/statistics`
- `PATCH /api/v1/pssr/initiators/{user_id}/enable`
- `PATCH /api/v1/pssr/initiators/{user_id}/disable`
- `GET /api/v1/pssr/creation-context`

Team member routes:

- `GET /api/v1/team/users/directory`

## Development

Frontend:

```bash
cd Frontend
npm install
npm run dev
npm run lint
npm run build
```

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Seed data:

```bash
cd backend
python3 -m app.scripts.seed_users
python3 -m app.scripts.seed_annexures
```

## Database Bootstrap

The project currently uses SQLAlchemy `create_all` plus idempotent bootstrap helpers.

Startup performs:

- database connectivity check
- table creation for registered models
- index verification
- department and unit seed verification
- default workflow responsibility and permission matrix seeding

Production deployments should move schema changes into Alembic or the corporate migration pipeline.
