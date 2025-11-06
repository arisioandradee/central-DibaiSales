import os
import io
import time
import shutil
import requests
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse
from fpdf import FPDF
from mutagen import File as MutagenFile
import google.generativeai as genai
from dotenv import load_dotenv
import asyncio
from functools import partial
import mimetypes
import zipfile

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada. Verifique seu arquivo .env")

genai.configure(api_key=GEMINI_API_KEY)
print("[API] Conexão com Gemini OK")

# ------------------ CONFIGURAÇÕES ------------------
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"

router = APIRouter()

# ------------------ CLASSE PDF TRANSCRIÇÕES ------------------
class PDF(FPDF):
    def header(self):
        self.set_fill_color(220, 220, 220)
        self.set_font("Arial", "B", 10)
        self.set_text_color(40, 40, 40)
        self.cell(0, 7, "Central Dibai Sales - Relatório de Transcrições", 0, 1, "C", fill=True)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Página {self.page_no()}/{{nb}}", 0, 0, "C")

    def write_long_transcription_block(self, call_id, atendente, link, transcricao):
        self.set_font("Arial", "B", 14)
        self.cell(0, 8, f"ID: {call_id}", 0, 1, "L")
        self.set_font("Arial", "I", 10)
        self.cell(0, 6, f"Atendente: {atendente}", 0, 1, "L")
        self.multi_cell(0, 5, f"Link: {link}", 0, "L")
        self.ln(5)
        self.set_font("Arial", "", 10)
        self.multi_cell(0, 5, transcricao)
        self.ln(10)

    def write_summary_block(self, curtas):
        self.add_page()
        self.set_font("Arial", "B", 18)
        self.set_text_color(200, 40, 40)
        self.cell(0, 10, "Resumo de Chamadas Curtas ou Falhas", 0, 1, "C")
        self.ln(10)

        self.set_font("Arial", "B", 10)
        self.set_fill_color(240, 240, 240)
        self.cell(35, 6, "ID", 1, 0, "C", fill=True)
        self.cell(40, 6, "ATENDENTE", 1, 0, "C", fill=True)
        self.cell(115, 6, "STATUS / RESUMO", 1, 1, "C", fill=True)

        self.set_font("Arial", "", 9)
        for item in curtas:
            self.cell(35, 6, item["ID"], 1)
            self.cell(40, 6, item["ATENDENTE"], 1)
            self.multi_cell(115, 6, item["STATUS"], 1)
        self.ln(5)

# ------------------ CLASSE PDF BANT ------------------
class PDF_BANT(FPDF):
    def header(self):
        self.set_fill_color(220, 235, 250)
        self.set_font("Arial", "B", 12)
        self.cell(0, 7, "Análise BANT - Central Dibai Sales", 0, 1, "C", fill=True)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.cell(0, 10, f"Página {self.page_no()}/{{nb}}", 0, 0, "C")

    def write_bant_analysis(self, call_id, atendente, bant_texto):
        self.add_page()
        self.set_font("Arial", "B", 12)
        self.cell(0, 8, f"ID: {call_id}", 0, 1, "L")
        self.set_font("Arial", "I", 10)
        self.cell(0, 6, f"Atendente: {atendente}", 0, 1, "L")
        self.ln(4)
        self.set_font("Arial", "", 10)
        self.multi_cell(0, 5, bant_texto)
        self.ln(8)

