# ==================== IMPORTS =============================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.converter_planilha import router as converter_router
from backend.extrair_email import router as email_router
from backend.extrair_numero import router as numero_router
from backend.speedio_assertiva import router as speedio_router
from backend.transcrever_audio import router as transcrever_router
# =============================================================

app = FastAPI(
    title="Central Dibai Sales - Backend",
    description="API unificada para conversão, extração e transcrição de dados.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://centraldibaisales.netlify.app",
        "https://central-dibaisales.onrender.com",
        "http://localhost:3000" 
    ],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(converter_router, prefix="/api", tags=["Conversor"])
app.include_router(email_router, prefix="/api", tags=["Extrator de E-mails"])
app.include_router(numero_router, prefix="/api", tags=["Extrator de Números"])
app.include_router(speedio_router, prefix="/api", tags=["Speedio / Assertiva"])
app.include_router(transcrever_router, prefix="/api", tags=["Transcritor de Áudios"])