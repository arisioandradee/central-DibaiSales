# backend/transcrever_audio.py
import os
import io
import time
import shutil
import requests
import textwrap
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse
from fpdf import FPDF  # fpdf2
from mutagen import File as MutagenFile
import google.generativeai as genai
from dotenv import load_dotenv
import asyncio
from functools import partial
from typing import Optional

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada nas variáveis de ambiente")

# ------------------ CONFIGURA GEMINI (compatível com 0.8.x) ------------------
try:
    genai.configure(api_key=GEMINI_API_KEY)
    print("[GEMINI] Configurado com sucesso.")
except Exception as e:
    raise RuntimeError(f"Erro ao configurar Gemini: {e}")

# fallback helpers for upload/delete (compatibility across minor SDK variations)
def _upload_file(path: str):
    # prefer wrapper upload_file if exists, otherwise use files.upload
    if hasattr(genai, "upload_file"):
        return genai.upload_file(path=path)
    elif hasattr(genai, "files") and hasattr(genai.files, "upload"):
        return genai.files.upload(file=path)
    else:
        raise RuntimeError("Função de upload de arquivo não disponível no SDK google-generativeai instalado.")

def _delete_file(name: str):
    if hasattr(genai, "delete_file"):
        return genai.delete_file(name=name)
    elif hasattr(genai, "files") and hasattr(genai.files, "delete"):
        return genai.files.delete(name=name)
    else:
        # não falha se não existir; só loga
        print("[GEMINI] delete_file não disponível no SDK instalado; ignorando remoção remota.")
        return None

# ------------------ CONFIGURAÇÕES ------------------
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"
SEMAFORO_CONC = 2  # reduzir se o Render cortar por timeout; aumente se estiver em plano com mais timeout

router = APIRouter()

# ------------------ FUNÇÕES AUXILIARES ------------------
def baixar_audio(url: str, caminho: str):
    try:
        r = requests.get(url, stream=True, timeout=30)
        if r.status_code != 200:
            return f"Erro no download: HTTP {r.status_code}"
        with open(caminho, "wb") as f:
            shutil.copyfileobj(r.raw, f)
        return True
    except Exception as e:
        return f"Exceção download: {str(e)}"

def duracao_audio_segundos(caminho: str) -> float:
    try:
        audio = MutagenFile(caminho)
        if audio is None or not hasattr(audio, "info"):
            return 0.0
        return float(audio.info.length)
    except Exception:
        return 0.0

