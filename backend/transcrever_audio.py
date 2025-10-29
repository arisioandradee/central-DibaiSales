import os
import io
import shutil
import requests
import textwrap
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse
from fpdf import FPDF
from mutagen import File as MutagenFile
import google.generativeai as genai
from dotenv import load_dotenv
import asyncio
from functools import partial
from pathlib import Path

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada nas variáveis de ambiente")

# ------------------ CONFIGURA GEMINI ------------------
try:
    genai.configure(api_key=GEMINI_API_KEY)
    print("[GEMINI] Configurado com sucesso.")
except Exception as e:
    raise RuntimeError(f"Erro ao configurar Gemini: {e}")

# ------------------ CONFIGURAÇÕES ------------------
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"
SEMAFORO_CONC = 2

router = APIRouter()

# ------------------ FUNÇÕES AUXILIARES ------------------
def baixar_audio(url: str, caminho: str):
    try:
        r = requests.get(url, stream=True, timeout=30)
        if r.status_code != 200:
            return f"Erro no download: HTTP {r.status_code}"
        with open(caminho, "wb") as f:
            shutil.copyfileobj(r.raw, f)
        tamanho = os.path.getsize(caminho)
        print(f"[DOWNLOAD] Tamanho do arquivo {caminho}: {tamanho} bytes")
        return True
    except Exception as e:
        return f"Exceção download: {str(e)}"

def duracao_audio_segundos(caminho: str) -> float:
    try:
        audio = MutagenFile(caminho)
        if audio is None or not hasattr(audio, "info"):
            print(f"[DURACAO] Arquivo inválido ou não suportado: {caminho}")
            return 0.0
        dur = float(audio.info.length)
        print(f"[DURACAO] Duração detectada: {dur:.2f}s para {caminho}")
        return dur
    except Exception as e:
        print(f"[DURACAO] Erro ao calcular duração: {e}")
        return 0.0

def transcrever_audio(caminho_arquivo: str) -> str:
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        audio_file = Path(caminho_arquivo)
        
        # O .read_bytes() pode falhar se o arquivo foi baixado corrompido ou é inválido,
        # mas a exceção principal virá do generate_content.
        response = model.generate_content([
            {"mime_type": "audio/mp3", "data": audio_file.read_bytes()},
            "Transcreva o áudio em texto."
        ])
        
        # Verifica se a resposta não está vazia (caso a API não consiga transcrever nada)
        if not response.text.strip():
             return "Erro na transcrição: Resposta da API Gemini vazia ou sem texto."

        return response.text.strip()
    except Exception as e:
        return f"Erro na transcrição: {e}"

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    os.makedirs(PASTA_TEMP, exist_ok=True)
    sem = asyncio.Semaphore(SEMAFORO_CONC)

    buffer_pdf = io.BytesIO()
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Helvetica", size=11)
    largura_util = 180

    # Esta lista será compartilhada entre as tarefas assíncronas
    resultados_curtos_resumo = []

    def write_long_text(p: FPDF, text: str, width=largura_util, line_h=6):
        paragraphs = text.splitlines() if text else [""]
        for para in paragraphs:
            if not para:
                p.ln(2)
                continue
            for bloco in textwrap.wrap(para, width=100):
                p.multi_cell(width, line_h, bloco)
            p.ln(2)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()

        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(
                status_code=400,
                detail=f"O Excel deve conter as colunas 'GRAVAÇÃO', 'ID' e '{COLUNA_ATENDENTE}'."
            )

        df = df.dropna(subset=["ID", "GRAVAÇÃO"])
        print(f"[API] Excel filtrado: {len(df)} linhas válidas.")

        async def processar_linha(row):
            async with sem:
                link = row["GRAVAÇÃO"]
                call_id = str(row["ID"]).strip()
                atendente_nome = str(row[COLUNA_ATENDENTE.upper()]).strip()

                print(f"[INÍCIO] Processando ID: {call_id} | Atendente: {atendente_nome}")

                if not isinstance(link, str) or not link.startswith("http"):
                    resultados_curtos_resumo.append({"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": "Link inválido"})
                    return

                nome_arquivo_local = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
                loop = asyncio.get_event_loop()
                
                # 1. Download
                resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo_local))
                if resultado_download is not True:
                    resultados_curtos_resumo.append({"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": resultado_download})
                    return

                # 2. Duração
                dur = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo_local))
                if dur < 30:
                    resultados_curtos_resumo.append({"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": f"Áudio muito curto ({dur:.2f}s)"})
                    return

                # 3. Transcrição real usando Gemini
                transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio, nome_arquivo_local))

                # !!! CORREÇÃO AQUI: Verifica se a transcrição falhou !!!
                if transcricao_texto.startswith("Erro na transcrição:"):
                    resultados_curtos_resumo.append({"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": transcricao_texto})
                    print(f"[FALHA] Transcrição falhou para o ID {call_id}. Registrado no resumo.")
                    return # Sai do processamento desta linha
                
                pdf.add_page()
                pdf.multi_cell(largura_util, 6, f"ID: {call_id}")
                pdf.multi_cell(largura_util, 6, f"Atendente: {atendente_nome}")
                pdf.multi_cell(largura_util, 6, f"Link: {link}")
                pdf.ln(4)
                pdf.multi_cell(largura_util, 6, "Transcrição:")
                write_long_text(pdf, transcricao_texto)
                print(f"[SUCESSO] Transcrição concluída e adicionada ao PDF para o ID {call_id}")

        tasks = [processar_linha(row) for _, row in df.iterrows()]
        
        # Aguarda todas as tarefas (download/transcrição e adição 'incremental' ao PDF)
        await asyncio.gather(*tasks)

        # PDF resumo de áudios curtos/falhas
        if resultados_curtos_resumo:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(largura_util, 8, "Resumo de transcrições curtas / falhas:\n")
            pdf.set_font("Helvetica", size=11)
            for r in resultados_curtos_resumo:
                texto_curto = f"ID: {r['ID']} | Atendente: {r['ATENDENTE']} | Status: {r['STATUS']}"
                pdf.multi_cell(largura_util, 6, texto_curto)
                pdf.ln(2)

        pdf.output(buffer_pdf, dest='F')
        buffer_pdf.seek(0)

        return StreamingResponse(
            buffer_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"}
        )

    except HTTPException:
        raise # Rethrow HTTPException
    except Exception as e:
        print(f"[ERRO FATAL] Exceção durante o processamento: {e}")
        # Se ocorrer um erro não tratado, limpa o buffer e levanta um erro 500
        buffer_pdf.close()
        raise HTTPException(status_code=500, detail=f"Erro interno do servidor: {str(e)}")

    finally:
        try:
            if os.path.exists(PASTA_TEMP):
                shutil.rmtree(PASTA_TEMP)
                print("[TEMP] Pasta temporária removida")
        except Exception as ee:
            print(f"[TEMP] Falha ao remover pasta temporária: {ee}")