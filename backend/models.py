from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    flashcard_sets = relationship("FlashcardSet", back_populates="owner")

class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String)
    answer = Column(String)
    is_mastered = Column(Boolean, default=False)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id"))

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")
