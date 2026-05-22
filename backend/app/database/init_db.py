from app.database.database import engine, Base

# Note: this module is intended for ad-hoc bootstrap / migrations-less setups.
Base.metadata.create_all(bind=engine)

print("Database tables created successfully")
