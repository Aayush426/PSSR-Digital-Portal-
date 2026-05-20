from faker import Faker
from passlib.context import CryptContext
import random

from app.database import SessionLocal, engine, Base
from app.models.user import User

# =========================================================
# DATABASE INITIALIZATION
# =========================================================

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# =========================================================
# UTILITIES
# =========================================================

fake = Faker()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# Generate ONE secure hash and reuse it
# This makes seeding thousands of users extremely fast.
COMMON_PASSWORD_HASH = pwd_context.hash("Admin@123")

# =========================================================
# STATIC ENTERPRISE DATA
# =========================================================

DEPARTMENTS = [
    "Operations",
    "Mechanical",
    "Electrical",
    "Instrumentation",
    "Inspection",
    "Safety",
    "Fire",
    "Civil",
    "Production",
    "Utilities",
    "Process",
    "Projects",
    "Maintenance",
    "Reliability",
    "HSE",
    "QA/QC",
    "Warehouse",
    "Planning",
    "Turnaround",
    "Engineering"
]

ROLES = [
    "TEAM_MEMBER",
    "AREA_OWNER"
]

PLANTS = [
    "Vadinar Refinery",
    "Jamnagar Refinery",
    "Hazira Terminal",
    "Mumbai Terminal"
]

DESIGNATIONS = [
    "Engineer",
    "Senior Engineer",
    "Inspection Officer",
    "Area Incharge",
    "Shift Supervisor",
    "Plant Operator",
    "Safety Officer"
]


# =========================================================
# HELPERS
# =========================================================

def generate_employee_id(department: str, index: int) -> str:
    """
    Example:
    NYR-OPS-1001
    """

    prefix = department[:3].upper()

    return f"NYR-{prefix}-{1000 + index}"


# =========================================================
# CREATE ADMIN USER
# =========================================================

admin_exists = db.query(User).filter(
    User.email == "admin@nayara.com"
).first()

if not admin_exists:

    admin = User(
        employee_id="NYR-ADM-0001",
        full_name="System Administrator",
        email="admin@nayara.com",
        password_hash=COMMON_PASSWORD_HASH,
        role="ADMIN",
        department="Administration",
        designation="System Administrator",
        plant_location="Corporate Office",
        active=True
    )

    db.add(admin)

    print("Admin user created")


# =========================================================
# CREATE ENTERPRISE USERS
# =========================================================

TOTAL_USERS = 10000

for i in range(1, TOTAL_USERS + 1):

    department = random.choice(DEPARTMENTS)

    user = User(
        employee_id=generate_employee_id(department, i),

        full_name=fake.name(),

        email=f"user{i}@nayara.com",

        password_hash=COMMON_PASSWORD_HASH,

        role=random.choice(ROLES),

        department=department,

        designation=random.choice(DESIGNATIONS),

        plant_location=random.choice(PLANTS),

        active=True
    )

    db.add(user)

    # Commit in batches for speed + memory efficiency
    if i % 500 == 0:
        db.commit()
        print(f"{i} users seeded...")


# Final commit
db.commit()

# =========================================================
# OUTPUT
# =========================================================

print("\n========================================")
print("10,000 enterprise users seeded successfully")
print("========================================")

print("\nADMIN LOGIN")
print("----------------------------------------")
print("Email    : admin@nayara.com")
print("Password : Admin@123")

print("\nSEEDED USER LOGIN")
print("----------------------------------------")
print("Email    : user1@nayara.com")
print("Password : Admin@123")

print("\nAny user from:")
print("user1@nayara.com")
print("to")
print("user10000@nayara.com")

print("========================================")

db.close()