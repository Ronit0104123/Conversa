from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from app.middleware.auth import get_current_user
from app.services.document_processor import process_file
from app.services.embedding import process_and_store_embeddings
from app.db import queries
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

async def process_document_task(chatbot_id: str, filename: str, content: bytes):
    """Background task to process file, extract text, and store embeddings."""
    try:
        logger.info(f"Processing document: {filename} for chatbot {chatbot_id}")
        text = await process_file(filename, content)
        if not text or len(text.strip()) < 10:
            logger.error(f"Failed to extract meaningful text from {filename}")
            return
        
        # Store embeddings (additive - we don't delete old ones here)
        chunks_stored = await process_and_store_embeddings(
            chatbot_id=chatbot_id,
            content=text,
            source_url=f"file://{filename}",
            page_title=filename
        )
        # Update status to active once done
        await queries.update_chatbot(chatbot_id, {"status": "active"})
        logger.info(f"Successfully processed {filename}. {chunks_stored} chunks stored.")
    except Exception as e:
        logger.error(f"Error processing document {filename}: {e}")
        await queries.update_chatbot(chatbot_id, {"status": "error"})

@router.post("/{chatbot_id}")
async def upload_document(
    chatbot_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    """Endpoint to upload a PDF, DOCX, or Excel file for a chatbot."""
    # Verify ownership
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found or unauthorized")

    # Set status to processing immediately
    await queries.update_chatbot(chatbot_id, {"status": "processing"})

    # Read content immediately (it's small enough for memory usually)
    content = await file.read()
    
    # Run heavy processing in background
    background_tasks.add_task(
        process_document_task,
        chatbot_id,
        file.filename,
        content
    )

    return {
        "status": "processing",
        "message": f"File '{file.filename}' uploaded and indexing started in the background.",
        "chatbot_id": chatbot_id
    }

@router.get("/{chatbot_id}")
async def list_documents(
    chatbot_id: str,
    user_id: str = Depends(get_current_user)
):
    """List all documents indexed for a chatbot."""
    chatbot = await queries.get_chatbot(chatbot_id)
    if not chatbot or str(chatbot["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Chatbot not found or unauthorized")

    documents = await queries.list_chatbot_documents(chatbot_id)
    return documents
