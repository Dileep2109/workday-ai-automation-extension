from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import ResumeData, BatchFieldMappingRequest, BatchFieldMappingResponse, AnswerGenerationRequest, AnswerGenerationResponse
from services.parser_service import extract_text_from_file
from services.ai_service import parse_resume_to_json, map_fields, generate_answer

router = APIRouter()

@router.post("/parse-resume", response_model=ResumeData)
async def parse_resume_endpoint(file: UploadFile = File(...)):
    """
    Accepts a PDF or DOCX file, extracts text, and uses AI to parse it into structured JSON.
    """
    if not file.filename.endswith(('.pdf', '.docx')):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
    
    try:
        # Extract text using parser_service
        raw_text = await extract_text_from_file(file)
        
        # Parse into structured data using ai_service
        parsed_data = await parse_resume_to_json(raw_text)
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

@router.post("/map-fields", response_model=BatchFieldMappingResponse)
async def map_fields_endpoint(request: BatchFieldMappingRequest):
    """
    Takes a batch of field labels, descriptions, and resume data to generate mapped values using AI.
    """
    try:
        result = await map_fields(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to map fields: {str(e)}")

@router.post("/generate-answer", response_model=AnswerGenerationResponse)
async def generate_answer_endpoint(request: AnswerGenerationRequest):
    """
    Generates an answer to a custom question based on the parsed resume data.
    """
    try:
        result = await generate_answer(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")
