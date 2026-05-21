"""Seed enterprise PSSR task data for live dashboards."""

import random
from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models.pssr import PSSRActivityLog, PSSRMocReview
from app.models.pssr_task import PSSRTask
from app.models.user import User, UserRole

Base.metadata.create_all(bind=engine)

TOTAL_TASKS = 2500
BATCH_SIZE = 500

UNITS = ["CDU", "VDU", "Hydrocracker", "Sulfur Recovery", "Utilities", "Tank Farm", "Hydrogen Unit"]
DEPARTMENTS = ["Operations", "Mechanical", "Electrical", "Instrumentation", "Inspection", "Safety", "Maintenance", "Reliability"]
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
STATUSES = ["Not Started", "In Progress", "Completed", "Pending Review"]
TASK_TITLES = [
    "equipment isolation and reinstatement readiness",
    "emergency shutdown permissive verification",
    "relief valve bypass restoration checklist",
    "instrument loop validation before startup",
    "rotating equipment lube oil skid commissioning",
    "process line hydrotest punch-point closure",
    "fire and gas detector coverage validation",
    "confined space blind list closeout",
]


def seed_enterprise_tasks(total_tasks: int = TOTAL_TASKS) -> None:
    """Generate PostgreSQL-backed PSSR tasks assigned to seeded users."""

    db = SessionLocal()
    try:
        team_members = (
            db.query(User)
            .filter(User.role == UserRole.TEAM_MEMBER.value, User.active.is_(True))
            .order_by(User.id.asc())
            .limit(250)
            .all()
        )
        area_owners = (
            db.query(User)
            .filter(User.role == UserRole.AREA_OWNER.value, User.active.is_(True))
            .order_by(User.id.asc())
            .limit(50)
            .all()
        )
        if not team_members or not area_owners:
            raise RuntimeError("Seed users before seeding PSSR tasks.")

        seed_focus_dashboard_tasks(db, team_members[0], area_owners[0])
        existing = db.query(PSSRTask).filter(PSSRTask.pssr_id.like("PSSR-VDN-%")).count()
        if existing >= total_tasks:
            seed_moc_reviews(db, area_owners)
            print(f"PSSR task seed skipped: {existing} records already present")
            return

        print(f"Seeding {total_tasks} enterprise PSSR tasks...")
        pending_tasks: list[PSSRTask] = []
        pending_activity: list[PSSRActivityLog] = []

        for index in range(existing + 1, total_tasks + 1):
            task = build_task(index, team_members[(index - 1) % len(team_members)], area_owners[(index - 1) % len(area_owners)])
            pending_tasks.append(task)
            pending_activity.append(build_activity(task))

            if len(pending_tasks) >= BATCH_SIZE:
                db.bulk_save_objects(pending_tasks)
                db.bulk_save_objects(pending_activity)
                db.commit()
                print(f"Seeded {index}/{total_tasks} PSSR tasks")
                pending_tasks.clear()
                pending_activity.clear()

        if pending_tasks:
            db.bulk_save_objects(pending_tasks)
            db.bulk_save_objects(pending_activity)
            db.commit()

        seed_moc_reviews(db, area_owners)
        print("Enterprise PSSR task seed completed")
    finally:
        db.close()


def build_task(index: int, team_member: User, area_owner: User) -> PSSRTask:
    """Create one realistic refinery PSSR task."""

    unit = random.choice(UNITS)
    status = random.choice(STATUSES)
    total_questions = random.randint(28, 72)
    progress = progress_for_status(status)
    submitted_date = datetime.utcnow() - timedelta(days=random.randint(0, 10)) if status in {"Completed", "Pending Review"} else None

    return PSSRTask(
        pssr_id=f"PSSR-VDN-{unit.upper().replace(' ', '')}-{240000 + index}",
        pssr_title=f"{unit} {random.choice(TASK_TITLES)}",
        unit=unit,
        department=random.choice(DEPARTMENTS),
        priority=random.choices(PRIORITIES, weights=[20, 40, 28, 12], k=1)[0],
        status=status,
        assigned_to_user_id=team_member.id,
        area_owner_user_id=area_owner.id,
        due_date=datetime.utcnow() + timedelta(days=random.randint(-5, 21)),
        questions_answered=round(total_questions * progress / 100),
        total_questions=total_questions,
        progress=progress,
        reviewer_name=area_owner.full_name if submitted_date else None,
        submitted_date=submitted_date,
    )


