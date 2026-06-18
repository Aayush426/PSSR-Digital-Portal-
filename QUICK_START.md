# Quick Start Guide - Using New Layout Components

## 🚀 30-Second Rundown

You now have 3 powerful reusable layout components:

1. **`<OperationalLayout>`** - Split-panel list/detail view
2. **`<HorizontalTabs>`** - Tab navigation with smart scrolling  
3. **`<OperationalGrid>` + grid cards** - Responsive metric/card grids

All are production-ready and fully documented.

---

## 📋 Copy-Paste Templates

### Template 1: List + Detail Page (e.g., UsersPage, RolesPage)

```tsx
import { OperationalLayout, OperationalSidebar, OperationalDetail } from '@/components/layouts/OperationalLayout';
import { OperationalGrid, MetricCard } from '@/components/layouts/GridSystem';

export const YourPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: items } = useQuery(...);
  const selected = items?.find(i => i.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageTitle title="Your Title" breadcrumbs={[...]} />

      {/* Summary Metrics */}
      <OperationalGrid columns={4} gap="md">
        <MetricCard label="Total" value={items?.length} />
        <MetricCard label="Active" value={activeCount} />
        {/* ... */}
      </OperationalGrid>

      {/* Split-Panel List + Detail */}
      <OperationalLayout
        sidebar={
          <OperationalSidebar
            header={
              <div className="space-y-3">
                <h2 className="text-headline-sm font-black">Your Items</h2>
                <input placeholder="Search..." />
              </div>
            }
          >
            {items?.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </OperationalSidebar>
        }
        detail={
          selected ? (
            <OperationalDetail
              title={<h2>{selected.name}</h2>}
              actions={<button>Edit</button>}
            >
              {/* Your detail content */}
            </OperationalDetail>
          ) : (
            <EmptyState />
          )
        }
      />
    </div>
  );
};
```

---

### Template 2: Multi-Tab Interface

```tsx
import { HorizontalTabs, TabPanel } from '@/components/layouts/HorizontalTabs';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'config', label: 'Configuration' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'history', label: 'History' },
];

export const DetailPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');

  return (
    <OperationalDetail
      title={<h2>Item Name</h2>}
      actions={<button>Actions</button>}
    >
      <div className="space-y-4">
        {/* Smart horizontal tabs - no wrapping */}
        <HorizontalTabs
          tabs={TABS}
          activeTabId={activeTab}
          onTabChange={setActiveTab}
          variant="default"
        />

        {/* Tab content */}
        <div className="space-y-6">
          <TabPanel isActive={activeTab === 'overview'}>
            {/* Overview content */}
          </TabPanel>

          <TabPanel isActive={activeTab === 'config'}>
            {/* Config content */}
          </TabPanel>

          <TabPanel isActive={activeTab === 'permissions'}>
            {/* Permissions content */}
          </TabPanel>

          <TabPanel isActive={activeTab === 'history'}>
            {/* History content */}
          </TabPanel>
        </div>
      </div>
    </OperationalDetail>
  );
};
```

---

### Template 3: Metrics Dashboard

```tsx
import { OperationalGrid, MetricCard, InfoPanel } from '@/components/layouts/GridSystem';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 4-column metric grid (responsive) */}
      <OperationalGrid columns={4} gap="md">
        <MetricCard label="Users" value={1250} />
        <MetricCard label="Tasks" value={45} variant="highlight" />
        <MetricCard label="Completed" value={38} variant="muted" />
        <MetricCard label="Completion" value="84%" detail="Rate" />
      </OperationalGrid>

      {/* 2-column info panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoPanel title="Recent Activity">
          {/* Activity list */}
        </InfoPanel>
        <InfoPanel title="Status">
          {/* Status content */}
        </InfoPanel>
      </div>
    </div>
  );
};
```

---

## 🎯 Migration Checklist for Each Page

- [ ] Remove `max-w-[...]` from outer page div
- [ ] Replace manual sidebar/detail with `<OperationalLayout>`
- [ ] If 5+ tabs, replace with `<HorizontalTabs>` + `<TabPanel>`
- [ ] Replace metric components with `<OperationalGrid>` + `<MetricCard>`
- [ ] Replace InfoPanel/ProfileGrid with GridSystem components
- [ ] Use `gap-2`/`gap-3`/`gap-4` (not custom gaps)
- [ ] Use `p-4`/`p-5` consistently (not `px-4 py-6` etc)
- [ ] Test responsive at sm/md/lg/xl
- [ ] Build and verify: `npm run build`

---

## 📍 Component Locations

```
Frontend/src/components/layouts/OperationalLayout.tsx
  ├── OperationalLayout
  ├── OperationalSidebar
  └── OperationalDetail

Frontend/src/components/layouts/HorizontalTabs.tsx
  ├── HorizontalTabs
  └── TabPanel

Frontend/src/components/layouts/GridSystem.tsx
  ├── OperationalGrid
  ├── MetricCard
  ├── InfoPanel
  ├── ProfileGrid
  └── ConfigCard
```

