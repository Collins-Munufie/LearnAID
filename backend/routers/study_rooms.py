from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
import string
import random
import datetime

from database import get_db
import models
from routers.auth import get_current_user

router = APIRouter(prefix="/api/study-rooms", tags=["study-rooms"])

class RoomCreate(BaseModel):
    name: str

class JoinRoomPayload(BaseModel):
    code: str

class LinkDeckPayload(BaseModel):
    set_id: int

def generate_room_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(chars) for _ in range(6))
        # check uniqueness
        exists = db.query(models.StudyRoom).filter(models.StudyRoom.code == code).first()
        if not exists:
            return code

@router.post("/")
def create_study_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Room name cannot be empty")
        
    code = generate_room_code(db)
    
    room = models.StudyRoom(
        name=payload.name,
        code=code,
        creator_id=current_user.id
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # Auto-join the creator as a member
    member = models.StudyRoomMember(
        room_id=room.id,
        user_id=current_user.id
    )
    db.add(member)
    db.commit()
    
    return {
        "id": room.id,
        "name": room.name,
        "code": room.code,
        "creator_id": room.creator_id,
        "created_at": room.created_at
    }

@router.post("/join")
def join_study_room(
    payload: JoinRoomPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    code = payload.code.strip().upper()
    room = db.query(models.StudyRoom).filter(models.StudyRoom.code == code).first()
    if not room:
        raise HTTPException(status_code=404, detail="Study room not found with this code")
        
    # Check if already a member
    existing = db.query(models.StudyRoomMember).filter(
        models.StudyRoomMember.room_id == room.id,
        models.StudyRoomMember.user_id == current_user.id
    ).first()
    
    if existing:
        return {"message": "You are already a member of this room", "room_id": room.id}
        
    member = models.StudyRoomMember(
        room_id=room.id,
        user_id=current_user.id
    )
    db.add(member)
    db.commit()
    
    return {"message": "Successfully joined the study room!", "room_id": room.id}

@router.get("/")
def get_user_study_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Query rooms where user is a member
    rooms = (
        db.query(models.StudyRoom)
        .join(models.StudyRoomMember, models.StudyRoomMember.room_id == models.StudyRoom.id)
        .filter(models.StudyRoomMember.user_id == current_user.id)
        .order_by(models.StudyRoom.created_at.desc())
        .all()
    )
    
    result = []
    for r in rooms:
        member_count = db.query(models.StudyRoomMember).filter(models.StudyRoomMember.room_id == r.id).count()
        deck_count = db.query(models.FlashcardSet).filter(models.FlashcardSet.room_id == r.id).count()
        result.append({
            "id": r.id,
            "name": r.name,
            "code": r.code,
            "creator_id": r.creator_id,
            "created_at": r.created_at,
            "members_count": member_count,
            "decks_count": deck_count
        })
    return result

@router.get("/{room_id}")
def get_study_room_details(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify membership
    membership = db.query(models.StudyRoomMember).filter(
        models.StudyRoomMember.room_id == room_id,
        models.StudyRoomMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this room")
        
    room = db.query(models.StudyRoom).filter(models.StudyRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Study room not found")
        
    # Get members details
    members_list = (
        db.query(models.User)
        .join(models.StudyRoomMember, models.StudyRoomMember.user_id == models.User.id)
        .filter(models.StudyRoomMember.room_id == room_id)
        .all()
    )
    
    # Get decks
    decks = (
        db.query(models.FlashcardSet)
        .filter(models.FlashcardSet.room_id == room_id)
        .order_by(models.FlashcardSet.last_accessed.desc())
        .all()
    )
    
    # Fetch counts for sets in bulk to optimize
    set_ids = [d.id for d in decks]
    counts_map = {}
    if set_ids:
        counts_query = (
            db.query(models.Flashcard.set_id, func.count(models.Flashcard.id))
            .filter(models.Flashcard.set_id.in_(set_ids))
            .group_by(models.Flashcard.set_id)
            .all()
        )
        counts_map = {row[0]: row[1] for row in counts_query}
        
    decks_list = []
    for d in decks:
        decks_list.append({
            "id": d.id,
            "title": d.title,
            "summary": d.summary,
            "flashcards_count": counts_map.get(d.id, 0),
            "creator_name": d.owner.full_name or d.owner.email.split('@')[0],
            "created_at": d.created_at
        })
        
    return {
        "id": room.id,
        "name": room.name,
        "code": room.code,
        "creator_id": room.creator_id,
        "created_at": room.created_at,
        "members": [
            {
                "id": m.id,
                "name": m.full_name or m.email.split('@')[0],
                "email": m.email,
                "profile_picture": m.profile_picture
            }
            for m in members_list
        ],
        "decks": decks_list
    }

@router.get("/{room_id}/leaderboard")
def get_room_leaderboard(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify membership
    membership = db.query(models.StudyRoomMember).filter(
        models.StudyRoomMember.room_id == room_id,
        models.StudyRoomMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this room")
        
    # Get room members
    members = (
        db.query(models.User)
        .join(models.StudyRoomMember, models.StudyRoomMember.user_id == models.User.id)
        .filter(models.StudyRoomMember.room_id == room_id)
        .all()
    )
    
    # Get room decks
    decks = db.query(models.FlashcardSet).filter(models.FlashcardSet.room_id == room_id).all()
    deck_ids = [d.id for d in decks]
    
    leaderboard = []
    
    if not deck_ids:
        # No decks shared yet, return all members with 0
        for m in members:
            leaderboard.append({
                "user_id": m.id,
                "name": m.full_name or m.email.split('@')[0],
                "profile_picture": m.profile_picture,
                "avg_accuracy": 0,
                "attempts_count": 0
            })
        return leaderboard
        
    # Query weekly mock exam accuracy for this room's decks
    one_week_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    
    stats_query = (
        db.query(
            models.MockExamAttempt.user_id,
            func.avg(models.MockExamAttempt.percentage).label("avg_percentage"),
            func.count(models.MockExamAttempt.id).label("attempts")
        )
        .filter(
            models.MockExamAttempt.set_id.in_(deck_ids),
            models.MockExamAttempt.is_submitted == True,
            models.MockExamAttempt.created_at >= one_week_ago
        )
        .group_by(models.MockExamAttempt.user_id)
        .all()
    )
    
    stats_map = {row[0]: (round(row[1]), row[2]) for row in stats_query}
    
    for m in members:
        avg_acc, attempts = stats_map.get(m.id, (0, 0))
        leaderboard.append({
            "user_id": m.id,
            "name": m.full_name or m.email.split('@')[0],
            "profile_picture": m.profile_picture,
            "avg_accuracy": avg_acc,
            "attempts_count": attempts
        })
        
    # Sort descending by accuracy, then by attempts, then by name
    leaderboard.sort(key=lambda x: (-x["avg_accuracy"], -x["attempts_count"], x["name"]))
    return leaderboard

@router.post("/{room_id}/decks")
def link_deck_to_room(
    room_id: int,
    payload: LinkDeckPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify membership
    membership = db.query(models.StudyRoomMember).filter(
        models.StudyRoomMember.room_id == room_id,
        models.StudyRoomMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this room")
        
    # Check if deck exists and belongs to the current user (you can only share your own decks)
    deck = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == payload.set_id,
        models.FlashcardSet.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(status_code=404, detail="Study set not found or not owned by you")
        
    deck.room_id = room_id
    db.commit()
    
    return {"message": "Study set shared successfully with the group!", "set_id": deck.id}

@router.delete("/{room_id}/leave")
def leave_study_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Check membership
    membership = db.query(models.StudyRoomMember).filter(
        models.StudyRoomMember.room_id == room_id,
        models.StudyRoomMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="You are not a member of this room")
        
    # If the user is the creator of the room, leaving deletes the room
    room = db.query(models.StudyRoom).filter(models.StudyRoom.id == room_id).first()
    if room and room.creator_id == current_user.id:
        db.delete(room)
        db.commit()
        return {"message": "As the room creator, the study room has been permanently deleted"}
        
    db.delete(membership)
    db.commit()
    return {"message": "You have left the study room"}
