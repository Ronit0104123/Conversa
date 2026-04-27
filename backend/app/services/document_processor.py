import pypdf
import docx
import pandas as pd
import io
import logging
from typing import List

logger = logging.getLogger(__name__)

async def extract_text_from_pdf(file_content: bytes) -> str:
    """Extracts text from a PDF file."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

async def extract_text_from_docx(file_content: bytes) -> str:
    """Extracts text from a DOCX file."""
    try:
        doc = docx.Document(io.BytesIO(file_content))
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        return ""

async def extract_text_from_excel(file_content: bytes) -> str:
    """Extracts text from an Excel file (XLSX)."""
    try:
        # Read all sheets
        df_dict = pd.read_excel(io.BytesIO(file_content), sheet_name=None)
        text = ""
        for sheet_name, df in df_dict.items():
            text += f"Sheet: {sheet_name}\n"
            text += df.to_string(index=False) + "\n\n"
        return text
    except Exception as e:
        logger.error(f"Error extracting text from Excel: {e}")
        return ""

async def extract_text_from_txt(file_content: bytes) -> str:
    """Extracts text from a plain TXT file."""
    try:
        return file_content.decode("utf-8")
    except Exception as e:
        logger.error(f"Error extracting text from TXT: {e}")
        # Try different encoding if utf-8 fails
        try:
            return file_content.decode("latin-1")
        except:
            return ""

async def process_file(filename: str, content: bytes) -> str:
    """Dispatches to the correct extractor based on file extension."""
    ext = filename.split(".")[-1].lower()
    
    if ext == "pdf":
        return await extract_text_from_pdf(content)
    elif ext in ["docx", "doc"]:
        return await extract_text_from_docx(content)
    elif ext in ["xlsx", "xls"]:
        return await extract_text_from_excel(content)
    elif ext == "txt":
        return await extract_text_from_txt(content)
    else:
        logger.warning(f"Unsupported file type: {ext}")
        return ""
