import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flashcards.db")

def upgrade_db():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # FlashcardSet updates
    try:
        cursor.execute("ALTER TABLE flashcard_sets ADD COLUMN last_accessed DATETIME")
        print("Successfully added last_accessed column")
    except sqlite3.OperationalError as e:
        print(f"Column might already exist: {e}")

    cursor.execute("UPDATE flashcard_sets SET last_accessed = created_at WHERE last_accessed IS NULL")

    # UserStats updates
    try:
        cursor.execute("ALTER TABLE user_stats ADD COLUMN quiz_accuracy INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE user_stats ADD COLUMN true_false_accuracy INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE user_stats ADD COLUMN fill_blank_accuracy INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE user_stats ADD COLUMN total_flashcards_studied INTEGER DEFAULT 0")
        print("Successfully added accuracy columns")
    except sqlite3.OperationalError as e:
        print(f"Stats Columns might already exist: {e}")

    conn.commit()
    conn.close()
    print("Dashboard Database upgrade complete.")

if __name__ == "__main__":
    upgrade_db()
