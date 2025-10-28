import os
import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from google.generativeai import configure, GenerativeModel
from fpdf import FPDF

# Configurar o Gemini
configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = GenerativeModel("gemini-1.5-flash")

router = APIRouter()

@router.post("/transcrever_audios")
async def transcrever_audios(file: UploadFile = File(...)):
    try:
        print("[API] Recebendo arquivo Excel:", file.filename)

        # Ler o Excel recebido
        df = pd.read_excel(file.file)

        # Filtrar apenas linhas válidas com IDs
        df = df.dropna(subset=["ID"])
        print(f"[API] Excel filtrado com {len(df)} linhas válidas.")

        resultados_longos = []
        resultados_curtos_resumo = []

        # Iterar sobre cada linha
        for _, row in df.iterrows():
            id_val = str(row.get("ID", "")).strip()
            atendente = str(row.get("ATENDENTE", "")).strip()
            link = str(row.get("LINK", "")).strip()

            if not id_val or id_val.lower() == "nan":
                print(f"[SKIP] ID inválido: {id_val}")
                continue

            print(f"[INÍCIO] Processando ID: {id_val} | Atendente: {atendente}")

            try:
                # Chamar Gemini para gerar a transcrição
                prompt = f"""
                Você é um assistente que gera transcrições de áudios.
                Gere uma transcrição resumida e clara para o atendente {atendente}.
                Se o áudio não puder ser acessado, retorne: 'Não foi possível processar este áudio'.
                Link do áudio: {link}
                """

                resposta = model.generate_content(prompt)
                texto_transcrito = (
                    resposta.text.strip()
                    if hasattr(resposta, "text") and resposta.text
                    else "Não foi possível processar o áudio."
                )

                # Se a resposta for muito curta, vai para o resumo
                if len(texto_transcrito) < 30:
                    resultados_curtos_resumo.append({
                        "ID": id_val,
                        "ATENDENTE": atendente,
                        "STATUS": texto_transcrito
                    })
                else:
                    resultados_longos.append({
                        "ID": id_val,
                        "ATENDENTE": atendente,
                        "LINK": link,
                        "TRANSCRICAO": texto_transcrito
                    })

            except Exception as e:
                print(f"[ERRO] Falha ao processar {id_val}: {e}")
                resultados_curtos_resumo.append({
                    "ID": id_val,
                    "ATENDENTE": atendente,
                    "STATUS": f"Erro: {e}"
                })
                continue

        # ---- Geração do PDF (corrigido e otimizado) ----
        pdf = FPDF(orientation='P', unit='mm', format='A4')
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_font("Helvetica", size=11)

        largura_util = 180  # margem segura entre bordas

        # Adiciona transcrições longas
        for item in resultados_longos:
            pdf.add_page()
            pdf.multi_cell(largura_util, 6, f"ID: {item['ID']}")
            pdf.multi_cell(largura_util, 6, f"Atendente: {item['ATENDENTE']}")
            pdf.multi_cell(largura_util, 6, f"Link: {item['LINK']}")
            pdf.ln(5)
            pdf.multi_cell(largura_util, 6, "Transcrição:")
            pdf.multi_cell(largura_util, 6, item['TRANSCRICAO'])
            pdf.ln(10)

        # Adiciona resumo de erros e respostas curtas
        if resultados_curtos_resumo:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(largura_util, 8, "Resumo de transcrições curtas / erros:\n")
            pdf.set_font("Helvetica", size=11)
            for r in resultados_curtos_resumo:
                texto_curto = (
                    f"ID: {r['ID']} | Atendente: {r['ATENDENTE']} | Status: {r['STATUS']}"
                )
                pdf.multi_cell(largura_util, 6, texto_curto)
                pdf.ln(2)

        # Exportar PDF para memória
        pdf_output = pdf.output(dest='S').encode('latin1', errors='replace')

        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=transcricoes_relatorio.pdf"
            },
        )

    except Exception as e:
        print(f"[ERRO FATAL] {e}")
        return {"erro": f"Erro interno no processamento: {e}"}
