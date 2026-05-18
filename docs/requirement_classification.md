## Requirement.Num - 4.2.1
Requirement - Create New PSSR 
Description - Ability to create a New PSSR
Role-  PSSR Initiator 
Module -PSSR management module 
Primary action - Creation of PSSR by the PSSR Initator and the necessary details to be filled out before submission of the PSSR .
Busisness Rule - Only user marked as PSSR initiator can initiate the PSSR creation process.
Access - Admin , PSSR Initiator , PSSR team member

## Requirement.Num -4.2.2
Requirement - View  PSSR
Description - PSSR Intiator can view the PSSR 
Role - PSSR Intiator 
Module - PSSR Management module 
primary action - Whoever has Initiated the PSSR shall be able to view 
Bussiness Rule : PSSR initator cannot edit PSSR 
Access- Admin, PSSR Initator , PSSR team member

## Requirement.Num -4.2.3
Requirement - View and Edit PSSR
Description - Deparment and team members can edit the PSSR with their Inputs
Role - PSSR Team Memebers
Module - PSSR Management module 
primary action - team members assigned to a specific PSSR can actually edit or view PSSR with whatever inputs they want 
Bussiness Rule : The name of the PSSR initator must be mentioned with the PSSR 
Access- Admin, PSSR Initator , PSSR team member

## Requirement.Num - 4.2.4
Requirement - Punch list 
Description - PSSR Initator can view or edit an punch list and also access PSSR's listed
Role - PSSR Intiator
Module - Punch list management 
primary action - PSSR Initator should be able to edit or view a punch list and also should have access to all the PSSR listed
Bussiness Rule: Only PSSR Initator and area owner can make changes to the punch list 
Access: Admin, Area owner, Team members , PSSR Initator

## Requirement.Num -4.2.5
Requirement - History log 
Description - History log related to a PSSR
Role-Applicable to every role 
Module -History log module 
Primary Action - Any role should be able to see the history logs made to a PSSR 
Bussiness Rule - Entire life cycle of PSSR should be made visible 
Acess- All categorized roles

## Requirement.Num - 4.2.6
Requirement - Under Preparation list 
Description - PSSR Initator can view Under preparation list
Role: PSSR Initator 
Module: Uunder Preparation list module 
primary action: PSSR Initator can View Under preparation list 
Bussiness Rule: Under preparation should only contain the list of the PSSR that hasn't been completed or submitted , after submission of PSSR , it will be moved to do list.
Access- PSSR Initators, PSSR team, Admin
## Requirement.Num - 4.2.7
Requirement- To Do list
Description - PSSR Initator should be able to view to do list
Role : PSSR initator 
Module - To do list module
primary action: to view the to do list 
Busssiness Rule:This list should only be populated only after the PSSR is completed and submitted
Acess:Admin, PSSR Initator ,Team memebers.
## Requirements.Num -4.2.8
Requirement -In progress
Description - to view in progress list 
Role-PSSR Initator
Module-In Progress Module 
primary action : to display in progress list
Business Rule: Only to be displayed when the team starts working on PSSR
Access : PSSR Initators,team member, admin
## Requirements.Num -4.2.9
Requirement - Completed by Department/Team member
Descriptiom - To view completed by department and team member and also pending site  visit list
Role-PSSR Initator
Module - Completed Module and Pending Site Visit module 
primary action - to display completed by department/ team member list and pemding site list 
Business Rule :the pssr can only be considered compeleted if all the things are complete  
Access: PSSR Initators , Team members,admin
## Requirements.Num -4.2.10 
Requirement - Pending Area Owner Approval list
Description - Completed by PSSR Initator and Pending Owner Approval list
Role- PSSR INitator , Area Owner
Module - Complted Module and pending Area owner approval module
primary action - Display the list of PSSR completed by PSSR Initator and also display the list of Pending Owner's Approval 
Business Rule: When the PSSR is submitted , It will show up in Area owner's page for approval 
Acccess: Team Member, Admin, PSSR Initator, Area owner 
## Requirement.Num - 4.2.11
Requirement - Approved List

Description - Area Owner should be able to view the approved list and access approved PSSR records

Role - Area Owner

Module - Approved List Module

Primary Action - Display all approved and completed PSSR records after Area Owner approval

Business Rule:
- Once Area Owner approves the punch list, the PSSR should move to Approved state
- No further modifications should be allowed after approval
- Approved PSSR should remain locked

Access - Area Owner, PSSR Initiator, Admin



## Requirement.Num - 4.2.12
Requirement - MOC Pending PSSR

Description - Area Owner should be able to view MOC Pending PSSR requests

Role - Area Owner

Module - MOC Pending PSSR Module

Primary Action - Display pending PSSR requests received from MOC workflow

