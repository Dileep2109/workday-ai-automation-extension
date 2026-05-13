import pdfplumber
import docx
import io
from fastapi import UploadFile

async def extract_text_from_file(file: UploadFile) -> str:
    """
    Extract text content from uploaded PDF or DOCX file.
    """
    content = await file.read()
    filename = file.filename.lower()
    
    text = ""
    if filename.endswith('.pdf'):
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    elif filename.endswith('.docx'):
        doc = docx.Document(io.BytesIO(content))
        for para in doc.paragraphs:
            text += para.text + "\n"
            
    return text.strip()
