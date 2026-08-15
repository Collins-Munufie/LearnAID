import os
import base64
import logging
import requests
import json

logger = logging.getLogger(__name__)

def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Takes an image byte stream, encodes to Base64, and prompts the Gemini Flash model
    to securely and precisely extract all explicit textual content within the image.
    """
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
            
        encoded_image = base64.b64encode(file_bytes).decode('utf-8')
        
        logger.info("Initializing Gemini Vision extraction for image...")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        
        system_instruction = {
            "parts": [{"text": "You are a pure Optical Character Recognition system. Extract all text from this image precisely as written. Do not add any conversational filler. Just the extracted text. If it is a diagram, describe the keys and flowchart content."}]
        }
        
        payload = {
            "systemInstruction": system_instruction,
            "contents": [{
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": encoded_image
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 4000
            }
        }
        
        res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
        
        if res.status_code != 200:
            raise Exception(f"Gemini API error: {res.text}")
            
        res_data = res.json()
        extracted_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
        
        logger.info(f"Vision OCR Complete. Extracted {len(extracted_text)} characters.")
        return extracted_text.strip()
        
    except Exception as e:
        logger.error(f"Vision OCR failed: {str(e)}")
        raise ValueError(f"Failed to extract text from image using Vision API: {str(e)}")
