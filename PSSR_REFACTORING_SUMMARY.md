# PSSR Annexure Refactoring - Complete Implementation Summary

**Date:** May 28, 2026  
**Status:** ✅ Frontend Refactoring Complete | ⏳ Ready for Testing

---

## Executive Summary

This refactoring completely redesigns the PSSR Annexure and Question Assignment workflow to align with actual refinery PSSR operational processes. The system now properly separates annexure templates from checkpoint assignment, allowing initiators to dynamically and manually assign departments to individual checkpoints rather than auto-assigning by annexure.

---

## Key Changes Implemented

### 1. Frontend UI Redesign (PSSR Creation Form)

#### A. Annexure Selection Flow - NEW WORKFLOW
**Old Behavior:** Selecting an annexure immediately fetched all questions and assumed auto-department mapping.  
**New Behavior:** Staged workflow with clear user intent:

```
Step 1: SELECT ANNEXURE TYPE
├─ Shows annexure code, title, checkpoint count
├─ User clicks "Select" button
└─ No auto-fetching of questions

Step 2: VIEW CHECKPOINTS
├─ User clicks "View Checkpoints" to expand
├─ Questions lazy-load on demand
├─ User sees all available checkpoints
└─ Can filter by type (Document/Field) and search

Step 3: ASSIGN TO DEPARTMENT/MEMBER
├─ For each checkpoint, select responsible department
├─ Responsible department dropdown only shows PSSR Team Members
├─ Then select specific team member
└─ Manual assignment at checkpoint level
```

#### B. Checkpoint Type Display - CLEAR CATEGORIZATION
Every question now clearly displays its type:
- **📄 DOCUMENT CHECKPOINT** - Document review, SOP verification, approval checks
- **🔧 FIELD CHECKPOINT** - Equipment checks, field observations, physical inspections

Questions can be filtered by type for better organization.

#### C. Question Cards - SIMPLIFIED & FOCUSED
Each question displays:
```
[✓] Question text
    
Type: 📄 DOCUMENT or 🔧 FIELD
Department: [Dropdown - only team members]
Assigned to: [Dropdown - filtered by dept]
```

**Removed Clutter:**
- ❌ "Mandatory" tags
- ❌ "Punch A/B/C" categories
- ❌ "Auto-mapped" labels
- ❌ "Pending approval" status tags
- ❌ Unnecessary description headers
- ❌ Hardcoded department mappings
- ❌ "Continue" and "Upload" instructions

#### D. Custom Question Builder - UPDATED
Form now includes proper fields:
- Question title
- Description
- **Checkpoint Type** (DOCUMENT or FIELD) - **REQUIRED**
- Responsible Department - **REQUIRED**
- Assigned Team Member - **REQUIRED**

#### E. Question Summary Table - CLEANER
Shows selected checkpoints with:
- Sequence number
- Question text + annexure code
- Type badge (📄 Document | 🔧 Field)
- Department assignment
- Team member assignment

---

## Backend Status

### Database Schema
✅ **question_type field exists** in both:
- `annexure_questions.question_type` (VARCHAR, default='FIELD')
- `pssr_questions.question_type` (VARCHAR, default='FIELD')

### API & Validation
✅ **CheckpointType Literal** already defined:
```python
CheckpointType = Literal["DOCUMENT", "FIELD"]
```

✅ **API Validation** in PSSRCreateRequest:
```python
selected_questions: list[PSSRSelectedQuestionIn] = []
# Each item includes: question_type: CheckpointType
```

✅ **Workflow Service** already enforces:
- All questions must have checkpoint type assigned
- All questions must have department and member assigned
- Duplicate selections prevented
- Validation happens before creation

✅ **E-Sign Security** already implemented:
- Prevents multiple signatures by same user
- Tracks signer user ID and timestamp
- Validates signature authority
- Locked signatures after sign

---

## Frontend Code Changes

### Modified File
`Frontend/src/pages/team/DashboardPage.tsx`

### Changed Components

#### 1. AnnexureQuestionSelector (Lines ~1074-1320)
- Simplified header with essential info only
- Separated action buttons (Select / View Checkpoints)
- Added checkpoint type filter dropdown
- Added search functionality
- Clean question card layout
- Department/member dropdowns only show selected team members
- Emoji indicators for checkpoint types

#### 2. CustomQuestionBuilder (Lines ~1321-1380)
- Improved form layout with grid
- Added type selector (Document/Field)
- Department and member assignment
- Cleaner remove button
- Better visual feedback

#### 3. Question Summary Table (Lines ~773-810)
- Simplified columns: S.N, Checkpoint, Type, Department, Member
- Added emoji badges for type
- Better error indication for unassigned
- Removed extra fields and clutter
- Hover effects for better UX

#### 4. Helper Functions
- Added `questionCheckpointType()` to extract checkpoint type from question

#### 5. Form Labels & Messaging
- Updated "Annexure Selection" → "Checkpoint Selection"
- Added clear workflow instructions (Step 1, 2, 3)
- Updated checkbox label: "Attach annexure checklist" → "Include annexures"
- Better section descriptions

---

## Workflow Rules (Now Properly Enforced)

1. ✅ **Annexure selection DOES NOT assign ownership**
2. ✅ **Question selection creates assignments**
3. ✅ **Assignment happens at question level** (not annexure level)
4. ✅ **Multiple departments can exist inside same annexure**
5. ✅ **Same department can own multiple checkpoints**
6. ✅ **Checkpoints must have checkpoint type assigned**
7. ✅ **Checkpoints must have department AND member assigned**