def transcrever_audio_local(caminho: str) -> str:
    """
    Faz upload do arquivo para o Gemini e solicita a geração de transcrição.
    Retorna string com a transcrição ou mensagem de erro.
    """
    try:
        print(f"[GEMINI] Fazendo upload do arquivo: {caminho}")
        uploaded = _upload_file(path=caminho)
        print("[GEMINI] Upload concluído, solicitando geração...")

        # escolher modelo (ajuste se preferir outro)
        modelo = genai.GenerativeModel("gemini-1.5-flash")

        prompt = (
            "Transcreva o áudio completo em Português do Brasil.\n"
            "Identifique os locutores pelo nome se possível.\n"
            "Formate como diálogo: Nome: fala do participante.\n"
            "Evite linhas longas e remova espaços extras.\n"
        )

        # A API aceita [prompt, uploaded_file] em muitas versões do SDK
        response = modelo.generate_content([prompt, uploaded])
        texto = ""
        # response pode ter .text ou .result dependendo da versão
        if hasattr(response, "text") and response.text:
            texto = response.text.strip()
        elif hasattr(response, "result") and hasattr(response.result, "output"):
            # tentativa alternativa (fallback)
            texto = str(response.result.output).strip()
        else:
            texto = ""

        try:
            # tenta deletar o arquivo remoto
            if hasattr(uploaded, "name"):
                _delete_file(name=uploaded.name)
        except Exception:
            pass

        if not texto:
            return "ERRO na Transcrição: nenhum texto retornado pelo modelo."

        return texto

    except Exception as e:
        print(f"[TRANSCRICAO] Exception: {type(e).__name__}: {e}")
        # tenta remover arquivo remoto se possível
        try:
            if 'uploaded' in locals() and hasattr(uploaded, "name"):
                _delete_file(name=uploaded.name)
        except:
            pass
        return f"ERRO na Transcrição: {type(e).__name__}: {str(e)}"

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    print("[API] Recebendo arquivo Excel...")
    resultados_longos = []
    resultados_curtos_resumo = []

    os.makedirs(PASTA_TEMP, exist_ok=True)
    sem = asyncio.Semaphore(SEMAFORO_CONC)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()

        # Verifica colunas obrigatórias
        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(status_code=400, detail=f"O Excel deve conter as colunas 'GRAVAÇÃO', 'ID' e '{COLUNA_ATENDENTE}'.")

        # Remove linhas sem ID ou GRAVAÇÃO
        df = df.dropna(subset=["ID", "GRAVAÇÃO"])
        print(f"[API] Excel filtrado: {len(df)} linhas válidas.")

        # Função de processamento de cada linha (executada em executor para I/O)
        async def processar_linha(row):
            link = row["GRAVAÇÃO"]
            call_id = str(row["ID"]).strip()
            atendente_nome = str(row[COLUNA_ATENDENTE.upper()]).strip()

            print(f"[INÍCIO] Processando ID: {call_id} | Atendente: {atendente_nome}")

            if not isinstance(link, str) or not link.startswith("http"):
                print(f"[SKIP] ID {call_id} inválido: {link}")
                return None

            nome_arquivo_local = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
            loop = asyncio.get_event_loop()

            # download
            resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo_local))
            if resultado_download is not True:
                print(f"[DOWNLOAD] Falhou para ID {call_id}: {resultado_download}")
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": resultado_download}

            # duração
            dur = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo_local))
            print(f"[DURACAO] ID {call_id}: {dur:.2f}s")
            if dur < 30:
                try:
                    os.remove(nome_arquivo_local)
                except:
                    pass
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": "Áudio muito curto (<30s)"}

            # chama transcrição limitando concorrência
            async with sem:
                transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio_local, nome_arquivo_local))

            # remove arquivo local
            try:
                if os.path.exists(nome_arquivo_local):
                    os.remove(nome_arquivo_local)
            except:
                pass

            if transcricao_texto.startswith("ERRO na Transcrição"):
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": transcricao_texto}
            elif len(transcricao_texto) < LIMITE_TRANSCRICAO_CURTA:
                resumo_curto = transcricao_texto.replace('\n', ' ').strip()[:120] + "..."
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": f"CURTA: {resumo_curto}"}
            else:
                return {"LONGO": {"ID": call_id, "ATENDENTE": atendente_nome, "LINK": link, "TRANSCRICAO": transcricao_texto}}

        # cria tarefas (usando semáforo interno para limitar)
        tasks = []
        for _, row in df.iterrows():
            tasks.append(processar_linha(row))

        print(f"[ASYNC] Iniciando processamento de {len(tasks)} tarefas (concurrency={SEMAFORO_CONC})...")
        resultados = await asyncio.gather(*tasks)

        # separa resultados
        for r in resultados:
            if r is None:
                continue
            if "LONGO" in r:
                resultados_longos.append(r["LONGO"])
            else:
                resultados_curtos_resumo.append(r)

        # ---- GERAÇÃO DO PDF ----
        print("[PDF] Gerando PDF final...")
        pdf = FPDF(orientation='P', unit='mm', format='A4')
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=15)
        # usar Helvetica (core font)
        pdf.set_font("Helvetica", size=11)
        largura_util = 180  # área útil entre margens

        # função segura para escrever texto grande em blocos
        def write_long_text(p: FPDF, text: str, width=largura_util, line_h=6):
            # quebra por parágrafos mantendo palavras inteiras
            paragraphs = text.splitlines() if text else [""]
            for para in paragraphs:
                if not para:
                    p.ln(2)
                    continue
                # textwrap with big width reduces chances of too-short-chunks
                for bloco in textwrap.wrap(para, width=500):
                    p.multi_cell(width, line_h, bloco)
                p.ln(2)

        for item in resultados_longos:
            pdf.add_page()
            # Cabeçalho do item
            pdf.multi_cell(largura_util, 6, f"ID: {item['ID']}")
            pdf.multi_cell(largura_util, 6, f"Atendente: {item['ATENDENTE']}")
            pdf.multi_cell(largura_util, 6, f"Link: {item['LINK']}")
            pdf.ln(4)
            pdf.multi_cell(largura_util, 6, "Transcrição:")
            write_long_text(pdf, item.get("TRANSCRICAO", ""))

        if resultados_curtos_resumo:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(largura_util, 8, "Resumo de transcrições curtas / falhas:\n")
            pdf.set_font("Helvetica", size=11)
            for r in resultados_curtos_resumo:
                texto_curto = f"ID: {r['ID']} | Atendente: {r['ATENDENTE']} | Status: {r['STATUS']}"
                pdf.multi_cell(largura_util, 6, texto_curto)
                pdf.ln(2)

        # exporta PDF como bytes seguros (latin1 com replace)
        pdf_bytes = pdf.output(dest='S')
        if isinstance(pdf_bytes, str):
            pdf_bytes = pdf_bytes.encode('latin1', errors='replace')
        elif isinstance(pdf_bytes, bytes):
            # ok
            pass
        else:
            pdf_bytes = str(pdf_bytes).encode('latin1', errors='replace')

        print("[PDF] PDF gerado com sucesso.")
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                                headers={"Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"})

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERRO FATAL] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno no processamento: {e}")
    finally:
        # limpa temp
        try:
            if os.path.exists(PASTA_TEMP):
                shutil.rmtree(PASTA_TEMP)
                print("[TEMP] Pasta temporária removida")
        except Exception as ee:
            print(f"[TEMP] Falha ao remover pasta temporária: {ee}")
