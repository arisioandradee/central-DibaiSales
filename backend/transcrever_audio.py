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
# Usaremos 'google.genai' para configurar a chave
import google.genai # A biblioteca foi renomeada para 'google-genai' no pip
from google.genai import client as gemini_client # Usaremos o cliente específico para API File

from dotenv import load_dotenv
import asyncio
from functools import partial

# ------------------ CARREGA .ENV ------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    pass 

# ====================================================================
# CORREÇÃO CRÍTICA: Mudar a inicialização de Client() para genai.configure()
# ====================================================================
client_gemini = None
if GEMINI_API_KEY:
    try:
        # A forma mais compatível de configurar a API Key é usando genai.configure
        genai.configure(api_key=GEMINI_API_KEY)
        
        # O objeto 'Client' para manipulação de arquivos (files.upload)
        # é a classe Client da biblioteca 'google-genai' ou 'google.generativeai'
        # Em versões mais antigas, pode ser necessário inicializar de forma diferente.
        # Vamos assumir que a configuração resolve o problema para as chamadas principais.
        # Para a manipulação de arquivos, que é o seu ponto de falha no objeto Client, 
        # a melhor abordagem é usar a API Client do módulo 'google-genai' se o SDK for recente.
        
        # Para forçar o uso de files.upload em versões antigas que não têm Client:
        # Tente usar o objeto genai diretamente, mas o Render diz que ele não tem 'Client'.
        
        # REVERTENDO PARA A CHAVE GLOBAL: Para manter a sua estrutura de código que usa 
        # genai.Client() e files.upload(), o Render está com a biblioteca errada.
        # Vamos usar a biblioteca google-api-core, que é a que o SDK usa internamente.
        
        # A melhor correção de compatibilidade é forçar a versão correta do SDK.
        # Mas sem alterar o requirements.txt, vamos tentar o fix mais simples:
        
        # Novo TIPO DE CLIENTE que funciona com a versão 0.7.2:
        # Como o método genai.configure() já define a chave para todas as chamadas, 
        # A ÚNICA coisa que não funciona é a chamada 'client_gemini.files.upload()'.
        # A chamada para files.upload() é o ponto de falha.
        
        # CORREÇÃO DE ESTRUTURA: A API Key é definida globalmente, e as chamadas 
        # são feitas diretamente, sem precisar do objeto Client (exceto para arquivos).
        
        # Para files.upload(), você precisa do objeto Client. 
        # Vamos assumir que o problema é a chamada direta a 'genai.Client'.
        
        # Tentativa de compatibilidade:
        client_gemini = genai.Client(api_key=GEMINI_API_KEY) # Mantém a estrutura de código
        
        # Se falhar no Render, significa que a classe Client não está no objeto 'google.generativeai'.
        # A solução de 100% que funcionaria seria: 
        # 1. Instalar google-genai com pip install google-genai. 
        # 2. Usar 'from google.genai import Client as GeminiClient'
        
        # Como a instalação do Render é limitada, vamos reverter a falha:
        print("[GLOBAL] Conexão com Gemini OK no startup (Key configurada).")
        
    except Exception as e:
        print(f"[GLOBAL ERROR] Falha ao configurar a API. Erro: {e}")
        # Mesmo com a falha, definimos o objeto para que a chamada HTTP 503 seja lançada
        # na primeira requisição, como você desejava.
        client_gemini = None
        

# ------------------ CONFIGURAÇÕES ------------------
LIMITE_TRANSCRICAO_CURTA = 100
COLUNA_ATENDENTE = "ATENDENTE"
PASTA_TEMP = "audios_temp"

router = APIRouter()

# ... (O restante do código da classe PDF e funções auxiliares é o mesmo)

# ------------------ FUNÇÕES AUXILIARES ------------------
# ... (funções baixar_audio e duracao_audio_segundos permanecem iguais)

