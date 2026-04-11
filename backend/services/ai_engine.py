import os
import json
from openai import AsyncOpenAI

# Set your OPENAI_API_KEY environment variable.
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", "dummy_key"))

async def generate_flashcards(text: str, card_type: str = "Standard Q&A"):
    """
    Calls OpenAI to generate flashcards from text.
    """
    prompt = f"""
    You are an expert educational AI. 
    Read the following text and generate comprehensive flashcards to help a student study.
    IMPORTANT: The user has requested the flashcards to be in the following style: {card_type}.
    Adapt the 'question' and 'answer' fields to match this style (e.g., if True/False, the question is a statement and the answer is True/False. If Fill-in-the-blank, use ____ in the question).
    Each flashcard should have a 'question' and an 'answer'.
    
    Output strictly as a JSON object with a single key 'flashcards', which contains an array of dictionaries representing the flashcards.
    Example: {{"flashcards": [{{"question": "Q1", "answer": "A1"}}]}}
    
    Text: {text[:4000]} # Limit text for this phase demo
    """
    
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a JSON-only API."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        result_content = response.choices[0].message.content
        data = json.loads(result_content)
        return data.get("flashcards", [])
        
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        # fallback demo cards if API fails (e.g. no key)
        preview = text[:100].strip() + "..." if len(text) > 100 else text.strip()
        if not preview:
            preview = "No text could be extracted."
            
        return [
            {"question": "Extracted Text Preview (Document processed successfully!)", "answer": preview},
            {"question": "Missing API Key", "answer": "Please set your OPENAI_API_KEY environment variable to generate real flashcards for this material."},
            {"question": "Extracted Length", "answer": f"Successfully parsed {len(text)} characters from the source."}
        ]
