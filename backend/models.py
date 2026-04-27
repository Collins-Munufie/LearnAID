from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)

    flashcard_sets = relationship("FlashcardSet", back_populates="owner")
    stats = relationship("UserStats", back_populates="user", uselist=False)

class UserStats(Base):
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    current_streak = Column(Integer, default=0)
    last_study_date = Column(DateTime, nullable=True)
    quiz_attempts = Column(Integer, default=0)
    quiz_accuracy = Column(Integer, default=0)
    true_false_accuracy = Column(Integer, default=0)
    fill_blank_accuracy = Column(Integer, default=0)
    total_flashcards_studied = Column(Integer, default=0)

    user = relationship("User", back_populates="stats")

class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    
    summary = Column(String, nullable=True)
    key_points = Column(String, nullable=True) # JSON array
    quiz = Column(String, nullable=True) # JSON array
    fill_blanks = Column(String, nullable=True) # JSON array
    short_questions = Column(String, nullable=True) # JSON array
    true_false = Column(String, nullable=True) # JSON array
    definitions = Column(String, nullable=True) # JSON array
    tutor_lesson = Column(String, nullable=True) # JSON array/text
    raw_content = Column(String, nullable=True) # Raw extracted context
    selected_modules = Column(String, nullable=True) # Selected strings
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    answer = Column(String)
    mastery_level = Column(Integer, default=0) # 0:Unfamiliar, 1:Learning, 2:Familiar, 3:Mastered
    set_id = Column(Integer, ForeignKey("flashcard_sets.id"))

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")
