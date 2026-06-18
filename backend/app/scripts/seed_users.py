"""
Enterprise-grade user seeding script for the Digital PSSR Portal.

This script creates:
- 1 ADMIN user
- Multiple TEAM_MEMBER users
- Multiple AREA_OWNER users

Architecture Notes:
- TEAM_MEMBER users belong to departments
- AREA_OWNER users own refinery operational areas
- Only AREA_OWNER users receive plant locations
- All users use enterprise-secure bcrypt hashing
- Seeding is optimized using batch commits

Environment:
- PostgreSQL
- SQLAlchemy ORM
- FastAPI backend
"""

import random
from datetime import datetime

from faker import Faker
from sqlalchemy import select

from app.auth.password_handler import hash_password
from app.database import Base, SessionLocal, engine
from app.models.user import User, UserRole
from app.scripts.seed_annexures import seed_annexures
from app.scripts.seed_tasks import seed_enterprise_tasks


# DATABASE INITIALIZATION


Base.metadata.create_all(bind=engine)

fake = Faker()


# CONFIGURATION


COMMON_PASSWORD = "Admin@123"

TOTAL_USERS = 10000

BATCH_SIZE = 1000


# ENTERPRISE REFINERY DEPARTMENTS


DEPARTMENTS = [
    "Safety",
    "PM Operation",
    "Process",
    "Mechanical",
    "Inspection",
    "Civil",
    "Electrical",
    "Instrumental",
    "Fire",
    "IT"
]


# REFINERY PLANT SITES


PLANTS = [
    "Vadinar Refinery",
    "Jamnagar Refinery",
    "Hazira Terminal",
    "Mumbai Terminal"
]


# REFINERY OPERATIONAL AREAS


OPERATIONAL_AREAS = [
    "CDU",
    "VDU",
    "Hydrocracker",
    "Sulfur Recovery",
    "Utilities",
    "Tank Farm",
    "Hydrogen Unit",
]


# TEAM MEMBER DESIGNATIONS


TEAM_DESIGNATIONS = [
    "Engineer",
    "Senior Engineer",
    "Inspection Officer",
    "Shift Supervisor",
    "Plant Operator",
    "Safety Officer",
    "Maintenance Engineer",
    "Process Engineer",
]


# ROLE DISTRIBUTION


def role_for_index(index: int) -> str:
    """
    Deterministic role allocation.

    Every 10th user becomes an AREA_OWNER.
    Remaining users become TEAM_MEMBER.
    """

    return (
        UserRole.AREA_OWNER.value
        if index % 10 == 0
        else UserRole.TEAM_MEMBER.value
    )



# EMPLOYEE ID GENERATION


def generate_employee_id(department: str, index: int) -> str:
    """
    Generate enterprise employee IDs.

    Example:
    NYR-MEC-1001
    """

    return f"NYR-{department[:3].upper()}-{1000 + index}"



# USER FACTORY


def build_seed_user(index: int, password_hash: str) -> User:
    """
    Create enterprise refinery users.

    TEAM_MEMBER:
    - belongs to department
    - no plant ownership
    - technical designation

    AREA_OWNER:
    - owns operational refinery area
    - receives plant assignment
    - no department dependency
    """

    role = role_for_index(index)

    department = random.choice(DEPARTMENTS)

    is_area_owner = role == UserRole.AREA_OWNER.value

    operational_area = random.choice(OPERATIONAL_AREAS)

    return User(
        employee_id=generate_employee_id(department, index),

        full_name=fake.name(),

        email=f"user{index}@nayara.com",

        password_hash=password_hash,

        role=role,

        
        # TEAM MEMBER STRUCTURE
        
        department=(
            None
            if is_area_owner
            else department
        ),

        designation=(
            f"{operational_area} Area Owner"
            if is_area_owner
            else random.choice(TEAM_DESIGNATIONS)
        ),

        
        # ONLY AREA OWNERS RECEIVE PLANT ASSIGNMENT
        
        plant_location=(
            random.choice(PLANTS)
            if is_area_owner
            else None
        ),

        active=True,
    )



