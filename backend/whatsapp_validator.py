from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel
from typing import List, Optional, Union
import os
from dotenv import load_dotenv
import httpx
import asyncio

load_dotenv()

router = APIRouter()

RAPIDAPI_KEY = os.getenv("NEXT_PUBLIC_RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("NEXT_PUBLIC_RAPIDAPI_HOST")
RAPIDAPI_URL = os.getenv("NEXT_PUBLIC_RAPIDAPI_URL")

MAX_CONCURRENT_REQUESTS = 10  # limite de requisições paralelas

class ValidationRequest(BaseModel):
    number: Optional[str] = None
    numbers: Optional[List[str]] = None

class ValidationResult(BaseModel):
    number: str
    status: str
    sub_status: str = ""

def format_number(number: str) -> str:
    """Garante que o número comece com o código do Brasil '55'"""
    number = number.strip()
    if not number.startswith("55"):
        number = "55" + number
    return number

async def call_whatsapp_api(number: str) -> ValidationResult:
    """Chama a API do WhatsApp de forma assíncrona"""
    number = format_number(number)
    payload = {"phone_number": number}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(RAPIDAPI_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            status_api = data.get("status", "").lower()
            status = status_api if status_api in ["valid", "invalid"] else "unknown"
            return ValidationResult(number=number, status=status, sub_status=data.get("sub_status", ""))
        except Exception as e:
            return ValidationResult(number=number, status="unknown", sub_status=str(e))

async def validate_bulk(numbers: List[str]) -> List[ValidationResult]:
    """Valida números em lote usando asyncio com limite de concorrência"""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    results: List[ValidationResult] = []

    async def sem_task(number: str):
        async with semaphore:
            res = await call_whatsapp_api(number)
            results.append(res)

    await asyncio.gather(*(sem_task(n) for n in numbers))
    return results

@router.post("/whatsapp_validator", response_model=Union[ValidationResult, List[ValidationResult]])
async def validate(req: ValidationRequest):
    """Endpoint que valida número(s) de WhatsApp"""
    if req.number:
        return await call_whatsapp_api(req.number)
    elif req.numbers and len(req.numbers) > 0:
        return await validate_bulk(req.numbers)
    else:
        raise HTTPException(status_code=400, detail="Nenhum número fornecido")