import requests
from bs4 import BeautifulSoup

def extract_text_from_url(url: str) -> str:
    """Fetches a generic URL and extracts readable text."""
    try:
        # Using a standard browser user-agent to prevent basic 403 blocks
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.content, "html.parser")
        
        # Remove script, style, header, footer, and nav tags before extracting text
        for element in soup(["script", "style", "header", "footer", "nav"]):
            element.extract()
            
        text = soup.get_text(separator=' ')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from URL: {str(e)}")
