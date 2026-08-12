from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
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
    podcast_script: str = ""
    raw_content: str = ""
    selected_modules: List[str] = []

class FlashcardUpdateMastery(BaseModel):
    mastery_level: int

def _json_list(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        return []

def serialize_flashcard_set(s: models.FlashcardSet):
    return {
        "id": s.id,
        "title": s.title,
        "summary": s.summary or "",
        "key_points": _json_list(s.key_points),
        "quiz": _json_list(s.quiz),
        "fill_blanks": _json_list(s.fill_blanks),
        "short_questions": _json_list(s.short_questions),
        "true_false": _json_list(s.true_false),
        "definitions": _json_list(s.definitions),
        "tutor_lesson": s.tutor_lesson if s.tutor_lesson else None,
        "podcast_script": s.podcast_script if s.podcast_script else None,
        "raw_content": s.raw_content if s.raw_content else "",
        "selected_modules": _json_list(s.selected_modules),
        "created_at": s.created_at,
        "last_accessed": s.last_accessed,
        "flashcards": [
            {
                "id": fc.id,
                "question": fc.question,
                "answer": fc.answer,
                "mastery_level": fc.mastery_level,
                "due": fc.due,
                "stability": fc.stability,
                "difficulty": fc.difficulty,
                "reps": fc.reps,
                "state": fc.state
            }
            for fc in s.flashcards
        ],
    }

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
        podcast_script=set_data.podcast_script,
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
    from sqlalchemy.orm import defer
    from sqlalchemy import func

    sets = (
        db.query(models.FlashcardSet)
        .options(
            defer(models.FlashcardSet.raw_content),
            defer(models.FlashcardSet.tutor_lesson),
            defer(models.FlashcardSet.podcast_script)
        )
        .filter(models.FlashcardSet.user_id == current_user.id)
        .order_by(models.FlashcardSet.last_accessed.desc(), models.FlashcardSet.created_at.desc())
        .all()
    )

    if not sets:
        return []

    set_ids = [s.id for s in sets]

    # Pre-fetch counts in exactly two bulk aggregation queries to avoid N+1 database queries
    total_counts = dict(
        db.query(models.Flashcard.set_id, func.count(models.Flashcard.id))
        .filter(models.Flashcard.set_id.in_(set_ids))
        .group_by(models.Flashcard.set_id)
        .all()
    )
    
    mastered_counts = dict(
        db.query(models.Flashcard.set_id, func.count(models.Flashcard.id))
        .filter(models.Flashcard.set_id.in_(set_ids), models.Flashcard.mastery_level == 3)
        .group_by(models.Flashcard.set_id)
        .all()
    )

    # Pre-check existence of heavy deferred columns in SQL to prevent implicit N+1 lazy loading
    presence_info = {
        row[0]: {
            "has_podcast": bool(row[1]),
            "has_tutor": bool(row[2]),
            "has_raw_content": bool(row[3])
        }
        for row in db.query(
            models.FlashcardSet.id,
            models.FlashcardSet.podcast_script != None,
            models.FlashcardSet.tutor_lesson != None,
            models.FlashcardSet.raw_content != None
        )
        .filter(models.FlashcardSet.id.in_(set_ids))
        .all()
    }

    result = []
    for s in sets:
        fc_count = total_counts.get(s.id, 0)
        mastered_count = mastered_counts.get(s.id, 0)
        p_info = presence_info.get(s.id, {"has_podcast": False, "has_tutor": False, "has_raw_content": False})
        
        gen_modes = []
        if s.summary: gen_modes.append("Notes")
        if fc_count > 0: gen_modes.append("Flashcards")
        if p_info["has_podcast"]: gen_modes.append("Podcast")
        if s.quiz: gen_modes.append("Quiz")
        if s.fill_blanks: gen_modes.append("Fill-Blanks")
        if s.short_questions: gen_modes.append("Written")
        if s.true_false: gen_modes.append("True/False")
        if p_info["has_tutor"]: gen_modes.append("Tutor")
        if s.definitions: gen_modes.append("Definitions")
        if p_info["has_raw_content"]: gen_modes.append("Content")
        
        result.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at,
            "last_accessed": s.last_accessed,
            "flashcards_count": fc_count,
            "mastered_count": mastered_count,
            "generated_modes": gen_modes
        })
    return result

@router.get("/{set_id}")
def get_user_flashcard_set(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    flashcard_set = (
        db.query(models.FlashcardSet)
        .options(selectinload(models.FlashcardSet.flashcards))
        .filter(models.FlashcardSet.id == set_id)
        .first()
    )
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Study set not found")

    if flashcard_set.user_id != current_user.id:
        is_member = False
        if flashcard_set.room_id is not None:
            is_member = db.query(models.StudyRoomMember).filter(
                models.StudyRoomMember.room_id == flashcard_set.room_id,
                models.StudyRoomMember.user_id == current_user.id
            ).first() is not None
        if not is_member:
            raise HTTPException(status_code=403, detail="Not authorized to access this study set")

    return serialize_flashcard_set(flashcard_set)

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
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Study set not found")
        
    is_authorized = (flashcard_set.user_id == current_user.id)
    if not is_authorized and flashcard_set.room_id is not None:
        is_authorized = db.query(models.StudyRoomMember).filter(
            models.StudyRoomMember.room_id == flashcard_set.room_id,
            models.StudyRoomMember.user_id == current_user.id
        ).first() is not None
        
    if not is_authorized:
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
    flashcard_set = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == set_id).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
        
    is_authorized = (flashcard_set.user_id == current_user.id)
    if not is_authorized and flashcard_set.room_id is not None:
        is_authorized = db.query(models.StudyRoomMember).filter(
            models.StudyRoomMember.room_id == flashcard_set.room_id,
            models.StudyRoomMember.user_id == current_user.id
        ).first() is not None
        
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized")
        
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
