import os
import io
import time
import shutil
import requests
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse
from fpdf import FPDF  # fpdf2
from mutagen import File as MutagenFile
import google.generativeai as genai
from dotenv import load_dotenv
import asyncio
from functools import partial

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada nas variáveis de ambiente")

genai.configure(api_key=GEMINI_API_KEY)
print("[GLOBAL] Conexão com Gemini configurada com sucesso.")

# ------------------ CONFIGURAÇÕES ------------------
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"

router = APIRouter()

# ------------------ FUNÇÕES AUXILIARES ------------------
def baixar_audio(url, caminho):
    try:
        r = requests.get(url, stream=True, timeout=60)
        if r.status_code != 200:
            return f"Erro no download: {r.status_code}"
        with open(caminho, "wb") as f:
            shutil.copyfileobj(r.raw, f)
        return True
    except Exception as e:
        return f"Exceção download: {str(e)}"

def duracao_audio_segundos(caminho):
    audio = MutagenFile(caminho)
    return audio.info.length if audio else 0

def transcrever_audio(caminho):
    try:
        start_upload = time.time()
        print(f"[GEMINI] Iniciando upload: {caminho}")
        uploaded_file = genai.files.upload(file=caminho)
        print(f"[GEMINI] Upload concluído em {time.time() - start_upload:.2f}s. File: {uploaded_file.name}")

        start_gen = time.time()
        print("[GEMINI] Iniciando transcrição...")
        response = genai.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                """
                Transcreva o áudio completo em Português do Brasil.
                Identifique os locutores pelo nome real se possível.
                Formate como diálogo assim: "Nome: fala do participante".
                Evite linhas longas e remova espaços extras desnecessários.
                """,
                uploaded_file
            ]
        )
        print(f"[GEMINI] Transcrição concluída em {time.time() - start_gen:.2f}s.")
        texto = response.text.strip()

        genai.files.delete(name=uploaded_file.name)
        print("[GEMINI] Arquivo temporário deletado.")

        return texto
    except Exception as e:
        print(f"[TRANSCRICAO] ERRO: {type(e).__name__}: {str(e)}")
        try:
            genai.files.delete(name=uploaded_file.name)
        except:
            pass
        return f"ERRO na Transcrição: {type(e).__name__}: {str(e)}"

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    print(f"[API] Recebendo arquivo Excel: {file.filename}")
    resultados_longos = []
    resultados_curtos_resumo = []

    os.makedirs(PASTA_TEMP, exist_ok=True)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()

        # Remove linhas sem ID ou GRAVAÇÃO
        df = df.dropna(subset=["ID", "GRAVAÇÃO"])
        print(f"[API] Excel filtrado com {len(df)} linhas válidas.")

        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(
                status_code=400,
                detail=f"O Excel deve conter as colunas 'GRAVAÇÃO', 'ID' e '{COLUNA_ATENDENTE}'."
            )

        # ------------------ PROCESSAMENTO DE LINHAS ------------------
        async def processar_linha(row):
            link = row["GRAVAÇÃO"]
            call_id = str(row["ID"])
            atendente_nome = str(row[COLUNA_ATENDENTE.upper()])

            print(f"\n[INÍCIO] Processando ID: {call_id} | Atendente: {atendente_nome}")

            if not isinstance(link, str) or not link.startswith("http"):
                print(f"[SKIP] ID {call_id} inválido: {link}")
                return None

            nome_arquivo = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
            loop = asyncio.get_event_loop()

            resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo))
            if resultado_download is not True:
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": resultado_download}

            duracao = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo))
            if duracao < 30:
                os.remove(nome_arquivo)
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": "Áudio muito curto (<30s)"}

            transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio, nome_arquivo))
            os.remove(nome_arquivo)

            if transcricao_texto.startswith("ERRO na Transcrição"):
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": transcricao_texto}
            elif len(transcricao_texto) < LIMITE_TRANSCRICAO_CURTA:
                resumo_curto = transcricao_texto.replace('\n', ' ').strip()[:70] + "..."
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": f"CURTA: {resumo_curto}"}
            else:
                return {"LONGO": {"ID": call_id, "ATENDENTE": atendente_nome, "LINK": link, "TRANSCRICAO": transcricao_texto}}

        SEMAFORO = asyncio.Semaphore(5)
        async def sem_task(row):
            async with SEMAFORO:
                return await processar_linha(row)

        tasks = [sem_task(row) for _, row in df.iterrows()]
        resultados = await asyncio.gather(*tasks)

        for r in resultados:
            if r is None:
                continue
            if "LONGO" in r:
                resultados_longos.append(r["LONGO"])
            else:
                resultados_curtos_resumo.append(r)

        # ---- Geração do PDF com fpdf2 ----
        pdf = FPDF(orientation='P', unit='mm', format='A4')
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Adiciona fonte TTF Unicode (acentuação)
        font_path = os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf")
        if not os.path.exists(font_path):
            raise RuntimeError(f"Arquivo de fonte não encontrado: {font_path}")
        pdf.add_font("DejaVu", "", font_path, uni=True)

        for item in resultados_longos:
            pdf.add_page()
            pdf.set_font("DejaVu", "", 12)
            pdf.multi_cell(0, 5, f"ID: {item['ID']}\nAtendente: {item['ATENDENTE']}\nLink: {item['LINK']}\n\nTranscrição:\n{item['TRANSCRICAO']}")

        if resultados_curtos_resumo:
            pdf.add_page()
            pdf.set_font("DejaVu", "", 12)
            pdf.multi_cell(0, 5, "Resumo de transcrições curtas:\n")
            for r in resultados_curtos_resumo:
                pdf.multi_cell(0, 5, f"ID: {r['ID']} | Atendente: {r['ATENDENTE']} | Status: {r['STATUS']}")

        pdf_output = pdf.output(dest='S').encode('latin1')

        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERRO FATAL] {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no processamento: {str(e)}")
    finally:
        if os.path.exists(PASTA_TEMP):
            shutil.rmtree(PASTA_TEMP)
            print("[TEMP] Pasta temporária removida")
