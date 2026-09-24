import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..database import UPLOAD_DIR

MAX_FILE_SIZE = 50 * 1024 * 1024


class UploadedFile(BaseModel):
    id: str
    filename: str
    size: int


router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("", response_model=UploadedFile, status_code=201)
async def upload_file(file: UploadFile = File(...)) -> UploadedFile:
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

    file_id = uuid.uuid4().hex
    original_name = Path(file.filename or "upload").name

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / file_id).write_bytes(content)

    return UploadedFile(id=file_id, filename=original_name, size=len(content))
