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
from database import engine
from routers import auth, flashcard_sets, user_stats

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Flashcard Generator Phase 3")

app.include_router(auth.router)
app.include_router(flashcard_sets.router)
app.include_router(user_stats.router)

class UrlRequest(BaseModel):
    url: str
    card_type: str = "Standard Q&A"

from typing import List

class SelectiveGenerationRequest(BaseModel):
    extracted_text: str
    modules: List[str]
    title: str = "Generated Content"

# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AI Flashcard Generator API is running!"}

@app.post("/api/generate-flashcards")
async def generate_flashcards_endpoint(file: UploadFile = File(...), card_type: str = Form("Standard Q&A")):
    allowed_exts = (".pdf", ".docx", ".pptx", ".txt")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF, DOCX, PPTX, or TXT.")

    content = await file.read()
    
    try:
        # Extract text from the document
        extracted_text = extract_text_from_document(content, file.filename)
        
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")
        
        # Generate flashcards and extract document info in parallel
        study_set_data = await generate_flashcards(extracted_text, card_type)
        document_info = await extract_document_info(extracted_text)
        
        study_set_data["document_info"] = document_info
        return study_set_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-from-url")
async def generate_from_url_endpoint(req: UrlRequest):
    url = req.url
    card_type = req.card_type
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    try:
        if "youtube.com" in url or "youtu.be" in url:
            extracted_text = extract_transcript(url)
        else:
            extracted_text = extract_text_from_url(url)
            
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the provided URL.")
            
        # Generate flashcards and extract document info
        study_set_data = await generate_flashcards(extracted_text, card_type)
        document_info = await extract_document_info(extracted_text)
        
        study_set_data["document_info"] = document_info
        return study_set_data
        
    except ValueError as val_e:
        raise HTTPException(status_code=400, detail=str(val_e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-document")
async def extract_document_endpoint(file: UploadFile = File(...)):
    allowed_exts = (".pdf", ".docx", ".pptx", ".txt")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Unsupported file format.")
    content = await file.read()
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
async def generate_selected_endpoint(req: SelectiveGenerationRequest):
    try:
        study_set_data = await generate_flashcards(req.extracted_text, "Standard", req.modules)
        document_info = await extract_document_info(req.extracted_text)
        study_set_data["document_info"] = document_info
        study_set_data["raw_content"] = req.extracted_text
        study_set_data["selected_modules"] = req.modules
        return study_set_data
    except Exception as e:
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

