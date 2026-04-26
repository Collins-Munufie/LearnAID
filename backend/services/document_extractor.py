import fitz  # PyMuPDF
from pptx import Presentation
from docx import Document
import io
def extract_text_from_document(file_bytes: bytes, filename: str) -> str:
    """Extracts text from a locally uploaded PDF, DOCX, PPTX, or TXT file string."""
    ext = filename.lower().split('.')[-1]
    
    if ext == 'pdf':
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text.strip()
        
    elif ext == 'docx':
        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs])
        return text.strip()
        
    elif ext == 'pptx':
        prs = Presentation(io.BytesIO(file_bytes))
        text = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text.append(shape.text)
        return "\n".join(text).strip()
        
    elif ext == 'txt':
        return file_bytes.decode('utf-8', errors='ignore').strip()
        
    else:
        raise ValueError(f"Unsupported file format: {ext}")
