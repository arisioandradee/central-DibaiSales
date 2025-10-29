import io
import zipfile
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse

router = APIRouter()

# Template do prompt
PROMPT_TEMPLATE = (
    'Angela-Dibai Sales. OBJETIVO: Confirmar se número é de {name} ({business}). '
    'ABERTURA: Olá! Angela da Dibai Sales. Este número é de {name} da {business}? '
    'CENÁRIOS: A)Sim=Silêncio+Log CONFIRMADO. '
    'B)Não=Desculpe+Log ERRADO. '
    'C)Conheço=Pedir número de {name}+Log NOVO. '
    'D)Quem é?=Yasmin sobre marketing {business}.'
)

def formatar_telefone(numero: str) -> str:
    if not numero or str(numero).strip() == '':
        return ''
    numero = str(numero).strip()
    if not numero.startswith('55') and not numero.startswith('55'):
        numero = f'55{numero}'
    numero = numero.replace(' ', '').replace('-', '')
    return numero

@router.post("/extrator-numero")
async def extrair_contatos_endpoint(file: UploadFile = File(...)):
    filename = file.filename.lower()
    conteudo = await file.read()
    buffer = io.BytesIO(conteudo)

    # Lê o arquivo Excel
    if filename.endswith(('.xlsx', '.xls')):
        planilhas = pd.read_excel(buffer, dtype=str, sheet_name=None)

        if "main" in planilhas:
            df = planilhas["main"]
            aba_usada = "main"
        else:
            primeira_aba = list(planilhas.keys())[0]
            df = planilhas[primeira_aba]
            aba_usada = primeira_aba
    else:
        raise HTTPException(status_code=400, detail="Arquivo não suportado. Envie um arquivo Excel (.xlsx ou .xls).")

    dfs = []

    # Processa cada conjunto de colunas SOCIOx
    for i in range(1, 4):
        nome_col = f"SOCIO{i}Nome"
        cel1_col = f"SOCIO{i}Celular1"
        cel2_col = f"SOCIO{i}Celular2"

        if nome_col in df.columns:
            sub_df = df[df[nome_col].notna() & (df[nome_col].str.strip() != '')][[nome_col]].copy()
            sub_df.rename(columns={nome_col: 'name'}, inplace=True)

            if cel1_col in df.columns:
                sub_df['phone_number'] = df.loc[sub_df.index, cel1_col].fillna('')
            else:
                sub_df['phone_number'] = ''

            if cel2_col in df.columns:
                sub_df['phone_number'] = sub_df['phone_number'].mask(
                    sub_df['phone_number'].str.strip() == '',
                    df.loc[sub_df.index, cel2_col].fillna('')
                )

            sub_df['phone_number'] = sub_df['phone_number'].apply(formatar_telefone)
            sub_df['business'] = df.iloc[sub_df.index, 1].fillna('')

            sub_df['prompt'] = sub_df.apply(
                lambda row: PROMPT_TEMPLATE.format(name=row['name'], business=row['business']),
                axis=1
            )

            sub_df = sub_df[['name', 'phone_number', 'business', 'prompt']]

            dfs.append((f"socio{i}.xlsx", sub_df))

    if not dfs:
        raise HTTPException(status_code=400, detail=f"Nenhum número encontrado na aba '{aba_usada}'.")

    # Cria o ZIP com arquivos Excel (.xlsx)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        for name, sub_df in dfs:
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine="xlsxwriter") as writer:
                sub_df.to_excel(writer, index=False, sheet_name="Contatos")
            excel_buffer.seek(0)
            zipf.writestr(name, excel_buffer.read())

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="socios_contatos_{aba_usada}.zip"'}
    )
