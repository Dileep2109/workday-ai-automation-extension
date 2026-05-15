from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ResumeData(BaseModel):
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    skills: List[str] = []
    education: List[Dict[str, Any]] = []
    experience: List[Dict[str, Any]] = []
    certifications: List[str] = []

class FieldMappingRequest(BaseModel):
    fieldLabel: str
    fieldDescription: Optional[str] = None
    fieldType: str
    resumeData: dict

class FieldMappingResponse(BaseModel):
    value: str
    confidence: float
    source: str

class FieldInfo(BaseModel):
    fieldLabel: str
    fieldDescription: Optional[str] = None
    fieldType: str
    options: List[str] = []

class BatchFieldMappingRequest(BaseModel):
    fields: List[FieldInfo]
    resumeData: dict

class FieldMappingResult(BaseModel):
    fieldLabel: str
    value: str
    confidence: float
    source: str

class BatchFieldMappingResponse(BaseModel):
    mappings: List[FieldMappingResult]

class AnswerGenerationRequest(BaseModel):
    question: str
    resumeData: dict

class AnswerGenerationResponse(BaseModel):
    answer: str
    confidence: float