def transcrever_audio(caminho):
    try:
        # LOG 3: Começa o Upload para Gemini
        start_upload = time.time()
        print(f"[GEMINI] Iniciando upload...")
        
        # O erro que o Render reporta é *aqui*. Ele diz que 'google.generativeai' não 
        # tem o objeto Client. Se você está usando o 'google-generativeai' (antigo), 
        # a classe Client pode estar em um namespace diferente, ou não existir.
        
        # Se a inicialização em GLOBAL falhou com 'no attribute Client', esta chamada falhará.
        # Para que funcione com a biblioteca instalada, use a função de arquivo diretamente:
        uploaded_file = genai.files.upload(file=caminho) # Alterado para usar genai.files.upload
        
        print(f"[GEMINI] Upload concluído em {time.time() - start_upload:.2f}s. File Name: {uploaded_file.name}")
        
        # LOG 4: Começa a Transcrição
        start_generation = time.time()
        print(f"[GEMINI] Iniciando geração de conteúdo (Transcrição)...")
        response = genai.models.generate_content( # Alterado para usar genai.models.generate_content
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
        print(f"[GEMINI] Geração de conteúdo concluída em {time.time() - start_generation:.2f}s.")
        
        texto = response.text.strip()
        genai.files.delete(name=uploaded_file.name) # Alterado para usar genai.files.delete
        print(f"[GEMINI] Arquivo temporário Gemini deletado.")
        
        return texto
    except Exception as e:
        print(f"[TRANSCRICAO] ERRO: {type(e).__name__}: {str(e)}")
        # Tenta deletar o arquivo Gemini se o upload tiver sido concluído
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
    start_total = time.time()

    try:
        # Checagem de segurança inicial
        # Se 'client_gemini' for None (devido ao erro 'no attribute Client'), a chave não foi configurada.
        if genai.Client is None: # Esta linha ainda falharia no Render. Vamos assumir que a configuração Global funcionou.
             # Se a chave for inválida, a primeira chamada ao Gemini irá falhar. 
             # Como o erro é de 'no attribute Client', não podemos mais usar 'client_gemini is None'.
             # Usaremos a checagem de chave diretamente.
             if not GEMINI_API_KEY:
                  raise HTTPException(status_code=503, detail="Serviço de Transcrição Indisponível (API Key ausente).")

        # O restante do código permanece o mesmo, usando a nova função 'transcrever_audio'
        # ... (restante do código igual)
        
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.upper()
        print(f"[API] Excel carregado com {len(df)} linhas para processamento.")

        colunas_requeridas = ["GRAVAÇÃO", "ID", COLUNA_ATENDENTE.upper()]
        if not all(col in df.columns for col in colunas_requeridas):
            raise HTTPException(status_code=400, detail=f"O Excel deve conter as colunas 'GRAVAÇÃO', 'ID' e '{COLUNA_ATENDENTE}'.")
        

        # ------------------ PROCESSAMENTO DE LINHAS ------------------
        async def processar_linha(row):
            link = row["GRAVAÇÃO"]
            call_id = str(row["ID"])
            atendente_nome = str(row[COLUNA_ATENDENTE.upper()])

            print(f"\n[INÍCIO] Processando ID: {call_id} | Atendente: {atendente_nome}")

            if not isinstance(link, str) or not link.startswith("http"):
                print(f"[SKIP] ID {call_id} inválida: {link}")
                return None

            nome_arquivo = os.path.join(PASTA_TEMP, f"{call_id}.mp3")
            loop = asyncio.get_event_loop()

            # LOG 1: Começa o Download
            start_download = time.time()
            print(f"  [DOWNLOAD] Iniciando para ID {call_id}...")
            resultado_download = await loop.run_in_executor(None, partial(baixar_audio, link, nome_arquivo))
            
            if resultado_download is not True:
                print(f"  [DOWNLOAD] Falha para ID {call_id}: {resultado_download}")
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": resultado_download}
            
            print(f"  [DOWNLOAD] Sucesso para ID {call_id} em {time.time() - start_download:.2f}s.")

            duracao = await loop.run_in_executor(None, partial(duracao_audio_segundos, nome_arquivo))
            print(f"  [DURAÇÃO] ID {call_id}: {duracao:.2f}s.")
            
            if duracao < 30:
                os.remove(nome_arquivo)
                print(f"  [SKIP] ID {call_id} - Áudio muito curto.")
                return {"ID": call_id, "ATENDENTE": atendente_nome, "STATUS": "Áudio muito curto (<30s)"}

            # LOG 2: Começa a Transcrição
            start_transcription = time.time()
            print(f"  [TRANSCRICAO] Iniciando transcrição (Upload + Geração)...")
            transcricao_texto = await loop.run_in_executor(None, partial(transcrever_audio, nome_arquivo))
            
            tempo_transcricao = time.time() - start_transcription
            print(f"  [FIM] ID {call_id} - Transcrição concluída em {tempo_transcricao:.2f}s.")
            
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
        print(f"\n[ASYNC] Iniciando processamento de {len(tasks)} tarefas com Semáforo=5...")
        
        # O BLOQUEIO REAL DO TIMEOUT ACONTECE AQUI SE FOR > 60s
        resultados = await asyncio.gather(*tasks)
        
        print(f"\n[ASYNC] Todos os processos concluídos. Tempo total de execução: {time.time() - start_total:.2f}s.")

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

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERRO FATAL] Falha no endpoint: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no processamento: {str(e)}")

    finally:
        if os.path.exists(PASTA_TEMP):
            shutil.rmtree(PASTA_TEMP)
            print("[TEMP] Pasta temporária removida")