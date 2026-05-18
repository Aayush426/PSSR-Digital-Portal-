# Roles Identified
1. Admin
## Responsibilities
- Manage department/team member records
- Manage annexures
- Manage users and roles
- Manage report visibility
## Permissions
- View all PSSR records and details
- Access global reports
- Soft delete annexures
## Restrictions
- Cannot directly edit PSSR workflow activities

2. PSSR Initiator
## Responsibilities
- Create new PSSR
- Progress PSSR workflow
- Manage punch list
- Fill checklist details
- Track workflow progress
## Actions
- Select annexures
- Select team members
- Save PSSR as draft
- Submit PSSR
- View workflow history
## Workflow Capabilities
- Manage PSSR lifecycle
- Monitor PSSR status progression

 3. PSSR Team Member

## Responsibilities
- Complete assigned checklist sections
- Update checklist responses
- Add remarks and attachments

## Actions
- View department/team member details
- Update checklist values (Yes / No / NA)
- Upload attachments
- Print checklist section



4. Area Owner

## Responsibilities
- Review PSSR workflows
- Approve punch lists
- Access area-specific reports

## Permissions
- View PSSR details
- Edit PSSR details
- Delete PSSR records (conditional)

## Workflow Rules
- PSSR can only be deleted if deletion is permitted by the PSSR Initiator
- Punch lists can only be approved and cannot be rejected
- PSSR should become locked after approval



-------------------------------------------------------------------------------------

# Workflow States Identified

- Draft
- Under Preparation
- To Do
- In Progress
- Pending Site Visit
- Pending Approval
- Approved
- Completed
- Locked

-----------------------------------------------------------------------------------------------

# Initial Business Rules Identified

- MOC and Non-MOC workflows should remain separate
- Annexures should support soft deletion
- Approved PSSR records should become locked
- Workflow history should be maintained
- Team member selection should be configurable
- Punch approvals can only be performed by Area Owner
- Deletion permissions should be controlled by workflow ownership

-----------------------------------------------------------------------------------------------------

