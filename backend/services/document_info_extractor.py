"""
Service to extract key information from documents for display alongside flashcards
"""
import json
import logging
from openai import AsyncOpenAI
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

api_key = os.getenv("GROQ_API_KEY")
client = AsyncOpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)

async def extract_document_info(text: str):
    """
    Extract key information from document text for preview display.
    Returns: dict with title, summary, key_concepts, and key_points
    """
    logger.info("Extracting document information...")
    
    prompt = f"""
    Analyze the following document and extract key information in JSON format.
    
    Return a JSON object with these exact keys:
    {{
        "title": "Document title or inferred title (max 100 chars)",
        "summary": "Executive summary in 3-4 sentences (max 300 chars)",
        "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
        "key_points": [
            "Important point 1",
            "Important point 2", 
            "Important point 3",
            "Important point 4"
        ],
        "word_count": estimated_word_count
    }}
    
    Be concise and academic. Focus on what a student needs to know.
    
    Document:
    {text[:3000]}
    """
    
    models_to_try = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "mixtral-8x7b-32768",
    ]
    
    for model_name in models_to_try:
        try:
            logger.info(f"Extracting info with model: {model_name}")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a JSON-only API. Always return valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=500
            )
            
            result_content = response.choices[0].message.content
            
            # Clean up JSON if wrapped in markdown
            clean_content = result_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
                
            data = json.loads(clean_content.strip())
            logger.info(f"Successfully extracted document info")
            return data
            
        except Exception as model_error:
            logger.warning(f"Model {model_name} failed for extraction: {str(model_error)}")
            continue
    
    # Fallback if all models fail
    logger.error("All models failed for extraction, returning minimal info")
    return {
        "title": "Document Information",
        "summary": "Unable to extract summary. Please review the document directly.",
        "key_concepts": [],
        "key_points": [],
        "word_count": len(text.split())
    }
