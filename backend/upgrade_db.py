import sqlite3
import sys

try:
    conn = sqlite3.connect('flashcards.db')
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE flashcards ADD COLUMN is_mastered BOOLEAN DEFAULT 0;")
    conn.commit()
    print("Successfully added is_mastered column!")
except Exception as e:
    print(f"Schema update error (maybe column already exists?): {e}")
    sys.exit(0) # Not an actual error if we re-run it
finally:
    conn.close()
