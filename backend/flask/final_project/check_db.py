import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pathlib import Path

# Load env
repo_root = Path(__file__).resolve().parents[3]
load_dotenv(repo_root / ".env")

db_url = os.getenv("DATABASE_URL")
print(f"Connecting to database: {db_url}")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Check table sensor_readings
        try:
            res_sensors = conn.execute(text("SELECT COUNT(*) FROM sensor_readings"))
            count_sensors = res_sensors.scalar()
            print(f"Rows in sensor_readings: {count_sensors}")
            if count_sensors > 0:
                res_last = conn.execute(text("SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 5"))
                print("Last 5 sensor readings:")
                for r in res_last:
                    print(dict(r._mapping))
        except Exception as e:
            print(f"Error querying sensor_readings: {e}")

        # Check table access_audits
        try:
            res_audits = conn.execute(text("SELECT COUNT(*) FROM access_audits"))
            count_audits = res_audits.scalar()
            print(f"Rows in access_audits: {count_audits}")
            if count_audits > 0:
                res_last = conn.execute(text("SELECT * FROM access_audits ORDER BY created_at DESC LIMIT 5"))
                print("Last 5 access audits:")
                for r in res_last:
                    print(dict(r._mapping))
        except Exception as e:
            print(f"Error querying access_audits: {e}")
except Exception as e:
    print(f"Failed to connect: {e}")
