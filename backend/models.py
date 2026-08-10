from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Boolean, Float
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

    flashcard_sets = relationship("FlashcardSet", back_populates="owner", cascade="all, delete-orphan")
    stats = relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan")

class UserStats(Base):
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    current_streak = Column(Integer, default=0)
    last_study_date = Column(DateTime, nullable=True)
    quiz_attempts = Column(Integer, default=0)
    quiz_accuracy = Column(Integer, default=0)
    true_false_accuracy = Column(Integer, default=0)
    fill_blank_accuracy = Column(Integer, default=0)
    total_flashcards_studied = Column(Integer, default=0)
    
    # New Columns for QA & Dashboard Analytics Upgrade
    time_spent_studying = Column(Integer, default=0) # in seconds
    success_generations = Column(Integer, default=0)
    failed_generations = Column(Integer, default=0)
    processing_status = Column(String, default="Idle")

    user = relationship("User", back_populates="stats")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User")

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
    podcast_script = Column(String, nullable=True) # Podcast string
    selected_modules = Column(String, nullable=True) # Selected strings
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    owner = relationship("User", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    answer = Column(String)
    mastery_level = Column(Integer, default=0) # Legacy
    set_id = Column(Integer, ForeignKey("flashcard_sets.id", ondelete="CASCADE"), index=True)

    # FSRS Data
    due = Column(DateTime, default=datetime.datetime.utcnow)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    state = Column(Integer, default=0) # 0: New, 1: Learning, 2: Review, 3: Relearning
    last_review = Column(DateTime, nullable=True)

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")

class MockExamAttempt(Base):
    __tablename__ = "mock_exam_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=False)
    difficulty = Column(String, nullable=False) # 'Easy', 'Medium', 'Hard', 'Exam Level'
    time_limit = Column(Integer, nullable=False) # in minutes
    time_taken = Column(Integer, nullable=True) # in seconds
    score = Column(Integer, nullable=True) # out of 30
    percentage = Column(Integer, nullable=True) # 0-100
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_submitted = Column(Boolean, default=False)
    
    questions = Column(String, nullable=False) # JSON list of 30 questions
    user_answers = Column(String, nullable=True) # JSON dictionary of user answers
    analysis = Column(String, nullable=True) # JSON strength/weakness analysis


class ImageChatSession(Base):
    __tablename__ = "image_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=False)
    images = Column(String, nullable=False) # JSON list of base64 images
    messages = Column(String, nullable=False) # JSON list of messages
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User")

