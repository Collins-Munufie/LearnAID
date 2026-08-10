import os
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

def extract_audio_transcript(file_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Takes an audio byte stream and prompts the Groq Whisper model
    (whisper-large-v3-turbo) to securely and precisely transcribe the speech.
    """
    try:
        logger.info(f"Initializing Groq Audio extraction for {filename}...")
        
        # Pass the bytes as a tuple with filename so the OpenAI SDK can guess MIME type
        audio_file = (filename, file_bytes)
        
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=audio_file,
            response_format="text"
        )
        
        # response_format="text" returns a string directly
        extracted_text = transcription if isinstance(transcription, str) else transcription.text
        logger.info(f"Audio Transcription Complete. Extracted {len(extracted_text)} characters.")
        return extracted_text.strip()
        
    except Exception as e:
        logger.error(f"Groq Audio transcription failed: {str(e)}")
        raise ValueError("Failed to transcribe audio.")
