import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test():
    b64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8A0s8g/9k='
    data_uri = f"data:image/jpeg;base64,{b64}"
    body = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract text"},
                    {"type": "image_url", "image_url": {"url": data_uri}}
                ]
            }
        ],
        "max_tokens": 512,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Authorization': f"Bearer {os.getenv('GROQ_API_KEY')}"},
            json=body
        )
        print(resp.status_code)
        print(resp.text)

asyncio.run(test())
