from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from services.document_extractor import extract_text_from_document
from services.ai_engine import generate_flashcards
from services.web_scraper import extract_text_from_url
from services.video_processor import extract_transcript

import models
from database import engine
from routers import auth, flashcard_sets

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Flashcard Generator Phase 3")

app.include_router(auth.router)
app.include_router(flashcard_sets.router)

class UrlRequest(BaseModel):
    url: str
    card_type: str = "Standard Q&A"

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
        
        # Call OpenAI to generate flashcards
        # (This could take time, but we await it directly for simplicity now)
        flashcards = await generate_flashcards(extracted_text, card_type)
        
        return {"flashcards": flashcards}
        
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
            
        flashcards = await generate_flashcards(extracted_text, card_type)
        return {"flashcards": flashcards}
        
    except ValueError as val_e:
        raise HTTPException(status_code=400, detail=str(val_e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
