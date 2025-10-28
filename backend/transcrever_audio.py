import os
import io
import shutil
import textwrap
import requests
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse
from fpdf import FPDF
from mutagen import File as MutagenFile
import asyncio
from functools import partial
import google.generativeai as genai
from dotenv import load_dotenv

# ------------------ CONFIGURAÇÕES ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada")

genai.configure(api_key=GEMINI_API_KEY)

PASTA_TEMP = "audios_temp"
SEMAFORO_CONC = 2
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
LARGURA_UTIL = 180

router = APIRouter()

# ------------------ AUXILIARES ------------------
def baixar_audio(url: str, caminho: str):
    try:
        r = requests.get(url, stream=True, timeout=30)
        if r.status_code != 200:
            return f"Erro HTTP {r.status_code}"
        with open(caminho, "wb") as f:
            shutil.copyfileobj(r.raw, f)
        return True
    except Exception as e:
        return f"Exceção download: {str(e)}"

def duracao_audio_segundos(caminho: str) -> float:
    try:
        audio = MutagenFile(caminho)
        return float(audio.info.length) if audio and hasattr(audio, "info") else 0.0
    except:
        return 0.0

def transcrever_audio_local(caminho: str) -> str:
    try:
        uploaded = genai.upload_file(path=caminho)
        modelo = genai.GenerativeModel("gemini-1.5")  # use um modelo válido

        prompt = (
            "Transcreva o áudio completo em Português do Brasil.\n"
            "Identifique os locutores pelo nome se possível.\n"
            "Formate como diálogo: Nome: fala do participante.\n"
            "Evite linhas longas e remova espaços extras.\n"
        )

        response = modelo.generate_content([prompt, uploaded])
        texto = getattr(response, "text", "") or str(getattr(getattr(response, "result", {}), "output", "")).strip()

        try:
            if hasattr(uploaded, "name"):
                genai.delete_file(name=uploaded.name)
        except:
            pass

        return texto if texto else "ERRO na Transcrição: nenhum texto retornado pelo modelo."
    except Exception as e:
        return f"ERRO na Transcrição: {type(e).__name__}: {str(e)}"

def write_long_text(p: FPDF, text: str, width=LARGURA_UTIL, line_h=6):
    paragraphs = text.splitlines() if text else [""]
    for para in paragraphs:
        if not para:
            p.ln(2)
            continue
        for bloco in textwrap.wrap(para, width=500):
            p.multi_cell(width, line_h, bloco)
        p.ln(2)

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    os.makedirs(PASTA_TEMP, exist_ok=True)
    resultados_longos = []
    resultados_curtos_resumo = []
    sem = asyncio.Semaphore(SEMAFORO_CONC)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()
        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(status_code=400, detail=f"O Excel deve conter as colunas {colunas_requeridas}")

        df = df.dropna(subset=["ID", "GRAVAÇÃO"])

        async def processar_linha(row):
            link = row["GRAVAÇÃO"]
            call_id = str(row["ID"]).strip()
            atendente_nome = str(row[COLUNA_ATENDENTE.upper()]).strip()
            nome_arquivo_local = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
            loop = asyncio.get_event_loop()

            resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo_local))
            if resultado_download is not True:
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": resultado_download}

            dur = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo_local))
            if dur < 30:
                os.remove(nome_arquivo_local)
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": "Áudio muito curto (<30s)"}

            async with sem:
                transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio_local, nome_arquivo_local))

            os.remove(nome_arquivo_local)
            if transcricao_texto.startswith("ERRO na Transcrição"):
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": transcricao_texto}
            elif len(transcricao_texto) < LIMITE_TRANSCRICAO_CURTA:
                resumo_curto = transcricao_texto.replace('\n', ' ').strip()[:120] + "..."
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": f"CURTA: {resumo_curto}"}
            else:
                return {"LONGO": {"ID": call_id, "ATENDENTE": atendente_nome, "LINK": link, "TRANSCRICAO": transcricao_texto}}

        tasks = [processar_linha(row) for _, row in df.iterrows()]
        resultados = await asyncio.gather(*tasks)

        for r in resultados:
            if r is None:
                continue
            if "LONGO" in r:
                resultados_longos.append(r["LONGO"])
            else:
                resultados_curtos_resumo.append(r)

        # Geração do PDF
        pdf = FPDF(orientation='P', unit='mm', format='A4')
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_font("Helvetica", size=11)

        for item in resultados_longos:
            pdf.add_page()
            pdf.multi_cell(LARGURA_UTIL, 6, f"ID: {item['ID']}")
            pdf.multi_cell(LARGURA_UTIL, 6, f"Atendente: {item['ATENDENTE']}")
            pdf.multi_cell(LARGURA_UTIL, 6, f"Link: {item['LINK']}")
            pdf.ln(4)
            pdf.multi_cell(LARGURA_UTIL, 6, "Transcrição:")
            write_long_text(pdf, item.get("TRANSCRICAO", ""))

        if resultados_curtos_resumo:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(LARGURA_UTIL, 8, "Resumo de transcrições curtas / falhas:\n")
            pdf.set_font("Helvetica", size=11)
            for r in resultados_curtos_resumo:
                texto_curto = f"ID: {r['ID']} | Atendente: {r['ATENDENTE']} | Status: {r['STATUS']}"
                pdf.multi_cell(LARGURA_UTIL, 6, texto_curto)
                pdf.ln(2)

        pdf_bytes = pdf.output(dest='S')
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {e}")
    finally:
        try:
            if os.path.exists(PASTA_TEMP):
                shutil.rmtree(PASTA_TEMP, ignore_errors=True)
        except:
            pass
