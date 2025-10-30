from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel
from typing import List, Optional, Union
import os
import requests
from dotenv import load_dotenv

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


def format_number(number: str) -> str:
    """Garante que o número comece com o código do Brasil '55'"""
    number = number.strip()
    if not number.startswith("55"):
        number = "55" + number
    return number


def call_whatsapp_api(number: str) -> Union[ValidationResult, List[ValidationResult]]:
    """Chama a API do WhatsApp e retorna ValidationResult ou lista de ValidationResult para bulk"""
    number = format_number(number)
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

        # Detecta se é bulk (lista) ou single (objeto)
        if isinstance(data, list):
            results = []
            for item in data:
                status_api = item.get("status", "").lower()
                results.append(
                    ValidationResult(
                        number=item.get("phone_number", ""),
                        status=status_api if status_api in ["valid", "invalid"] else "unknown",
                        sub_status=""
                    )
                )
            return results
        else:
            status_api = data.get("status", "").lower()
            status = status_api if status_api in ["valid", "invalid"] else "unknown"
            return ValidationResult(
                number=number,
                status=status,
                sub_status=data.get("sub_status", "")
            )

    except requests.RequestException as e:
        return ValidationResult(number=number, status="unknown", sub_status=str(e))


@router.post("/whatsapp_validator", response_model=Union[ValidationResult, List[ValidationResult]])
def validate(req: ValidationRequest):
    """Endpoint que valida número(s) de WhatsApp"""
    if req.number:
        return call_whatsapp_api(req.number)
    elif req.numbers and len(req.numbers) > 0:
        # Para bulk, chamamos a função para cada número individualmente
        results = []
        for n in req.numbers:
            res = call_whatsapp_api(n)
            # Se retornar lista (bulk da API), extend; se for single, append
            if isinstance(res, list):
                results.extend(res)
            else:
                results.append(res)
        return results
    else:
        raise HTTPException(status_code=400, detail="Nenhum número fornecido")
