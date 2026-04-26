import os
import base64
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Standardize to use the OpenAI SDK wrapper like ai_engine.py
client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)
def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Takes an image byte stream, encodes to Base64, and prompts the LLaMA 3.2 Vision Preview model
    to securely and precisely extract all explicit textual content within the image.
    """
    try:
        encoded_image = base64.b64encode(file_bytes).decode('utf-8')
        
        # We specify jpeg safely here since Llama Vision accepts simple base64 payload strings 
        # without heavily dictating strictly between png/jpeg parsing natively.
        image_url = f"data:image/jpeg;base64,{encoded_image}"
        
        logger.info("Initializing Groq Vision extraction for image...")

        completion = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": "You are a pure Optical Character Recognition system. Extract all text from this image precisely as written. Do not add any conversational filler. Just the extracted text. If it is a diagram, describe the keys and flowchart content."
                    },
                    {
                        "type": "image_url", 
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }],
            temperature=0,
            max_tokens=4000
        )
        
        extracted_text = completion.choices[0].message.content
        logger.info(f"Vision OCR Complete. Extracted {len(extracted_text)} characters.")
        return extracted_text.strip()
        
    except Exception as e:
        logger.error(f"Groq Vision OCR failed: {str(e)}")
        raise ValueError("Failed to extract text from image using Vision API.")