def seed_focus_dashboard_tasks(db, team_member: User, area_owner: User) -> None:
    """Guarantee the primary seeded logins have populated dashboard cards."""

    if db.query(PSSRTask).filter(PSSRTask.pssr_id == "PSSR-VDN-CDU-FOCUS-001").first():
        return

    now = datetime.utcnow()
    focus_specs = [
        ("PSSR-VDN-CDU-FOCUS-001", "CDU pump seal replacement readiness", "CDU", "Mechanical", "HIGH", "Not Started", 0, 42, 4),
        ("PSSR-VDN-HCU-FOCUS-002", "Hydrocracker nitrogen purge verification", "Hydrocracker", "Operations", "CRITICAL", "Not Started", 0, 56, 2),
        ("PSSR-VDN-SRU-FOCUS-003", "Sulfur Recovery analyzer bypass reinstatement", "Sulfur Recovery", "Instrumentation", "MEDIUM", "Not Started", 0, 34, 7),
        ("PSSR-VDN-UTL-FOCUS-004", "Utilities boiler feed header commissioning", "Utilities", "Operations", "MEDIUM", "In Progress", 70, 40, 5),
        ("PSSR-VDN-HYD-FOCUS-005", "Hydrogen Unit ESD loop validation", "Hydrogen Unit", "Safety", "HIGH", "In Progress", 48, 64, 3),
        ("PSSR-VDN-TKF-FOCUS-006", "Tank Farm roof drain return-to-service review", "Tank Farm", "Inspection", "MEDIUM", "Completed", 100, 37, -2),
        ("PSSR-VDN-VDU-FOCUS-007", "VDU furnace permissive checklist closeout", "VDU", "Reliability", "CRITICAL", "Pending Review", 100, 51, 1),
    ]
    tasks = [
        PSSRTask(
            pssr_id=pssr_id,
            pssr_title=title,
            unit=unit,
            department=department,
            priority=priority,
            status=status,
            assigned_to_user_id=team_member.id,
            area_owner_user_id=area_owner.id,
            due_date=now + timedelta(days=due_offset),
            questions_answered=round(total_questions * progress / 100),
            total_questions=total_questions,
            progress=progress,
            reviewer_name=area_owner.full_name if status in {"Completed", "Pending Review"} else None,
            submitted_date=now - timedelta(days=1) if status in {"Completed", "Pending Review"} else None,
        )
        for pssr_id, title, unit, department, priority, status, progress, total_questions, due_offset in focus_specs
    ]
    db.bulk_save_objects(tasks)
    db.bulk_save_objects([build_activity(task) for task in tasks])
    db.commit()


def progress_for_status(status: str) -> int:
    if status == "Not Started":
        return 0
    if status == "In Progress":
        return random.randint(15, 85)
    return 100


def build_activity(task: PSSRTask) -> PSSRActivityLog:
    action_by_status = {
        "Not Started": "Assigned",
        "In Progress": "Checklist Updated",
        "Completed": "Assessment Completed",
        "Pending Review": "Submitted for Review",
    }
    return PSSRActivityLog(
        pssr_id=task.pssr_id,
        user_id=task.assigned_to_user_id,
        area_owner_user_id=task.area_owner_user_id,
        action=action_by_status.get(task.status, "Updated"),
        detail=f"{task.unit} {task.department} workflow moved to {task.status}",
        timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
    )


def seed_moc_reviews(db, area_owners: list[User]) -> None:
    if db.query(PSSRMocReview).filter(PSSRMocReview.moc_id.like("MOC-VDN-%")).count() >= 100:
        return

    reviews = [
        PSSRMocReview(
            moc_id=f"MOC-VDN-2026-{1000 + index}",
            area_owner_user_id=area_owners[index % len(area_owners)].id,
            due_date=(datetime.utcnow() + timedelta(days=random.randint(1, 18))).date().isoformat(),
            priority=random.choices(PRIORITIES, weights=[10, 35, 35, 20], k=1)[0],
            status="Pending",
        )
        for index in range(100)
    ]
    db.bulk_save_objects(reviews)
    db.commit()


if __name__ == "__main__":
    seed_enterprise_tasks()