# ------------------ FUNÇÕES AUXILIARES ------------------
def baixar_audio(link_gravacao, nome_arquivo_saida):
    try:
        r = requests.get(link_gravacao, stream=True, timeout=30)
        if r.status_code == 200:
            with open(nome_arquivo_saida, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            return True
        return f"Erro: HTTP {r.status_code}"
    except Exception as e:
        return f"Erro de conexão: {e}"

def duracao_audio_segundos(caminho):
    try:
        audio = MutagenFile(caminho)
        return audio.info.length if audio and hasattr(audio, "info") else 0
    except Exception:
        return 0

def transcrever_audio(caminho):
    try:
        model = genai.GenerativeModel("models/gemini-2.5-pro")
        mime_type, _ = mimetypes.guess_type(caminho)
        if not mime_type:
            mime_type = "audio/mpeg"
        with open(caminho, "rb") as f:
            audio_bytes = f.read()
        response = model.generate_content(
            [
                {
                    "role": "user",
                    "parts": [
                        "Transcreva o áudio completo em Português (Brasil)...",
                        {"mime_type": mime_type, "data": audio_bytes},
                    ],
                }
            ]
        )
        return response.text.strip() if hasattr(response, "text") else ""
    except Exception as e:
        return f"ERRO: {str(e)}"

def gerar_bant_analise(transcricao_texto):
    try:
        model = genai.GenerativeModel("models/gemini-2.5-pro")
        prompt_bant = (
            "Você é um Consultor de Vendas Sênior e especialista na metodologia BANT..."
            "Analise a conversa abaixo e elabore uma análise BANT completa e estruturada.\n\n"
            f"--- TRANSCRIÇÃO ---\n{transcricao_texto}\n\n--- SAÍDA ---"
        )
        response = model.generate_content(prompt_bant)
        return response.text.strip() if hasattr(response, "text") else "Falha na análise BANT."
    except Exception as e:
        return f"ERRO BANT: {str(e)}"

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    resultados_longos = []
    resultados_curtos = []

    os.makedirs(PASTA_TEMP, exist_ok=True)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()

        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(status_code=400, detail="Excel deve conter 'GRAVAÇÃO', 'ID', 'ATENDENTE'.")

        async def processar_linha(row):
            link = str(link).strip()
            link, call_id, atendente = row["GRAVAÇÃO"], str(row["ID"]), str(row[COLUNA_ATENDENTE.upper()])
            if not link.startswith("http"):
                return None

            nome_arquivo = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
            loop = asyncio.get_event_loop()

            resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo))
            if resultado_download is not True:
                return {"ID": call_id, "ATENDENTE": atendente, "STATUS": resultado_download}

            duracao = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo))
            if duracao < 30:
                return {"ID": call_id, "ATENDENTE": atendente, "STATUS": "Áudio muito curto (<30s)"}

            transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio, nome_arquivo))
            os.remove(nome_arquivo)

            if not transcricao_texto or len(transcricao_texto) < LIMITE_TRANSCRICAO_CURTA:
                return {"ID": call_id, "ATENDENTE": atendente, "STATUS": "Transcrição curta"}
            else:
                return {"LONGO": {"ID": call_id, "ATENDENTE": atendente, "LINK": link, "TRANSCRICAO": transcricao_texto}}

        tasks = [processar_linha(row) for _, row in df.iterrows()]
        resultados = await asyncio.gather(*tasks)

        for r in resultados:
            if not r:
                continue
            if "LONGO" in r:
                resultados_longos.append(r["LONGO"])
            else:
                resultados_curtos.append(r)

        # PDF Transcrições
        pdf_transc = PDF()
        pdf_transc.alias_nb_pages()
        pdf_transc.set_auto_page_break(auto=True, margin=15)
        for item in resultados_longos:
            pdf_transc.add_page()
            pdf_transc.write_long_transcription_block(item["ID"], item["ATENDENTE"], item["LINK"], item["TRANSCRICAO"])
        if resultados_curtos:
            pdf_transc.write_summary_block(resultados_curtos)
        pdf_transc_output = os.path.join(PASTA_TEMP, "transcricoes.pdf")
        pdf_transc.output(pdf_transc_output)

        # PDF BANT
        pdf_bant = PDF_BANT()
        pdf_bant.alias_nb_pages()
        pdf_bant.set_auto_page_break(auto=True, margin=15)
        for item in resultados_longos:
            analise = await asyncio.get_event_loop().run_in_executor(None, partial(gerar_bant_analise, item["TRANSCRICAO"]))
            pdf_bant.write_bant_analysis(item["ID"], item["ATENDENTE"], analise)
        pdf_bant_output = os.path.join(PASTA_TEMP, "analise_bant.pdf")
        pdf_bant.output(pdf_bant_output)

        # ZIP final
        zip_path = os.path.join(PASTA_TEMP, "resultado.zip")
        with zipfile.ZipFile(zip_path, "w") as zipf:
            zipf.write(pdf_transc_output, "transcricoes.pdf")
            zipf.write(pdf_bant_output, "analise_bant.pdf")

        return StreamingResponse(
            open(zip_path, "rb"),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=resultado.zip"}
        )

    finally:
        if os.path.exists(PASTA_TEMP):
            shutil.rmtree(PASTA_TEMP)
