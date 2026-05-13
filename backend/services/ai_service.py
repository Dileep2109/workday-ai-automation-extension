import os
import json
import traceback

from dotenv import load_dotenv
import google.generativeai as genai

from models.schemas import (
    ResumeData,
    BatchFieldMappingRequest,
    BatchFieldMappingResponse,
    AnswerGenerationRequest,
    AnswerGenerationResponse
)

from prompts.parse_resume import PARSE_RESUME_SYSTEM_PROMPT
from prompts.map_field import MAP_FIELD_SYSTEM_PROMPT
from prompts.generate_answer import GENERATE_ANSWER_SYSTEM_PROMPT

# Load environment variables
load_dotenv()

# Initialize Gemini client
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

MODEL_NAME = "gemini-2.5-flash"

async def parse_resume_to_json(raw_text: str) -> ResumeData:
    """Uses Gemini to parse raw resume text into structured JSON."""

    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=PARSE_RESUME_SYSTEM_PROMPT,
            generation_config={"response_mime_type": "application/json", "temperature": 0.1}
        )
        
        response = await model.generate_content_async(f"Resume Text:\n{raw_text}")

        parsed_content = response.text

        print("\n========== RESUME AI RESPONSE ==========")
        print(parsed_content)
        print("========================================\n")

        return ResumeData.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== RESUME PARSE ERROR ==========")
        print(f"Error parsing resume with AI: {e}")
        traceback.print_exc()
        print("========================================\n")

        return ResumeData()


async def map_fields(request: BatchFieldMappingRequest) -> BatchFieldMappingResponse:
    """Uses Gemini to map multiple Workday fields semantically in a single batch."""

    try:
        fields_json = json.dumps([field.model_dump() for field in request.fields], indent=2)
        prompt_content = f"""
Fields to Map:
{fields_json}

Resume Data:
{json.dumps(request.resumeData, indent=2)}
"""

        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=MAP_FIELD_SYSTEM_PROMPT,
            generation_config={"response_mime_type": "application/json", "temperature": 0.1}
        )

        response = await model.generate_content_async(prompt_content)

        parsed_content = response.text

        print("\n========== BATCH FIELD MAPPING AI RESPONSE ==========")
        print(parsed_content)
        print("=====================================================\n")

        return BatchFieldMappingResponse.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== BATCH FIELD MAPPING ERROR ==========")
        print(f"Error mapping fields with AI: {e}")
        traceback.print_exc()
        print("===============================================\n")

        return BatchFieldMappingResponse(mappings=[])


async def generate_answer(request: AnswerGenerationRequest) -> AnswerGenerationResponse:
    """Generates answers for custom Workday application questions."""

    try:
        prompt_content = f"""
Question:
{request.question}

Resume Data:
{json.dumps(request.resumeData, indent=2)}
"""

        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=GENERATE_ANSWER_SYSTEM_PROMPT,
            generation_config={"response_mime_type": "application/json", "temperature": 0.7}
        )

        response = await model.generate_content_async(prompt_content)

        parsed_content = response.text

        print("\n========== ANSWER GENERATION AI RESPONSE ==========")
        print(parsed_content)
        print("===================================================\n")

        return AnswerGenerationResponse.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== ANSWER GENERATION ERROR ==========")
        print(f"Error generating answer with AI: {e}")
        traceback.print_exc()
        print("=============================================\n")

        return AnswerGenerationResponse(
            answer="",
            confidence=0.0
        )