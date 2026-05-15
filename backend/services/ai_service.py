import os
import json
import traceback

from dotenv import load_dotenv
from openai import AsyncOpenAI

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

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")


async def generate_json(system_prompt: str, user_content: str, temperature: float = 0.1) -> str:
    json_input = f"""
Return only a valid JSON object.

{user_content}
"""

    response = await client.responses.create(
        model=MODEL_NAME,
        instructions=system_prompt,
        input=json_input,
        text={"format": {"type": "json_object"}},
        temperature=temperature,
    )
    return response.output_text

async def parse_resume_to_json(raw_text: str) -> ResumeData:
    """Uses OpenAI to parse raw resume text into structured JSON."""

    try:
        parsed_content = await generate_json(
            PARSE_RESUME_SYSTEM_PROMPT,
            f"Resume Text:\n{raw_text}",
            temperature=0.1,
        )

        print("\n========== RESUME OPENAI RESPONSE ==========")
        print(parsed_content)
        print("==========================================\n")

        return ResumeData.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== RESUME PARSE ERROR (OPENAI) ==========")
        print(f"Error parsing resume with OpenAI: {e}")
        traceback.print_exc()
        print("=================================================\n")

        return ResumeData()


async def map_fields(request: BatchFieldMappingRequest) -> BatchFieldMappingResponse:
    """Uses OpenAI to map multiple Workday fields semantically in a single batch."""

    try:
        fields_json = json.dumps([field.model_dump() for field in request.fields], indent=2)
        compact_resume = compact_resume_for_mapping(request.resumeData)
        prompt_content = f"""
Fields to Map:
{fields_json}

Compact Resume Data:
{json.dumps(compact_resume, indent=2)}
"""

        parsed_content = await generate_json(
            MAP_FIELD_SYSTEM_PROMPT,
            prompt_content,
            temperature=0.1,
        )

        print("\n========== BATCH FIELD MAPPING OPENAI RESPONSE ==========")
        print(parsed_content)
        print("========================================================\n")

        return BatchFieldMappingResponse.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== BATCH FIELD MAPPING ERROR (OPENAI) ==========")
        print(f"Error mapping fields with OpenAI: {e}")
        traceback.print_exc()
        print("========================================================\n")

        return BatchFieldMappingResponse(mappings=[])


def compact_resume_for_mapping(resume_data: dict) -> dict:
    """Keep mapping prompts small to avoid quota/token exhaustion."""

    experience = resume_data.get("experience") or []
    education = resume_data.get("education") or []

    return {
        "firstName": resume_data.get("firstName", ""),
        "lastName": resume_data.get("lastName", ""),
        "email": resume_data.get("email", ""),
        "phone": resume_data.get("phone", ""),
        "location": resume_data.get("location", ""),
        "linkedin": resume_data.get("linkedin", ""),
        "github": resume_data.get("github", ""),
        "skills": (resume_data.get("skills") or [])[:20],
        "certifications": (resume_data.get("certifications") or [])[:10],
        "latestExperience": compact_experience(experience[0]) if experience else {},
        "education": [compact_education(item) for item in education[:3]],
        "applicationDefaults": {
            "heardAboutUs": "LinkedIn",
            "currentlyCompanyContractor": "No",
            "previouslyWorkedForCompany": "No",
            "requiresSponsorship": "No",
            "legallyAuthorizedToWork": "Yes",
            "hasPreferredName": "No",
        },
    }


def compact_experience(item: dict) -> dict:
    return {
        "title": item.get("title", ""),
        "company": item.get("company", ""),
        "location": item.get("location", ""),
        "startDate": item.get("startDate", ""),
        "endDate": item.get("endDate", ""),
    }


def compact_education(item: dict) -> dict:
    return {
        "school": item.get("school", ""),
        "degree": item.get("degree", ""),
        "major": item.get("major", ""),
        "startDate": item.get("startDate", ""),
        "endDate": item.get("endDate", ""),
    }


async def generate_answer(request: AnswerGenerationRequest) -> AnswerGenerationResponse:
    """Generates answers for custom Workday application questions."""

    try:
        prompt_content = f"""
Question:
{request.question}

Resume Data:
{json.dumps(request.resumeData, indent=2)}
"""

        parsed_content = await generate_json(
            GENERATE_ANSWER_SYSTEM_PROMPT,
            prompt_content,
            temperature=0.7,
        )

        print("\n========== ANSWER GENERATION OPENAI RESPONSE ==========")
        print(parsed_content)
        print("======================================================\n")

        return AnswerGenerationResponse.model_validate_json(parsed_content)

    except Exception as e:
        print("\n========== ANSWER GENERATION ERROR (OPENAI) ==========")
        print(f"Error generating answer with OpenAI: {e}")
        traceback.print_exc()
        print("=====================================================\n")

        return AnswerGenerationResponse(
            answer="",
            confidence=0.0
        )
