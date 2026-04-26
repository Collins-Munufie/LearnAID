import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.vision_extractor import client

def test():
    print("Fetching available Groq models...")
    models = client.models.list()
    for m in models.data:
        print(m.id)

if __name__ == "__main__":
    test()
