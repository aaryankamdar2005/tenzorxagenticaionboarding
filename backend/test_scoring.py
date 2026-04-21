import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.services.db import connect_db, get_database
from app.services.decision_engine import compute_and_save_final_score
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    await connect_db()
    db = get_database()
    doc = await db['sessions'].find_one({"latest_extraction": {"$exists": True}}, sort=[('created_at', -1)])
    if not doc:
        print("No sessions found with extraction data.")
        return
        
    session_id = doc.get("session_id")
    print(f"Testing session: {session_id}")
    await compute_and_save_final_score(session_id)

if __name__ == "__main__":
    asyncio.run(main())
