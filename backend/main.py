from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import api
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Workday Automation AI API",
    description="API for parsing resumes and mapping fields intelligently for Workday applications.",
    version="1.0.0"
)

# Allow Chrome Extension to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict to chrome-extension://<id>
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
