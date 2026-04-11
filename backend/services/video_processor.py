from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs

def extract_video_id(url: str) -> str:
    """Extracts the YouTube video ID from a URL."""
    try:
        parsed_url = urlparse(url)
        if parsed_url.hostname in ['www.youtube.com', 'youtube.com', 'm.youtube.com']:
            return parse_qs(parsed_url.query)['v'][0]
        elif parsed_url.hostname in ['youtu.be']:
            return parsed_url.path[1:]
    except Exception:
        pass
    return None

def extract_transcript(url: str) -> str:
    """Extracts transcript from a YouTube video URL."""
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL. Please provide a valid video link.")
        
    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list_obj = ytt_api.list(video_id)
        
        # Try to find english, otherwise fallback to any transcript
        try:
            transcript_obj = transcript_list_obj.find_transcript(['en', 'en-US', 'en-GB'])
        except Exception:
            # fallback to first available
            transcript_obj = next(iter(transcript_list_obj))
            
        transcript_data = transcript_obj.fetch()
        if hasattr(transcript_data[0], 'text'):
            transcript = " ".join([t.text for t in transcript_data])
        else:
            transcript = " ".join([t['text'] for t in transcript_data])
        return transcript
    except Exception as e:
        raise Exception(f"Failed to extract video transcript: {str(e)}\nMake sure the video has closed captions enabled.")
