# Digital PSSR Frontend

## Admin UI Primitives

Reusable enterprise admin primitives live in `src/components/admin/DepartmentPrimitives.tsx`.

- `MiniMetric` renders compact operational KPI cells for department cards, annexure library rows, and dashboard summary strips.
- `LabeledValue` renders consistent metadata pairs for department workflow, personnel, permissions, unit, and area-owner sections.
- `SummaryChips` renders wrapping chip groups for annexures, units, permissions, statuses, and compact responsibility summaries.

Use these primitives across admin modules when the UI needs small operational metrics, metadata display, or dense tag summaries. They use the shared card, border, rounded, and muted foreground tokens so Departments, Annexures, and future admin shells stay visually aligned.

## Department Setup Architecture

Department creation uses a two-part flow:

1. Create the department identity with code, name, and description.
2. Automatically open the Department Setup Wizard for guided configuration.

The wizard is step-based: Basic Metadata, Operational Units, Annexures, Personnel & Permissions, Workflow, and Review & Activate. Each step saves independently through the existing department configuration APIs, so newly created departments can immediately receive unit coverage, annexure ownership, area-owner routing, initiator permissions, and workflow responsibility rules.

## Strict SRS Alignment Decisions

The admin UI is constrained to the refinery workflow personas and responsibilities defined by the SRS. It is not a generic user-management console, database editor, or SaaS permission designer.

- Fixed workflow personas are Department Team Member, Area Owner, and Admin.
- PSSR Initiator is not a role. It is a capability granted to Department Team Members.
- Admins manage department assignment, operational unit mapping, workflow access, area-owner routing, initiator capability, status, and annexure responsibility.
- Admins do not manage HR identity, authentication metadata, employee IDs, employee names, or email addresses.

## Readonly Identity Architecture

Personnel identity is directory-sourced from Nayara/MOC/authentication systems. Department admin surfaces must show identity fields as read-only operational context:

- Employee ID
- Employee name
- Email
- Source refinery location

Editable personnel fields are limited to workflow access concerns: department assignment, operational unit assignment, workflow persona, initiator capability, area-owner designation, and active/inactive state.

## Mapping Workflow

Operational unit mapping uses searchable chip multi-selects backed by the live department/unit corpus. Admins add and remove unit coverage visually, then save the selected unit IDs as the department coverage boundary. Unit-level settings use controlled selectors for visibility, workflow scope, and area owner assignment.

Annexure assignment uses the annexure master library as the source of truth. Admins search and map annexures by code/title/department, with smart defaults applied on creation: mandatory requirement, department visibility, team-member checklist ownership, active workflow stage, and sequenced priority. Existing mappings are configured through controlled selectors rather than free-text enum fields.

## Annexure Mapping Architecture

Department annexure mapping is a two-panel responsibility console, not a dropdown selector.

- Left panel: Available Annexure Library.
- Right panel: Mapped Annexures For Department.
- Search filters visible library cards only.
- Selection is explicit through card selection state and the `Map Selected Annexures` action.
- Mapping is persisted only through `PATCH /api/v1/admin/departments/{department_id}/annexures`.
- Removal is persisted only through `DELETE /api/v1/admin/departments/{department_id}/annexures/{mapping_id}`.

The Available Annexure Library panel displays annexure code, title, applicable departments, default workflow stage, mandatory default, and department compatibility. It supports filtering by requirement, workflow stage, and department compatibility without using comboboxes, command menus, or inline dropdown expansion.

The Mapped Annexures panel displays each department responsibility as a card with requirement type, checklist owner, workflow stage, visibility scope, priority, active/inactive status, and actions for Configure, View Details, Disable, and Remove.

## Annexure Configuration Lifecycle

1. Admin selects one or more annexure cards from the library panel.
2. Admin clicks `Map Selected Annexures`.
3. The mapping modal opens with controlled configuration for workflow stage, checklist owner, visibility scope, mandatory/optional requirement, priority, and active state.
4. Saving calls the department annexure mapping API once per selected annexure.
5. The mapped responsibility appears in the department panel after query invalidation and backend refresh.

This keeps transient UI selection separate from backend-backed mappings. The frontend does not create fake mapped state.

## Department Responsibility Flow

Annexures are workflow responsibilities. A department mapping defines checklist routing, ownership, visibility, workflow stage relevance, and priority. The mapping must support PSSR creation, checklist generation, department team assignment, and area-owner review. Annexures should not be treated as simple tags or decorative labels.

## RBAC Interaction

Annexure mappings interact with department workflow access by defining which department owns which checklist responsibility and which persona owns checklist execution. Permission presets and initiator capability determine who can act, while annexure mapping determines what work appears in the workflow.

## Workflow Ownership Model

The owner role on an annexure mapping identifies the persona responsible for checklist execution. Workflow stage identifies where the annexure participates in the PSSR lifecycle. Visibility scope controls which operational context can see or use the responsibility. Priority controls checklist ordering.

## Role vs Capability

Department Team Member is the base execution persona for checklist ownership, evidence readiness, and punch-point work. PSSR initiation is granted separately as an initiator capability to selected team members. Area Owner remains an approval authority persona, and Admin remains a portal-management persona.

The UI presents business access presets such as checklist execution, punch-point control, PSSR initiation, and area approval. Internal permission codes remain implementation details and should not dominate the admin experience.

## Workflow Configuration Model

Workflow responsibilities are modeled by stage, checklist owner, escalation owner, due days, punch-point owner, approval requirement, and active state. Small fixed choices use simple dropdowns, segmented controls, or persona tiles. Search is reserved for real lookup datasets only: personnel, annexures, and operational units.

## Department Workflow Ownership Model

Departments own operational structure, annexure responsibility, checklist execution, area approval hierarchy, workflow routing, and visibility control. The UI should help admins assign responsibility and routing in refinery terms, not expose database rows or backend enum names as the primary interaction.

## Reusable Configuration Components

Reusable admin configuration controls live in `src/components/admin/ConfigurationControls.tsx`.

- `MappingSection` creates collapsible enterprise mapping panels with optional actions.
- `SearchableSelect` is reserved for personnel, annexure, and operational unit lookup.
- `FixedSelect` handles small fixed SRS option sets without search.
- `TileSelector` handles fixed persona and business preset choices.
- `ChipMultiSelect` supports searchable multi-select mapping with removable chips.
- `SegmentedControl` handles small enum choices such as visibility, requirement type, and approval flags.
- `Stepper` handles bounded numeric settings such as priority and due days.

Department-specific annexure mapping components live in `src/pages/admin/DepartmentsPage.tsx` beside the department workflow they serve:

- `AnnexuresTab` owns the two-panel library/mapped responsibility workflow.
- `AnnexureBulkMappingDialog` owns multi-annexure configuration before backend persistence.
- `AnnexureConfigDrawer` owns single-mapping reconfiguration.
- `AnnexureMappingDetailDialog` presents read-only mapping details for operational review.

## Simplified UX Principles

The admin experience favors guided refinery orchestration over generic CRUD: predictable fixed controls for small choices, lookup search only where the dataset is large, identity fields as read-only, and business wording over internal RBAC terminology.

Removed anti-patterns:

- Searchable role selectors for fixed SRS personas.
- Editable employee ID, employee name, and email fields in department admin.
- Search boxes inside every small dropdown.
- UI-first exposure of raw capability names, role codes, and scope codes.
- Generic database-style permission editing as the primary workflow.
