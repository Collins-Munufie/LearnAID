import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")

def upgrade_db():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN raw_content TEXT")
        print("Successfully added raw_content column")
    except sqlite3.OperationalError as e:
        print(f"Column raw_content might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN tutor_lesson TEXT")
        print("Successfully added tutor_lesson column")
    except sqlite3.OperationalError as e:
        print(f"Column tutor_lesson might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN selected_modules TEXT")
        print("Successfully added selected_modules column")
    except sqlite3.OperationalError as e:
        print(f"Column selected_modules might already exist: {e}")

    conn.commit()
    conn.close()
    print("Database upgrade complete.")

if __name__ == "__main__":
    upgrade_db()
