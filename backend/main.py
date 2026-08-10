from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from services.document_extractor import extract_text_from_document
from services.ai_engine import generate_flashcards
from services.document_info_extractor import extract_document_info
from services.web_scraper import extract_text_from_url
from services.video_processor import extract_transcript
from services.vision_extractor import extract_text_from_image
from services.audio_extractor import extract_audio_transcript

import models
from database import engine, upgrade_db_schema
from routers import auth, flashcard_sets, user_stats, mock_exams, image_chats

# Create database tables
models.Base.metadata.create_all(bind=engine)
upgrade_db_schema(engine)


app = FastAPI(title="AI Flashcard Generator Phase 3")

app.include_router(auth.router)
app.include_router(flashcard_sets.router)
app.include_router(user_stats.router)
app.include_router(mock_exams.router)
app.include_router(image_chats.router)


class UrlRequest(BaseModel):
    url: str
    card_type: str = "Standard Q&A"

from typing import List

class SelectiveGenerationRequest(BaseModel):
    extracted_text: str
    modules: List[str]
    title: str = "Generated Content"

class FSRSReviewRequest(BaseModel):
    rating: int # 1: Again, 2: Hard, 3: Good, 4: Easy

# Allow requests from the React frontend (CORS configuration)
# Note: Wildcard "*" cannot be used with allow_credentials=True.
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

# Default local development origins
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Merge unique origins
origins = list(set(default_origins + allowed_origins))

# Regex to allow all localhost/127.0.0.1 ports and Vercel/GitHub deployments with anchored boundaries
allow_origin_regex = r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https?://[a-zA-Z0-9-]+\.vercel\.app|https?://[a-zA-Z0-9-]+\.github\.io)$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AI Flashcard Generator API is running!"}

from database import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
from typing import Optional

async def read_file_safe(file: UploadFile, max_size: int = 10 * 1024 * 1024) -> bytes:
    content_length = file.headers.get("content-length")
    if content_length and int(content_length) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    
    content = bytearray()
    chunk_size = 8192
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    return bytes(content)

@app.post("/api/generate-flashcards")
async def generate_flashcards_endpoint(
    file: UploadFile = File(...), 
    card_type: str = Form("Standard Q&A"),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db)
):
    allowed_exts = (".pdf", ".docx", ".pptx", ".txt")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF, DOCX, PPTX, or TXT.")

    user_stats = None
    if current_user:
        user_stats = db.query(models.UserStats).filter(models.UserStats.user_id == current_user.id).first()
        if not user_stats:
            user_stats = models.UserStats(user_id=current_user.id)
            db.add(user_stats)
        user_stats.processing_status = "Processing"
        db.commit()

    content = await read_file_safe(file)
    
    try:
        # Extract text from the document
        extracted_text = extract_text_from_document(content, file.filename)
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")
        
        # Generate flashcards (which now includes document info)
        study_set_data = await generate_flashcards(extracted_text, card_type)
        
        if "document_info" not in study_set_data:
            study_set_data["document_info"] = await extract_document_info(extracted_text)
        
        if user_stats:
            user_stats.success_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
            
        return study_set_data
        
    except Exception as e:
        if user_stats:
            user_stats.failed_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-from-url")
async def generate_from_url_endpoint(
    req: UrlRequest,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db)
):
    url = req.url
    card_type = req.card_type
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    user_stats = None
    if current_user:
        user_stats = db.query(models.UserStats).filter(models.UserStats.user_id == current_user.id).first()
        if not user_stats:
            user_stats = models.UserStats(user_id=current_user.id)
            db.add(user_stats)
        user_stats.processing_status = "Processing"
        db.commit()

    try:
        if "youtube.com" in url or "youtu.be" in url:
            extracted_text = extract_transcript(url)
        else:
            extracted_text = extract_text_from_url(url)
            
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the provided URL.")
            
        # Generate flashcards (which now includes document info)
        study_set_data = await generate_flashcards(extracted_text, card_type)
        
        if "document_info" not in study_set_data:
            study_set_data["document_info"] = await extract_document_info(extracted_text)
        
        if user_stats:
            user_stats.success_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
            
        return study_set_data
        
    except ValueError as val_e:
        if user_stats:
            user_stats.failed_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
        raise HTTPException(status_code=400, detail=str(val_e))
    except Exception as e:
        if user_stats:
            user_stats.failed_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-document")
