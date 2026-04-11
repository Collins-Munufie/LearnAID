from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/flashcard-sets", tags=["flashcard-sets"])

class FlashcardCreate(BaseModel):
    question: str
    answer: str

class FlashcardSetCreate(BaseModel):
    title: str
    flashcards: List[FlashcardCreate]

class FlashcardUpdateMastery(BaseModel):
    is_mastered: bool

@router.post("/")
def save_flashcard_set(
    set_data: FlashcardSetCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Create the set
    db_set = models.FlashcardSet(title=set_data.title, user_id=current_user.id)
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    
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
            "created_at": s.created_at,
            "flashcards": [{"id": fc.id, "question": fc.question, "answer": fc.answer, "is_mastered": fc.is_mastered} for fc in flashcards]
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
        
    flashcard.is_mastered = data.is_mastered
    db.commit()
    return {"message": "Mastery updated", "is_mastered": flashcard.is_mastered}