---

## PSSR Status Flow

**UNDER_PREPARATION** (Editable by initiator)
- Initiator can add/remove questions
- Initiator can change assignments
- Initiator can modify team members

**TO_DO** (After submission)
- Appears in assigned department/team member queue
- Visible to assigned members
- Not editable by initiator

**IN_PROGRESS** (Work begins)
- Assigned member starts answering checkpoints
- Responses recorded per checkpoint

**COMPLETED_BY_TEAM** (All departments done)
- All assigned checkpoints answered and e-signed
- Department completion verified

**PENDING_AREA_OWNER_APPROVAL** (Awaiting approval)
- Area owner reviews all responses
- Can approve or reject

**APPROVED / COMPLETED** (Final state)
- PSSR workflow complete
- All signatures in place

---

## Validation Improvements

### Prevents Submission Without:
- ❌ No annexure selected
- ❌ No checkpoints selected
- ❌ Checkpoint without responsible department assigned
- ❌ Checkpoint without responsible member assigned
- ❌ Missing checkpoint type

### Form Error Messages Updated:
- "Assign a responsible department and selected team member for every checkpoint."
- "At least one annexure template must be selected."
- "At least one checkpoint must be selected or added."

---

## Testing Checklist

### Phase 1: Frontend UI
- [ ] Open PSSR creation form
- [ ] Verify annexures display without auto-expanding
- [ ] Click "View Checkpoints" - questions should expand
- [ ] Verify checkpoint type filter works
- [ ] Verify search functionality
- [ ] Select different checkpoints
- [ ] Verify department dropdown only shows team members
- [ ] Verify member dropdown filters by department
- [ ] Submit form and verify validation errors work

### Phase 2: Custom Questions
- [ ] Add custom question
- [ ] Set checkpoint type (Document/Field)
- [ ] Verify type selector works
- [ ] Verify department dropdown populated
- [ ] Verify member dropdown filters
- [ ] Remove custom question

### Phase 3: Summary Table
- [ ] Select multiple checkpoints
- [ ] Verify summary table shows all
- [ ] Verify type badges display correctly
- [ ] Verify department/member display

### Phase 4: Form Submission
- [ ] Submit form with all fields
- [ ] Verify PSSR created successfully
- [ ] Verify team member can see assignments
- [ ] Verify workflow state transitions work
- [ ] Verify e-signing functionality

### Phase 5: End-to-End
- [ ] Create PSSR with multiple annexures
- [ ] Verify checkpoints distributed across departments
- [ ] Verify team member sees correct checkpoints
- [ ] Verify field/document checkpoint handling
- [ ] Verify area owner approval flow

---

## Database Seeding Notes

Ensure existing annexure questions have checkpoint types set:

```sql
-- Verify checkpoint types are populated
SELECT COUNT(*) as missing_types 
FROM annexure_questions 
WHERE question_type IS NULL OR question_type = '';

-- Update if needed
UPDATE annexure_questions 
SET question_type = 'DOCUMENT' 
WHERE category LIKE '%document%' OR category LIKE '%approval%';

UPDATE annexure_questions 
SET question_type = 'FIELD' 
WHERE question_type IS NULL OR question_type = '';
```

---

## API Compatibility

### No Breaking Changes
All existing APIs remain unchanged:
- ✅ POST `/pssr` - Still accepts same payload
- ✅ GET `/annexures` - Returns same structure
- ✅ POST `/annexures/respond` - Same response format

### Enhanced Validation
- API now validates checkpoint type is provided
- API validates department assignment exists in team members
- API validates member exists in selected team members

---

## Performance Improvements

1. **Lazy Loading**: Questions only fetch when "View Checkpoints" clicked
2. **Search & Filter**: Client-side filtering reduces server load
3. **Simplified Rendering**: Less UI complexity = faster load times
4. **Reduced DOM Elements**: Removed unnecessary UI clutter

---

## Accessibility & UX Improvements

✅ Clear workflow indicators  
✅ Emoji icons for quick type identification  
✅ Descriptive button labels  
✅ Proper form validation messages  
✅ Logical field ordering  
✅ Filtered dropdowns reduce confusion  
✅ Summary table for review before submission  

---

## Migration Notes

For existing PSSR records:
- No migration needed - question_type already exists
- Set type on-the-fly based on category if needed
- E-sign records remain unchanged
- Workflow states unchanged

---

## Future Enhancements

Consider for Phase 2:
1. Bulk edit checkpoint assignments
2. Templates for common checkpoint patterns
3. Checkpoint type hints based on question content
4. Department capacity planning
5. Checkpoint duplication detection
6. Validation rules per checkpoint type

---

## Support & Debugging

### Common Issues

**Q: Department dropdown is empty**  
A: Ensure team members are added to PSSR before selecting checkpoints

**Q: Questions not loading**  
A: Click "View Checkpoints" button explicitly to expand

**Q: Member dropdown disabled**  
A: Select a department first, then click member dropdown

**Q: Validation error on submit**  
A: Verify all selected checkpoints have both department AND member assigned

---

## Summary

This refactoring transforms the PSSR workflow from an auto-assignment model to a **dynamic, user-driven assignment model** that accurately reflects real refinery PSSR operations. Checkpoints are now properly categorized as DOCUMENT or FIELD, and department ownership is assigned at the individual checkpoint level rather than at the annexure level.

The new UX is cleaner, faster, and more intuitive while maintaining full data integrity and validation.

**Status:** ✅ Ready for QA Testing

