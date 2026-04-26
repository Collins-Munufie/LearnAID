from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/flashcard-sets", tags=["flashcard-sets"])

import json

class FlashcardCreate(BaseModel):
    question: str
    answer: str

class FlashcardSetCreate(BaseModel):
    title: str
    flashcards: List[FlashcardCreate]
    summary: str = ""
    key_points: List[str] = []
    quiz: List[dict] = []
    fill_blanks: List[dict] = []
    short_questions: List[str] = []
    true_false: List[dict] = []
    definitions: List[dict] = []
    tutor_lesson: str = ""
    raw_content: str = ""
    selected_modules: List[str] = []

class FlashcardUpdateMastery(BaseModel):
    mastery_level: int

@router.post("/")
def save_flashcard_set(
    set_data: FlashcardSetCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Create the set
    db_set = models.FlashcardSet(
        title=set_data.title, 
        user_id=current_user.id,
        summary=set_data.summary,
        key_points=json.dumps(set_data.key_points),
        quiz=json.dumps(set_data.quiz),
        fill_blanks=json.dumps(set_data.fill_blanks),
        short_questions=json.dumps(set_data.short_questions),
        true_false=json.dumps(set_data.true_false),
        definitions=json.dumps(set_data.definitions),
        tutor_lesson=set_data.tutor_lesson,
        raw_content=set_data.raw_content,
        selected_modules=json.dumps(set_data.selected_modules)
    )
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    
    # Update user stats
    user_stats = db.query(models.UserStats).filter(models.UserStats.user_id == current_user.id).first()
    if not user_stats:
        user_stats = models.UserStats(user_id=current_user.id)
        db.add(user_stats)
    db.commit()
    
    # Create the flashcards
    for fc in set_data.flashcards:
        db_fc = models.Flashcard(
            question=fc.question,
            answer=fc.answer,
            set_id=db_set.id
        )
        db.add(db_fc)
        
    db.commit()
    
    return {"message": "Flashcard set saved successfully!", "id": db_set.id}

@router.get("/")
def get_user_flashcard_sets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sets = db.query(models.FlashcardSet).filter(models.FlashcardSet.user_id == current_user.id).all()
    
    result = []
    for s in sets:
        flashcards = db.query(models.Flashcard).filter(models.Flashcard.set_id == s.id).all()
        result.append({
            "id": s.id,
            "title": s.title,
            "summary": s.summary or "",
            "key_points": json.loads(s.key_points) if s.key_points else [],
            "quiz": json.loads(s.quiz) if s.quiz else [],
            "fill_blanks": json.loads(s.fill_blanks) if s.fill_blanks else [],
            "short_questions": json.loads(s.short_questions) if s.short_questions else [],
            "true_false": json.loads(s.true_false) if s.true_false else [],
            "definitions": json.loads(s.definitions) if s.definitions else [],
            "tutor_lesson": s.tutor_lesson if s.tutor_lesson else None,
            "raw_content": s.raw_content if s.raw_content else "",
            "selected_modules": json.loads(s.selected_modules) if s.selected_modules else [],
            "created_at": s.created_at,
            "last_accessed": s.last_accessed,
            "flashcards": [{"id": fc.id, "question": fc.question, "answer": fc.answer, "mastery_level": fc.mastery_level} for fc in flashcards]
        })
    return result

@router.put("/flashcards/{flashcard_id}/mastery")
def update_flashcard_mastery(
    flashcard_id: int,
    data: FlashcardUpdateMastery,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    flashcard = db.query(models.Flashcard).filter(models.Flashcard.id == flashcard_id).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
        
    flashcard_set = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == flashcard.set_id).first()
    if not flashcard_set or flashcard_set.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    flashcard.mastery_level = data.mastery_level
    db.commit()
    return {"message": "Mastery updated", "mastery_level": flashcard.mastery_level}

import datetime

@router.put("/{set_id}/access")
def update_last_accessed(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    flashcard_set = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == set_id, models.FlashcardSet.user_id == current_user.id).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
        
    flashcard_set.last_accessed = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Access timestamp updated"}

class TitleUpdate(BaseModel):
    title: str

@router.put("/{set_id}/title")
def update_set_title(
    set_id: int,
    data: TitleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    flashcard_set = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == set_id, models.FlashcardSet.user_id == current_user.id).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
        
    flashcard_set.title = data.title
    db.commit()
    return {"message": "Title updated successfully", "title": flashcard_set.title}

@router.delete("/{set_id}")
def delete_flashcard_set(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    flashcard_set = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == set_id, models.FlashcardSet.user_id == current_user.id).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
        
    db.delete(flashcard_set)
    db.commit()
    return {"message": "Study Set permanently deleted"}
