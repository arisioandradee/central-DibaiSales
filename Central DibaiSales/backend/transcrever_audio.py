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
from google import genai
from dotenv import load_dotenv
import asyncio
from functools import partial

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada. Verifique seu arquivo .env")

# ------------------ CONFIGURAÇÕES ------------------
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"

router = APIRouter()

# ------------------ CLASSE PDF ------------------
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

    def write_long_transcription_block(self, call_id: str, atendente: str, link: str, transcricao: str):
        print(f"[PDF] Adicionando transcrição longa para ID: {call_id}")
        self.set_font("Arial", "B", 14)
        self.set_text_color(20, 20, 20)
        self.cell(0, 8, f"ID: {call_id}", 0, 1, "L")
        self.ln(1)

        self.set_font("Arial", "I", 10)
        self.set_text_color(80, 80, 80)
        self.cell(0, 5, f"Atendente: {atendente}", 0, 1, "L")
        self.multi_cell(0, 5, f"Link: {link}", 0, "L")
        self.ln(5)

        self.set_font("Arial", "", 10)
        self.set_text_color(0, 0, 0)
        self.multi_cell(0, 5, transcricao)
        self.ln(10)

    def _draw_summary_header(self, W_ID, W_ATENDENTE, W_STATUS, LINE_HEIGHT):
        self.set_font("Arial", "B", 10)
        self.set_fill_color(240, 240, 240)
        self.cell(W_ID, LINE_HEIGHT, "ID", 1, 0, "C", fill=True)
        self.cell(W_ATENDENTE, LINE_HEIGHT, "ATENDENTE", 1, 0, "C", fill=True)
        self.cell(W_STATUS, LINE_HEIGHT, "STATUS / RESUMO", 1, 1, "C", fill=True)
        self.set_font("Arial", "", 9)
        self.set_text_color(0, 0, 0)
        
    def write_summary_block(self, curtas: list[dict]):
        print("[PDF] Adicionando resumo de chamadas curtas/falhas")
        self.add_page()
        self.set_font("Arial", "B", 18)
        self.set_text_color(200, 40, 40)
        self.cell(0, 10, "Resumo de Chamadas Curtas ou Falhas", 0, 1, "C")
        self.ln(10)

        W_ID = 35
        W_ATENDENTE = 40
        W_STATUS = 125
        LINE_HEIGHT = 6
        
        self.set_fill_color(240, 240, 240)
        self._draw_summary_header(W_ID, W_ATENDENTE, W_STATUS, LINE_HEIGHT)
        
        PB_TRIGGER = self.page_break_trigger 
        MIN_ROW_HEIGHT = LINE_HEIGHT * 3 

        for item in curtas:
            status_text = item["STATUS"]
            if self.get_y() + MIN_ROW_HEIGHT > PB_TRIGGER:
                self.add_page()
                self._draw_summary_header(W_ID, W_ATENDENTE, W_STATUS, LINE_HEIGHT)
                
            start_y = self.get_y()
            start_x = self.get_x()

            self.set_xy(start_x + W_ID + W_ATENDENTE, start_y)
            self.multi_cell(W_STATUS, LINE_HEIGHT, status_text, 0, "L")
            end_y = self.get_y()
            final_height = max(LINE_HEIGHT, end_y - start_y) 
            v_offset = (final_height - LINE_HEIGHT) / 2

            self.set_xy(start_x, start_y)
            self.cell(W_ID, final_height, "", 1, 0)
            self.set_xy(start_x, start_y + v_offset)
            self.cell(W_ID, LINE_HEIGHT, item["ID"], 0, 0, "C")

            self.set_xy(start_x + W_ID, start_y)
            self.cell(W_ATENDENTE, final_height, "", 1, 0)
            self.set_xy(start_x + W_ID, start_y + v_offset)
            self.cell(W_ATENDENTE, LINE_HEIGHT, item["ATENDENTE"], 0, 0, "C")

            self.set_xy(start_x + W_ID + W_ATENDENTE, start_y)
            self.cell(W_STATUS, final_height, "", 1, 1, "L")
            self.set_y(end_y)

# ------------------ FUNÇÕES AUXILIARES ------------------
def baixar_audio(link_gravacao, nome_arquivo_saida):
    try:
        print(f"[DOWNLOAD] Baixando áudio: {link_gravacao}")
        r = requests.get(link_gravacao, stream=True, timeout=30)
        if r.status_code == 200:
            with open(nome_arquivo_saida, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            print(f"[DOWNLOAD] Sucesso: {nome_arquivo_saida}")
            return True
        print(f"[DOWNLOAD] Falha HTTP {r.status_code}")
        return f"Erro: HTTP {r.status_code}"
    except Exception as e:
        print(f"[DOWNLOAD] Erro: {e}")
        return f"Erro de conexão: {str(e)}"

def duracao_audio_segundos(caminho):
    try:
        audio = MutagenFile(caminho)
        if audio is None or not hasattr(audio, "info"):
            return 0
        return audio.info.length
    except Exception:
        return 0

def transcrever_audio(caminho):
    try:
        uploaded_file = client_gemini.files.upload(file=caminho)
        response = client_gemini.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                f"""
                Transcreva o áudio completo em Português do Brasil.
                Identifique os locutores pelo nome real se possível.
                Formate como diálogo assim: "Nome: fala do participante".
                Evite linhas longas e remova espaços extras desnecessários.
                """,
                uploaded_file
            ]
        )
        texto = response.text.strip()
        client_gemini.files.delete(name=uploaded_file.name)
        return texto
    except Exception as e:
        print(f"[TRANSCRICAO] Erro: {e}")
        return f"ERRO na Transcrição: {type(e).__name__}: {str(e)}"

# ------------------ ENDPOINT ------------------
@router.post("/transcrever_audios")
async def transcrever_audios_endpoint(file: UploadFile = File(...)):
    print("[API] Recebendo arquivo Excel...")
    resultados_longos = []
    resultados_curtos_resumo = []

    os.makedirs(PASTA_TEMP, exist_ok=True)

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()
        print(f"[API] Excel carregado com {len(df)} linhas")

        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(status_code=400, detail=f"O Excel deve conter as colunas 'GRAVAÇÃO', 'ID' e '{COLUNA_ATENDENTE}'.")

        global client_gemini
        client_gemini = genai.Client(api_key=GEMINI_API_KEY)
        client_gemini.models.list()
        print("[API] Conexão com Gemini OK")

        # ------------------ PROCESSAMENTO DE LINHAS ------------------
        async def processar_linha(row):
            link = row["GRAVAÇÃO"]
            call_id = str(row["ID"])
            atendente_nome = str(row[COLUNA_ATENDENTE.upper()])

            if not isinstance(link, str) or not link.startswith("http"):
                print(f"[SKIP] Linha {row['ID']} inválida: {link}")
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

        # ---- Geração do PDF ----
        print("[PDF] Gerando PDF final...")
        pdf = PDF(orientation='P', unit='mm', format='A4')
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=15)

        for item in resultados_longos:
            pdf.add_page()
            pdf.write_long_transcription_block(
                call_id=item["ID"],
                atendente=item["ATENDENTE"],
                link=item["LINK"],
                transcricao=item["TRANSCRICAO"]
            )

        if resultados_curtos_resumo:
            pdf.write_summary_block(resultados_curtos_resumo)

        pdf_output = pdf.output(dest='S').encode('latin1')
        print("[PDF] PDF gerado com sucesso!")

        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"}
        )

    finally:
        if os.path.exists(PASTA_TEMP):
            shutil.rmtree(PASTA_TEMP)
            print("[TEMP] Pasta temporária removida")
