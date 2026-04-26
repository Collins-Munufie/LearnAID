import os
import json
import logging
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Groq API client using OpenAI SDK compatibility layer
# Groq uses OpenAI-compatible API endpoints
api_key = os.getenv("GROQ_API_KEY")
logger.info(f"GROQ_API_KEY loaded: {'Yes' if api_key else 'No API Key'}")

client = AsyncOpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)

# Simple in-memory cache to prevent duplicate requests
import hashlib
TEXT_CACHE = {}

async def generate_flashcards(text: str, card_type: str = "Standard", selected_modules: list = None):
    """
    Calls Groq API to generate a complete study set from text.
    Implements caching to reduce identical calls.
    """
    # 1. Caching logic
    text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
    if text_hash in TEXT_CACHE:
        logger.info("Serving generated study set from memory CACHE.")
        return TEXT_CACHE[text_hash]

    logger.info(f"Generating flashcards with card_type: {card_type}, text length: {len(text)}")
    
    # Dynamically build the required JSON output based on selective processing
    modules = selected_modules or ["Notes", "Quiz", "Flashcards"]
    
    json_structure = "{\n"
    if "Notes" in modules:
        json_structure += '      "summary": "Detailed overall summary of the document",\n'
        json_structure += '      "key_points": ["Key point 1", "Key point 2"],\n'
    if "Flashcards" in modules:
        json_structure += '      "flashcards": [{"question": "Q?", "answer": "A", "difficulty": "easy"}],\n'
    if "Multiple Choice (Quiz)" in modules or "Quiz" in modules:
        json_structure += '      "quiz": [{"question": "Q?", "options": ["A", "B", "C", "D"], "correct_answer": "A"}],\n'
    if "Fill-in-the-Blank" in modules:
        json_structure += '      "fill_blanks": [{"sentence": "The cell ____.", "blank_word": "mitochondria"}],\n'
    if "Written Test" in modules:
        json_structure += '      "short_questions": ["Short Q1?", "Short Q2?"],\n'
    if "True/False" in modules or "True / False" in modules or "True/False (Quiz)" in modules:
        json_structure += '      "true_false": [{"statement": "Statement.", "answer": true, "explanation": "Why"}],\n'
    if "Podcast" in modules:
        pass # Podcast logic uses summary client-side
    
    if "Tutor Lesson" in modules:
        json_structure += '      "tutor_lesson": "A structured, readable 3-part lesson guide walking the student through the material as an expert tutor verbally communicating directly to them.",\n'
    
    json_structure += '      "definitions": [{"term": "Term", "definition": "Definition"}]\n    }'

    prompt = f"""
    You are an expert educational AI. 
    Read the following text and generate the requested study material modules.
    
    You must ONLY generate the JSON arrays requested below. Omit any arrays not present in the template.
    Do NOT hallucinate external information.
    
    Output strictly as a JSON object with the exact following structure:
    {json_structure}
    
    Ensure all arrays have at least 3-10 items if the text permits. Use standard true/false primitive booleans for 'answer'.
    Text: {text[:6000]}
    """
    
    # Try different Groq model names (in order of availability)
    # Note: mixtral-8x7b-32768 and llama-3.1-70b-versatile are decommissioned
    models_to_try = [
        "llama-3.3-70b-versatile",    # ✅ Currently available and working
        "llama-3.1-70b-versatile",     # Fallback
        "mixtral-8x7b-32768",          # Fallback
        "gemma2-9b-it",                # Fallback
        "llama-2-70b-chat",            # Fallback
    ]
    
    for model_name in models_to_try:
        try:
            logger.info(f"Calling Groq API with model: {model_name}...")
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a JSON-only API."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            logger.info(f"Groq API response received with model {model_name}: {response.choices[0].message.content[:100]}...")
            result_content = response.choices[0].message.content
            
            # Safely parse JSON even if the model wraps it in markdown blocks
            clean_content = result_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
                
            data = json.loads(clean_content.strip())
            
            # Save to Cache
            TEXT_CACHE[text_hash] = data
            
            logger.info(f"Successfully generated study set (flashcards, quiz, summary) with model {model_name}")
            return data
            
        except Exception as model_error:
            logger.warning(f"Model {model_name} failed: {str(model_error)}")
            continue  # Try next model
    
    # If all models fail
    logger.error(f"All Groq models failed. Last error will be reported.")
    raise Exception(f"Failed to generate flashcards with Groq API. Please check your API key and try again.")

async def chat_with_ai(messages: list, context_text: str):
    """
    Passes conversational history and source context to the LLM to act as a study tutor.
    """
    system_prompt = f"You are an expert educational AI tutor. Base all your answers strictly on the provided Source Material. If the user asks something outside the scope, politely redirect them to the material.\n\nSource Material:\n{context_text[:6000]}"
    
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        api_messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
        
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=api_messages,
            temperature=0.5
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Chat API failed: {str(e)}")
        raise Exception("Failed to generate AI response.")

async def grade_written_test(questions: list, user_answers: list, context_text: str):
    """
    Uses LLM to grade a written test, returning strict JSON structure with scores and feedback.
    """
    system_prompt = f"""
    You are an expert AI grader. 
    Evaluate the student's written answers to the following questions based strictly on the source material.
    
    Source Material: {context_text[:5000]}
    
    Output strictly as a JSON object with this exact structure:
    {{
       "score": 85,
       "evaluations": [
           {{
              "question": "The question asked...",
              "model_answer": "The ideal correct answer...",
              "user_answer": "What the user wrote...",
              "feedback": "Direct advice on how they can improve..."
           }}
       ]
    }}
    Do NOT output any conversational text outside of the JSON block.
    """
    
    prompt = f"Questions: {json.dumps(questions)}\nStudent Answers: {json.dumps(user_answers)}"
    
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        result_content = response.choices[0].message.content.strip()
        if result_content.startswith("```json"): result_content = result_content[7:]
        if result_content.startswith("```"): result_content = result_content[3:]
        if result_content.endswith("```"): result_content = result_content[:-3]
            
        return json.loads(result_content.strip())
    except Exception as e:
        logger.error(f"Grade API failed: {str(e)}")
        raise Exception("Failed to evaluate test answers.")