---

## 🎨 Component Variants

### MetricCard
```tsx
<MetricCard label="Users" value={1250} /> {/* default */}
<MetricCard label="Tasks" value={45} variant="highlight" /> {/* accent bg */}
<MetricCard label="Info" value="Status" variant="muted" /> {/* subtle */}
```

### OperationalGrid
```tsx
<OperationalGrid columns={2} gap="sm"> {/* 2-col, 8px gap */}
<OperationalGrid columns={3} gap="md"> {/* 3-col, 12px gap */}
<OperationalGrid columns={4} gap="lg"> {/* 4-col, 16px gap */}
```

### HorizontalTabs
```tsx
<HorizontalTabs tabs={TABS} variant="default" /> {/* bordered */}
<HorizontalTabs tabs={TABS} variant="compact" /> {/* minimal */}
<HorizontalTabs tabs={TABS} variant="pill" /> {/* rounded */}
```

### InfoPanel
```tsx
<InfoPanel title="Metadata"> {/* default */}
<InfoPanel title="Info" variant="bordered"> {/* left border */}
<InfoPanel title="Details" variant="subtle"> {/* no border */}
```

---

## 🔧 Customization

### Change sidebar width
```tsx
<OperationalLayout
  sidebar={...}
  detail={...}
  sidebarWidthDesktop="w-[400px]" {/* instead of 35% */}
/>
```

### Change gap size
```tsx
<OperationalLayout
  sidebar={...}
  detail={...}
  gapSize="lg" {/* sm, md, lg */}
/>
```

### Custom max-height for sidebar
```tsx
<OperationalSidebar
  header={...}
  maxHeight="max-h-[calc(100vh-200px)]" {/* custom */}
>
  {/* content */}
</OperationalSidebar>
```

---

## ✅ Verification Checklist

After refactoring a page:

- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Page looks good at 100% zoom
- [ ] Responsive at sm/md/lg/xl breakpoints
- [ ] No horizontal scrolling
- [ ] Tabs don't wrap (if using HorizontalTabs)
- [ ] Spacing looks consistent
- [ ] Layout looks professional (compare to DepartmentsPage)

---

## 📚 Reference Pages

| Page | Status | Reference |
|------|--------|-----------|
| DepartmentsPage | ✅ Refactored | Use as template |
| LAYOUT_ARCHITECTURE_GUIDE.md | 📖 Complete guide | Read for details |
| REFACTORING_SUMMARY.md | 📊 Full summary | See what was done |
| BEFORE_AFTER_COMPARISON.md | 🔄 Visual comparison | See improvements |

---

## 🚀 Next Pages to Convert (Priority Order)

1. **UsersPage** - Simple list + detail ⭐ (start here)
2. **RolesPermissionsPage** - List + tabs
3. **AnnexuresPage** - Grid view + detail
4. **WorkflowConfigurationPage** - Workflows + config
5. **PSSRRecordsPage** - PSSR list + detail
6. **PSSRInitiatorManagementPage** - Initiators + config
7. **ReportsPage** - Reports + filters
8. **AuditLogsPage** - Logs + filters

---

## ⚡ Quick Command Reference

```bash
# Build to verify changes
npm run build

# Start dev server
npm run dev

# Check for errors
npm run build 2>&1 | grep -i error
```

---

## 🎓 Learn More

1. Read `LAYOUT_ARCHITECTURE_GUIDE.md` for detailed explanations
2. Study `DepartmentsPage.tsx` for real-world implementation
3. Check component JSDoc comments for detailed props
4. Review responsive behavior at different breakpoints

---

## 💡 Common Mistakes to Avoid

❌ **Don't** add `max-w-[...]` inside pages
✅ **Do** let AdminLayout/RoleLayout handle max-width

❌ **Don't** use flex-wrap for tabs
✅ **Do** use HorizontalTabs for 5+ tabs

❌ **Don't** create custom Metric/Card components
✅ **Do** use GridSystem components

❌ **Don't** mix spacing (px-4, px-5, px-6, px-7)
✅ **Do** use gap-2, gap-3, gap-4 consistently

❌ **Don't** nest scrollable containers
✅ **Do** keep single overflow-y-auto on main

---

## 🎯 Success = DepartmentsPage As Template

If your refactored page looks and behaves like DepartmentsPage, you've done it right!

✅ Professional split-panel layout
✅ Clean tab navigation
✅ Responsive metrics
✅ Consistent spacing
✅ Production-ready

---

**You're ready! Start with UsersPage as your second refactoring. Reference DepartmentsPage template above. All components are documented and production-tested.**

Good luck! 🚀
