import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

router = APIRouter()

@router.post("/extrator-email")
async def extrair_emails_endpoint(file: UploadFile = File(...), gerar_excel: bool = True):
    filename = file.filename.lower()
    conteudo = await file.read()
    buffer = io.BytesIO(conteudo)

    # Detecta e lê conforme o tipo de arquivo
    if filename.endswith('.csv'):
        df = pd.read_csv(buffer, dtype=str, keep_default_na=False, encoding='latin-1')
        aba_usada = "csv"
    elif filename.endswith(('.xlsx', '.xls')):
        planilhas = pd.read_excel(buffer, dtype=str, keep_default_na=False, sheet_name=None)
        if "main" in planilhas:
            df = planilhas["main"]
            aba_usada = "main"
        else:
            primeira_aba = list(planilhas.keys())[0]
            df = planilhas[primeira_aba]
            aba_usada = primeira_aba
    else:
        raise HTTPException(status_code=400, detail="Arquivo não suportado. Envie um CSV ou Excel.")

    coluna_alvo = "SOCIO1Email1"
    df.columns = df.columns.str.strip()

    if coluna_alvo not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"A coluna '{coluna_alvo}' não foi encontrada na aba '{aba_usada}'. "
                   f"Colunas disponíveis: {', '.join(df.columns)}"
        )

    series = df[coluna_alvo].astype(str)
    emails = sorted({e.strip() for e in series if '@' in e and '.' in e})

    if not emails:
        raise HTTPException(
            status_code=400,
            detail=f"Nenhum e-mail encontrado na coluna '{coluna_alvo}' da aba '{aba_usada}'."
        )

    # Se gerar Excel, cria o arquivo
    excel_bytes = None
    if gerar_excel:
        df_out = pd.DataFrame({'email': emails})
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df_out.to_excel(writer, index=False, sheet_name="Emails")
        output.seek(0)
        excel_bytes = output.read()

    # Retorna JSON com e-mails e arquivo Excel opcional
    return JSONResponse(
        content={
            "emails": emails,
            "excel_base64": excel_bytes.decode("latin1") if excel_bytes else None
        }
    )