async def extract_document_endpoint(file: UploadFile = File(...)):
    allowed_exts = (".pdf", ".docx", ".pptx", ".txt")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported file format.")
    content = await read_file_safe(file)
    try:
        extracted_text = extract_text_from_document(content, file.filename)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text.")
        return {"extracted_text": extracted_text[:15000], "title": file.filename.rsplit('.', 1)[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-url")
async def extract_url_endpoint(req: UrlRequest):
    url = req.url
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    try:
        if "youtube.com" in url or "youtu.be" in url:
            extracted_text = extract_transcript(url)
        else:
            extracted_text = extract_text_from_url(url)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text.")
        return {"extracted_text": extracted_text[:15000], "title": "Web/Video Content"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-ocr")
async def extract_ocr_endpoint(file: UploadFile = File(...)):
    allowed_exts = (".png", ".jpg", ".jpeg", ".webp")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported image format.")
    content = await read_file_safe(file)
    try:
        extracted_text = extract_text_from_image(content)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from image.")
        return {"extracted_text": extracted_text[:15000], "title": "Handwritten Notes"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-audio")
async def extract_audio_endpoint(file: UploadFile = File(...)):
    allowed_exts = (".webm", ".wav", ".mp3", ".m4a", ".ogg")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported audio format.")
    # Allow up to 25MB for audio
    content = await read_file_safe(file, max_size=25 * 1024 * 1024)
    try:
        extracted_text = extract_audio_transcript(content, file.filename)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not transcribe audio.")
        return {"extracted_text": extracted_text[:15000], "title": "Live Lecture Transcription"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-selected")
async def generate_selected_endpoint(
    req: SelectiveGenerationRequest,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db)
):
    user_stats = None
    if current_user:
        user_stats = db.query(models.UserStats).filter(models.UserStats.user_id == current_user.id).first()
        if not user_stats:
            user_stats = models.UserStats(user_id=current_user.id)
            db.add(user_stats)
        user_stats.processing_status = "Processing"
        db.commit()

    try:
        study_set_data = await generate_flashcards(req.extracted_text, "Standard", req.modules)
        if "document_info" not in study_set_data:
            study_set_data["document_info"] = await extract_document_info(req.extracted_text)
        study_set_data["raw_content"] = req.extracted_text
        study_set_data["selected_modules"] = req.modules
        
        if user_stats:
            user_stats.success_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
            
        return study_set_data
    except Exception as e:
        if user_stats:
            user_stats.failed_generations += 1
            user_stats.processing_status = "Idle"
            db.commit()
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    messages: list
    context_text: str

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        from services.ai_engine import chat_with_ai
        response_text = await chat_with_ai(req.messages, req.context_text)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SocraticTutorRequest(BaseModel):
    question: str
    correct_answer: str
    messages: list
    context_text: str

@app.post("/api/socratic-tutor")
async def socratic_tutor_endpoint(req: SocraticTutorRequest):
    try:
        from services.socratic_tutor import socratic_chat
        response_text = await socratic_chat(req.question, req.correct_answer, req.messages, req.context_text)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GradeRequest(BaseModel):
    questions: list
    user_answers: list
    context_text: str

@app.post("/api/grade-test")
async def grade_test_endpoint(req: GradeRequest):
    try:
        from services.ai_engine import grade_written_test
        grading_result = await grade_written_test(req.questions, req.user_answers, req.context_text)
        return grading_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/flashcards/{flashcard_id}/review")
def review_flashcard(flashcard_id: int, req: FSRSReviewRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    card = db.query(models.Flashcard).filter(models.Flashcard.id == flashcard_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
        
    # verify ownership
    if card.flashcard_set.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    current_state = {
        "due": card.due,
        "stability": card.stability,
        "difficulty": card.difficulty,
        "elapsed_days": card.elapsed_days,
        "scheduled_days": card.scheduled_days,
        "reps": card.reps,
        "lapses": card.lapses,
        "state": card.state,
        "last_review": card.last_review
    }
    
    from services.fsrs_service import calculate_next_review
    next_state = calculate_next_review(current_state, req.rating)
    
    card.due = next_state['due']
    card.stability = next_state['stability']
    card.difficulty = next_state['difficulty']
    card.elapsed_days = next_state['elapsed_days']
    card.scheduled_days = next_state['scheduled_days']
    card.reps = next_state['reps']
    card.lapses = next_state['lapses']
    card.state = next_state['state']
    card.last_review = next_state['last_review']
    
    db.commit()
    db.refresh(card)
    
    return next_state


@app.get("/api/analytics/memory")
def get_memory_analytics(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    sets = db.query(models.FlashcardSet).filter(models.FlashcardSet.user_id == current_user.id).all()
    set_ids = [s.id for s in sets]
    
    if not set_ids:
        return {"total_cards": 0, "active_cards": 0, "cards_due_today": 0, "average_stability": 0, "forgetting_curve": []}
        
    import datetime
    flashcards = db.query(models.Flashcard).filter(models.Flashcard.set_id.in_(set_ids)).all()
    
    total_cards = len(flashcards)
    cards_due_today = sum(1 for f in flashcards if f.due <= datetime.datetime.utcnow())
    
    active_cards = [f for f in flashcards if f.state > 0]
    avg_stability = sum(f.stability for f in active_cards) / len(active_cards) if active_cards else 0
    
    curve = []
    if avg_stability > 0:
        for day in range(0, 31, 2):
            retention = (1 + day / (9 * avg_stability)) ** -1
            curve.append({"day": day, "retention": round(retention * 100, 2)})
            
    return {
        "total_cards": total_cards,
        "active_cards": len(active_cards),
        "cards_due_today": cards_due_today,
        "average_stability": round(avg_stability, 2),
        "forgetting_curve": curve
    }
