import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")

def upgrade_db():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN full_name VARCHAR")
        print("Successfully added full_name column to users table")
    except sqlite3.OperationalError as e:
        print(f"Column full_name might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_picture VARCHAR")
        print("Successfully added profile_picture column to users table")
    except sqlite3.OperationalError as e:
        print(f"Column profile_picture might already exist: {e}")

    conn.commit()
    conn.close()
    print("Database upgrade for Google Auth complete.")

if __name__ == "__main__":
    upgrade_db()
