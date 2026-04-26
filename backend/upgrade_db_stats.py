import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")

def upgrade_db():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE user_stats ADD COLUMN quiz_attempts INTEGER DEFAULT 0")
        print("Successfully added quiz_attempts column")
    except sqlite3.OperationalError as e:
        print(f"Column quiz_attempts might already exist: {e}")

    conn.commit()
    conn.close()
    print("Database stats upgrade complete.")

if __name__ == "__main__":
    upgrade_db()