# ADMIN UPSERT


def upsert_admin(db, password_hash: str) -> None:
    """
    Create or refresh enterprise admin account.
    """

    admin = db.query(User).filter(
        User.email == "admin@nayara.com"
    ).first()

    if admin:
        admin.password_hash = password_hash
        admin.role = UserRole.ADMIN.value
        admin.active = True
        admin.updated_at = datetime.utcnow()

        print("Admin user verified and refreshed")

        return

    db.add(
        User(
            employee_id="NYR-ADM-0001",

            full_name="System Administrator",

            email="admin@nayara.com",

            password_hash=password_hash,

            role=UserRole.ADMIN.value,

            department="Administration",

            designation="System Administrator",

            plant_location="Corporate Office",

            active=True,
        )
    )

    print("Admin user created")



# MAIN USER SEEDING


def seed_enterprise_users() -> None:
    """
    Seed enterprise refinery users.

    Workflow:
    1. Create admin
    2. Create TEAM_MEMBER users
    3. Create AREA_OWNER users
    4. Seed refinery workflow tasks
    """

    password_hash = hash_password(COMMON_PASSWORD)

    db = SessionLocal()

    try:

        print("\n========================================")
        print("Digital PSSR enterprise user seed started")
        print("========================================")

        print(f"Target users : {TOTAL_USERS}")
        print(f"Batch size   : {BATCH_SIZE}")

        
        # ADMIN CREATION
        

        upsert_admin(db, password_hash)

        db.commit()

        
        # FETCH EXISTING USERS
        

        existing_emails = set(
            db.execute(
                select(User.email).where(
                    User.email.like("user%@nayara.com")
                )
            ).scalars()
        )

        pending_new_users: list[User] = []

        refreshed_existing = 0


        # ENTERPRISE USER CREATION
        

        for index in range(1, TOTAL_USERS + 1):

            email = f"user{index}@nayara.com"

            if email in existing_emails:

                db.query(User).filter(
                    User.email == email
                ).update(
                    {
                        "password_hash": password_hash,
                        "role": role_for_index(index),
                        "active": True,
                        "updated_at": datetime.utcnow(),
                    },
                    synchronize_session=False,
                )

                refreshed_existing += 1

            else:

                pending_new_users.append(
                    build_seed_user(index, password_hash)
                )

            
            # BATCH COMMIT OPTIMIZATION
            

            if index % BATCH_SIZE == 0:

                if pending_new_users:

                    db.bulk_save_objects(
                        pending_new_users
                    )

                    pending_new_users.clear()

                db.commit()

                print(
                    f"Processed {index}/{TOTAL_USERS} users "
                    f"({refreshed_existing} refreshed)"
                )

        
        # FINAL INSERT COMMIT
        

        if pending_new_users:

            db.bulk_save_objects(
                pending_new_users
            )

        db.commit()

        print("\nEnterprise users seeded successfully")

    finally:

        db.close()

    
    # TASK SEEDING
    

    seed_enterprise_tasks()
    seed_annexures()

    
    # LOGIN OUTPUT
    

    print("\n========================================")
    print("Digital PSSR enterprise seed completed")
    print("========================================")

    print("\nADMIN LOGIN")
    print("----------------------------------------")
    print("Email    : admin@nayara.com")
    print("Password : Admin@123")

    print("\nTEAM MEMBER LOGIN")
    print("----------------------------------------")
    print("Email    : user1@nayara.com")
    print("Password : Admin@123")

    print("\nAREA OWNER LOGIN")
    print("----------------------------------------")
    print("Email    : user10@nayara.com")
    print("Password : Admin@123")

    print("\nSEEDED USER RANGE")
    print("----------------------------------------")
    print("user1@nayara.com")
    print("to")
    print("user10000@nayara.com")

    print("========================================")



# SCRIPT ENTRYPOINT


if __name__ == "__main__":
    seed_enterprise_users()