Business Rule:
- This list should only display requests received from MOC workflow
- No actions should be allowed directly from this page
- Area managers can coordinate offline with PSSR Initiators

Access - Area Owner, PSSR Initiator, Admin



## Requirement.Num - 4.2.13
Requirement - To Do List for Department/Team Member

Description - Department/Team Members should be able to access assigned PSSR tasks

Role - PSSR Team Member

Module - Team Member To Do Module

Primary Action - Display PSSR records assigned to department/team members

Business Rule:
- PSSR should appear in this list only after assignment
- Checklist questions associated with assigned annexures should be visible
- If no records exist, system should display 'No items found'

Access - Team Members, Admin



## Requirement.Num - 4.2.14
Requirement - In Progress List for Department/Team Member

Description - Department/Team Members should be able to access in-progress PSSR records

Role - PSSR Team Member

Module - In Progress Module

Primary Action - Display PSSR records currently being worked upon

Business Rule:
- PSSR should move from To Do to In Progress once the team member starts working
- Draft save functionality should be available
- If no records exist, system should display 'No items found'

Access - Team Members, Admin



## Requirement.Num - 4.2.15
Requirement - Completed List for Department/Team Member

Description - Department/Team Members should be able to view completed PSSR records

Role - PSSR Team Member

Module - Completed Module

Primary Action - Display completed checklist submissions

Business Rule:
- PSSR should move to Completed list only after submission
- No additional actions should be allowed after completion
- If no records exist, system should display 'No items found'

Access - Team Members, Admin



## Requirement.Num - 4.2.16
Requirement - Admin Home Page

Description - Admin should be able to access admin dashboard and homepage

Role - Admin

Module - Admin Dashboard Module

Primary Action - Provide centralized admin access to all management sections

Business Rule:
- Only admin users should access this page
- Admin should be able to access:
  - Manage Department/Team Members
  - Manage Annexures
  - Manage Users & Roles
  - Reports
- Dashboard should display all PSSR records

Access - Admin



## Requirement.Num - 4.2.17
Requirement - Admin Manage Department/Team Members

Description - Admin should be able to manage department and team member information

Role - Admin

Module - Department & Team Management Module

Primary Action - Add, edit, or delete department/team member information

Business Rule:
- Changes should reflect throughout the portal
- Department/team members should remain centrally managed
- Admin should be able to configure department mappings

Access - Admin



## Requirement.Num - 4.2.18
Requirement - Admin Manage Annexures

Description - Admin should be able to manage annexures available in the portal

Role - Admin

Module - Annexure Management Module

Primary Action - Create, edit, delete, and configure annexures

Business Rule:
- Annexure changes should reflect portal-wide
- Annexure templates should support uploads
- Annexure names and numbering should remain editable
- Soft deletion should be supported
- Annexures should support department mapping

Access - Admin



## Requirement.Num - 4.2.19
Requirement - Admin Manage Users & Roles

Description - Admin should be able to manage users and their assigned roles

Role - Admin

Module - User & Role Management Module

Primary Action - Add, edit, delete users and assign system roles

Business Rule:
- Role changes should immediately affect portal permissions
- User-role mapping should remain centralized
- Role-based access control should be enforced

Access - Admin



## Requirement.Num - 4.2.20
Requirement - Admin Manage Workflows

Description - Admin should be able to manage workflow configurations

Role - Admin

Module - Workflow Management Module

Primary Action - Configure and monitor workflow stages and actions

Business Rule:
- Workflow stages should remain configurable
- Workflow actions should support assignment and status tracking
- Workflow changes should not affect completed PSSR records

Access - Admin

---

## Requirement.Num - 4.2.21
Requirement - Reports

Description - Admin and Area Owner should be able to access reports

Role - Admin, Area Owner

Module - Reporting Module

Primary Action - Generate and view reports related to PSSR activities

Business Rule:
- Admin should be able to view all PSSR reports
- Area Owner should only view reports related to their area
- Reports should support:
  - Search
  - Filtering
  - Export to Excel
  - Print PDF
- Reports should support filtering using:
  - PSSR Number
  - PSSR Status
  - Department/Team Member
  - Date Range

Access - Admin, Area Owner


## Requirement.Num - 4.2.22
Requirement - Email Notifications

Description - System should send email notifications related to PSSR activities

Role - System Generated

Module - Notification Module

Primary Action - Trigger automated email notifications based on workflow events

Business Rule:
- Notifications should trigger on:
  - New PSSR creation
  - Team member assignment
  - Workflow status changes
  - In Progress updates
  - Completion status
  - Pending Site Visit
- Notifications should be sent to relevant stakeholders only
- Notification history should remain traceable

Access - PSSR Initiator, Team Members, Area Owner, Admin