import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")

def upgrade_db():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN true_false VARCHAR")
        print("Successfully added true_false column")
    except sqlite3.OperationalError as e:
        print(f"Column true_false might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN definitions VARCHAR")
        print("Successfully added definitions column")
    except sqlite3.OperationalError as e:
        print(f"Column definitions might already exist: {e}")

    conn.commit()
    conn.close()
    print("Database upgrade complete.")

if __name__ == "__main__":
    upgrade_db()
