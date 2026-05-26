/**
 * DIGITAL PSSR - ENTERPRISE LAYOUT ARCHITECTURE GUIDE
 * 
 * This document explains the new reusable layout system and how to implement
 * it across other admin pages.
 */

// ============================================================================
// 1. SPLIT-PANEL LAYOUT PATTERN
// ============================================================================
// Use OperationalLayout when you need a list/detail view (Jira-style)

import { OperationalLayout, OperationalSidebar, OperationalDetail } from '@/components/layouts/OperationalLayout';
import { HorizontalTabs, TabPanel } from '@/components/layouts/HorizontalTabs';
import { OperationalGrid, MetricCard, InfoPanel, ConfigCard } from '@/components/layouts/GridSystem';

// EXAMPLE: Department list + detail view
<OperationalLayout
  sidebar={
    <OperationalSidebar
      header={
        <div className="space-y-3">
          <h2 className="text-headline-sm font-black">Departments</h2>
          <input placeholder="Search..." />
        </div>
      }
    >
      {departments.map(dept => (
        <DepartmentCard key={dept.id} {...dept} />
      ))}
    </OperationalSidebar>
  }
  detail={
    <OperationalDetail
      title={<h2>{selectedDept.name}</h2>}
      actions={<button>Edit</button>}
    >
      {/* Tab content goes here */}
    </OperationalDetail>
  }
/>

// Key Props:
// - sidebarWidthDesktop: Override default 35% width (e.g., 'w-[340px]')
// - gapSize: 'sm' | 'md' | 'lg' (default: 'md')
// - Responsive: Full-stack on mobile, split on lg breakpoint

// ============================================================================
// 2. HORIZONTAL TABS (No Wrapping)
// ============================================================================
// Use HorizontalTabs for operational workflows with many tabs

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team Members' },
  { id: 'config', label: 'Configuration' },
  // ... up to 8-10 tabs without wrapping
];

const [activeTab, setActiveTab] = useState('overview');

<div className="space-y-4">
  <HorizontalTabs
    tabs={TABS}
    activeTabId={activeTab}
    onTabChange={setActiveTab}
    variant="default" // or 'compact', 'pill'
  />
  
  <TabPanel isActive={activeTab === 'overview'}>
    <OverviewContent />
  </TabPanel>
  
  <TabPanel isActive={activeTab === 'team'}>
    <TeamContent />
  </TabPanel>
</div>

// Variants:
// - 'default': Border + bg, best for admin
// - 'compact': Minimal, for dense layouts
// - 'pill': Rounded, for dashboard style

// ============================================================================
// 3. RESPONSIVE GRIDS FOR METRICS
// ============================================================================
// Use OperationalGrid for KPI displays and summary cards

<OperationalGrid columns={4} gap="md">
  <MetricCard label="Active Users" value={1250} />
  <MetricCard label="Pending Tasks" value={45} variant="highlight" />
  <MetricCard label="Completion %" value={87} />
  <MetricCard label="Status" value="Healthy" />
</OperationalGrid>

// Grid Columns:
// - columns={2}: 2-col on mobile, 2-col on tablet, 2-col on desktop
// - columns={3}: 1-col on mobile, 2-col on tablet, 3-col on desktop  
// - columns={4}: 2-col on mobile, 2-col on tablet, 4-col on desktop

// MetricCard Variants:
// - 'default': Standard background
// - 'highlight': Primary accent background
// - 'muted': Subtle background

// ============================================================================
// 4. INFO PANELS & PROFILE GRIDS
// ============================================================================
// Use InfoPanel for grouped content, ProfileGrid for key-value pairs

<InfoPanel title="Department Metadata">
  <ProfileGrid
    columns={2}
    items={[
      ['Department Code', 'DEPT-001'],
      ['Status', 'Active'],
      ['Personnel', '124'],
      ['Units', '8'],
    ]}
  />
</InfoPanel>

// ProfileGrid Columns:
// - columns={1}: Single column
// - columns={2}: 2-column (default)

// ============================================================================
// 5. CONFIG CARDS (With Actions)
// ============================================================================
// Use ConfigCard for displaying configuration with edit/delete buttons

<ConfigCard
  title="Area Owner: John Smith"
  icon={UserCheck}
  items={[
    ['Operational Unit', 'Plant A'],
    ['Approval Scope', 'Global'],
    ['Status', 'Active'],
  ]}
  actions={
    <>
      <button>Edit</button>
      <button>Delete</button>
    </>
  }
