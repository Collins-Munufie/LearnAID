import logging
from services.ai_engine import _execute_with_fallback

logger = logging.getLogger(__name__)

async def socratic_chat(question: str, correct_answer: str, messages: list, context_text: str):
    """
    Passes conversational history and context to the LLM to act as a Socratic tutor.
    """
    system_prompt = f"""You are Cognify's Socratic AI Tutor. 
    
Your goal is to help the student figure out the correct answer to a specific question THEY are struggling with.

----------------------------------------
QUESTION THE STUDENT IS TRYING TO ANSWER:
{question}

CORRECT ANSWER:
{correct_answer}
----------------------------------------

----------------------------------------
CORE SOCRATIC RULES:
----------------------------------------
1. NEVER GIVE THE DIRECT ANSWER. Do not say "{correct_answer}" or anything that immediately gives it away.
2. Guide them step-by-step. Ask guiding questions, provide hints, or point out contradictions in their logic.
3. Be encouraging and supportive.
4. Base your hints on the Source Material provided below.
5. If the student finally gives the correct answer, congratulate them warmly and briefly explain why it's correct to solidify their learning.

----------------------------------------
SOURCE MATERIAL:
{context_text[:6000]}
----------------------------------------

Always behave like a friendly, patient 1-on-1 tutor. Keep your responses relatively short and focused on the next small logical step.
"""

    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        api_messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
        
    try:
        response_text = await _execute_with_fallback(api_messages, temperature=0.6)
        return response_text
    except Exception as e:
        logger.error(f"Socratic Tutor API failed: {str(e)}")
        raise Exception("Failed to generate Socratic AI response.")
