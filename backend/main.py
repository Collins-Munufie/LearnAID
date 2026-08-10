from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from services.document_extractor import extract_text_from_document
from services.ai_engine import generate_flashcards
from services.document_info_extractor import extract_document_info
from services.web_scraper import extract_text_from_url
from services.video_processor import extract_transcript

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