/>

// ============================================================================
// 6. CSS VARIABLES & SPACING SCALE
// ============================================================================
// All layouts respect the unified spacing system in index.css

// Spacing tokens:
// --spacing-xs: 4px
// --spacing-sm: 8px
// --spacing-md: 12px
// --spacing-lg: 16px
// --spacing-xl: 24px
// --spacing-2xl: 32px
// --spacing-3xl: 48px

// Container max-widths:
// --container-operational: 1600px (use everywhere)
// --container-sm through --container-2xl for custom constraints

// Example: Use gap-3 (12px), gap-4 (16px) in new grids
<OperationalGrid columns={3} gap="lg"> {/* gap-4 = 16px */}
  {/* items */}
</OperationalGrid>

// ============================================================================
// 7. RESPONSIVE BREAKPOINTS
// ============================================================================

// Mobile-first Tailwind breakpoints used:
// sm: 640px   - small phones
// md: 768px   - tablets (primary breakpoint for split-panel)
// lg: 1024px  - small laptops (where split-panel fully activates)
// xl: 1280px  - standard desktops
// 2xl: 1536px - large monitors

// Example:
// grid-cols-1 md:grid-cols-2 lg:grid-cols-3
// 1 col on mobile → 2 cols on tablet → 3 cols on desktop

// ============================================================================
// 8. APPLY TO OTHER ADMIN PAGES
// ============================================================================

// Steps to refactor any admin page:

// 1. Remove max-w-[...] constraints from outer page div
//     <div className="mx-auto w-full max-w-360">
//     Keep it at component level - AdminLayout handles max-width

// 2. If page has a list + detail pattern, use OperationalLayout:
//     Sidebar: List/search/filters
//     Detail: Forms/tabs/content

// 3. If you have 5+ tabs, use HorizontalTabs:
//    Replaces flex-wrap wrapped buttons
//    Adds smart scroll indicators

// 4. Replace grid-cols-1 xl:grid-cols-2 with OperationalGrid:
//    grid-cols-1 xl:grid-cols-2 gap-3
//    <OperationalGrid columns={2} gap="md">

// 5. Use MetricCard for KPIs instead of custom Metric component:
//    <MetricCard label="Users" value={count} />

// 6. Use InfoPanel for grouped content:
//    <InfoPanel title="Metadata"><ProfileGrid.../></InfoPanel>

// ============================================================================
// 9. MIGRATION CHECKLIST
// ============================================================================

// Pages ready for conversion:
// [ ] UsersPage - has user list + detail
// [ ] RolesPermissionsPage - has roles + permissions tabs
// [ ] WorkflowConfigurationPage - has workflows + config
// [ ] PSSRRecordsPage - has PSSR list + details
// [ ] PSSRInitiatorManagementPage - has initiators + config
// [ ] AnnexuresPage - has annexure list + mappings
// [ ] ReportsPage - has reports + filters
// [ ] AuditLogsPage - has logs + filters

// DepartmentsPage is the proof-of-concept template - reference it!

// ============================================================================
// 10. IMPORTANT RULES
// ============================================================================

// DO:
// - Use OperationalLayout for list + detail views
// - Use HorizontalTabs when you have 5+ tabs
// - Use OperationalGrid for metric displays
// - Use gap-2, gap-3, gap-4 (not custom gaps)
// - Keep padding consistent: p-4 or p-5
// - Respect --container-operational at app level

// DON'T:
// - Add max-w-[...] constraints inside pages
// - Use flex-wrap for tabs (use HorizontalTabs)
// - Mix different grid systems (use OperationalGrid)
// - Create custom Metric/Card components (use GridSystem)
// - Override spacing scale (use defined tokens)
// - Create nested sidebars (use OperationalLayout)

// ============================================================================
// 11. DEBUGGING
// ============================================================================

// Issue: Tabs wrapping to two lines
// Solution: Use HorizontalTabs instead of flex-wrap buttons

// Issue: Sidebar looks compressed
// Solution: Adjust sidebarWidthDesktop prop or content inside

// Issue: Content scrolling in wrong place
// Solution: Ensure single scroll context (main overflow-y-auto only)

// Issue: Grid columns not responsive
// Solution: Verify using OperationalGrid columns prop

// Issue: Spacing looks inconsistent
// Solution: Use gap-2/3/4 and p-4/5, not px/py combinations
