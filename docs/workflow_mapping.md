# PSSR Workflow Mapping






## Workflow State - Draft

Description:
Initial state when a PSSR is created but not submitted.

Responsible Role:
- PSSR Initiator

Allowed Actions:
- Create PSSR
- Save draft
- Add PSSR details
- Select annexures
- Assign team members

Business Rules:
- Draft PSSR should remain editable
- Draft PSSR should not be visible to unauthorized users

Next State:
- Under Preparation



## Workflow State - Under Preparation

Description:
PSSR configuration and preparation activities are ongoing.

Responsible Role:
- PSSR Initiator

Allowed Actions:
- Update PSSR details
- Modify annexures
- Add remarks
- Configure assignments

Business Rules:
- Mandatory fields must be completed before submission
- PSSR should remain editable

Next State:
- To Do



## Workflow State - To Do

Description:
PSSR is assigned to department/team members and awaiting action.

Responsible Role:
- PSSR Team Member

Allowed Actions:
- View assigned PSSR
- Start checklist activities

Business Rules:
- Only assigned users should view the task
- Checklist visibility depends on assigned annexures

Next State:
- In Progress



## Workflow State - In Progress

Description:
Department/team members are actively working on the PSSR checklist.

Responsible Role:
- PSSR Team Member

Allowed Actions:
- Update checklist
- Add remarks
- Upload attachments
- Save progress

Business Rules:
- Draft save functionality should be available
- Workflow history should be maintained

Next State:
- Pending Site Visit



## Workflow State - Pending Site Visit

Description:
Checklist activities are completed and site verification is pending.

Responsible Role:
- PSSR Initiator
- Area Owner

Allowed Actions:
- Review checklist completion
- Review pending punch items

Business Rules:
- All mandatory checklist items must be completed
- Open punch items should remain visible

Next State:
- Pending Area Owner Approval



## Workflow State - Pending Area Owner Approval

Description:
PSSR is awaiting final approval from Area Owner.

Responsible Role:
- Area Owner

Allowed Actions:
- Review PSSR
- Approve punch list
- Review attachments and remarks

Business Rules:
- Approval action should be logged
- Rejection functionality is currently undefined

Next State:
- Approved



## Workflow State - Approved

Description:
PSSR has been approved by Area Owner.

Responsible Role:
- Area Owner
- Admin
- PSSR Initiator

Allowed Actions:
- View approved records
- Generate reports
- Print records

Business Rules:
- No further modifications should be allowed
- Approved records should remain auditable

Next State:
- Locked / Completed



## Workflow State - Locked / Completed

Description:
Final immutable state of the PSSR lifecycle.

Responsible Role:
- System Controlled

Allowed Actions:
- Read-only access
- Reporting access

Business Rules:
- No edits should be allowed
- Audit history should remain accessible



# Workflow Ownership Mapping

| Workflow State | Responsible Role |
|---|---|
| Draft | PSSR Initiator |
| Under Preparation | PSSR Initiator |
| To Do | Team Member |
| In Progress | Team Member |
| Pending Site Visit | PSSR Initiator / Area Owner |
| Pending Area Owner Approval | Area Owner |
| Approved | Area Owner |
| Locked / Completed | System |

---

# Workflow Transition Mapping

| From State | To State | Trigger |
|---|---|---|
| Draft | Under Preparation | Initiator starts preparation |
| Under Preparation | To Do | PSSR submitted |
| To Do | In Progress | Team member starts work |
| In Progress | Pending Site Visit | Checklist completion |
| Pending Site Visit | Pending Area Owner Approval | Submission for approval |
| Pending Area Owner Approval | Approved | Area Owner approval |
| Approved | Locked / Completed | Workflow closure |

---

# Audit Requirements

The system should maintain logs for:
- Workflow transitions
- Checklist modifications
- Punch updates
- Approval activities
- User actions
- Attachment uploads

---

# Future Workflow Considerations

- Future MOC integration support
- Configurable workflow stages
- Workflow reassignment support
- Escalation rules
- SLA tracking
- Rejection workflow support