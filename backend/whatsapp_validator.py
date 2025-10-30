from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
import os
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, UploadFile, File, HTTPException

load_dotenv()

router = APIRouter()

RAPIDAPI_KEY = os.getenv("NEXT_PUBLIC_RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("NEXT_PUBLIC_RAPIDAPI_HOST")
RAPIDAPI_URL = os.getenv("NEXT_PUBLIC_RAPIDAPI_URL")


class ValidationRequest(BaseModel):
    number: Optional[str] = None
    numbers: Optional[List[str]] = None


class ValidationResult(BaseModel):
    number: str
    status: str
    sub_status: str = ""


def call_whatsapp_api(number: str) -> ValidationResult:
    payload = {"phone_number": number}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Content-Type": "application/json"
    }
    try:
        resp = requests.post(RAPIDAPI_URL, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        status_api = data.get("status", "").lower()
        if status_api == "valid":
            status = "valid"
        elif status_api == "invalid":
            status = "invalid"
        else:
            status = "unknown"
        return ValidationResult(number=number, status=status, sub_status=data.get("sub_status", ""))
    except requests.RequestException as e:
        return ValidationResult(number=number, status="unknown", sub_status=str(e))


@router.post("/whatsapp_validator", response_model=Union[ValidationResult, List[ValidationResult]])
def validate(req: ValidationRequest):
    # Validação de input
    if req.number:
        return call_whatsapp_api(req.number.strip())
    elif req.numbers and len(req.numbers) > 0:
        results = [call_whatsapp_api(n.strip()) for n in req.numbers]
        return results
    else:
        raise HTTPException(status_code=400, detail="Nenhum número fornecido")
