import io
import re
from datetime import datetime

import numpy as np
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.responses import StreamingResponse

router = APIRouter()

# --- Funções auxiliares ---
def converter_para_faixa_funcionarios(qtde):
    if pd.isna(qtde):
        return None
    try:
        qtde = int(qtde)
    except (ValueError, TypeError):
        return None
    if qtde == 0:
        return "0"
    elif 1 <= qtde <= 5:
        return "1 a 5"
    elif 6 <= qtde <= 10:
        return "6 a 10"
    elif 11 <= qtde <= 50:
        return "11 a 50"
    elif 51 <= qtde <= 100:
        return "51 a 100"
    elif 101 <= qtde <= 500:
        return "101 a 500"
    elif qtde > 500:
        return "Acima de 501"
    else:
        return None

def calcular_idade_empresa(data_abertura):
    if pd.isna(data_abertura):
        return None
    try:
        if isinstance(data_abertura, str):
            data_abertura = pd.to_datetime(data_abertura, errors='coerce', dayfirst=True)
        if pd.isna(data_abertura):
            return None
        hoje = datetime.now()
        idade = hoje.year - data_abertura.year - ((hoje.month, hoje.day) < (data_abertura.month, data_abertura.day))
        if idade < 1:
            return 'menos de 1 ano'
        elif idade == 1:
            return '1 ano'
        else:
            return f'mais de {idade} anos'
    except Exception:
        return None

def formatar_telefone(valor):
    if pd.isna(valor):
        return None
    s = str(valor).strip()
    if s.endswith('.0'):
        s = s[:-2]
    s_limpo = re.sub(r'\D', '', s)
    return s_limpo if s_limpo else None

# --- Colunas de saída ---
COLUNAS_SAIDA = [
    'CNPJ', 'Nome do Lead', 'Nome Fantasia', 'Observação', 'Origem', 'Mercado', 
    'Site', 'Rede Social', 'E-mails Válidos de Decisores', 'Estado', 'Cidade', 
    'Logradouro', 'Número', 'Bairro', 'Complemento', 'CEP', 'Telefones', 
    'Faixa de Faturamento da Unidade CNPJ', 'Faixa de Funcionários da Empresa', 
    'Data de Abertura', 'Idade da Empresa', 'Linkedln'
]

for i in range(1, 4):
    COLUNAS_SAIDA += [
        f'SOCIO{i}Nome', f'SOCIO{i}Email1', f'SOCIO{i}Email2', 
        f'SOCIO{i}Celular1', f'SOCIO{i}Celular2', f'SOCIO{i}Linkedin', 
        ' ' * i
    ]

@router.post("/speedio_assertiva")
async def speedio_assertiva(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename.lower()

        # --- Lê Excel ou CSV corretamente ---
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use .xlsx, .xls ou .csv")

        df.columns = df.columns.str.strip()

        # --- Inicializa DataFrame de saída ---
        df_saida = pd.DataFrame(columns=COLUNAS_SAIDA)

        # --- Mapeamento de colunas principais ---
        df_saida['CNPJ'] = df.get('CNPJ').astype(str).str.strip() if 'CNPJ' in df.columns else ''
        df_saida['Nome do Lead'] = df.get('Razao', '')
        df_saida['Nome Fantasia'] = df.get('Fantasia', '')
        df_saida['Estado'] = df.get('UF', '')
        df_saida['Cidade'] = df.get('Cidade', '')
        df_saida['Logradouro'] = df.get('Logradouro', '')
        df_saida['Número'] = df.get('Numero', '')
        df_saida['Bairro'] = df.get('Bairro', '')
        df_saida['Complemento'] = df.get('Complemento', '')
        df_saida['CEP'] = df.get('CEP', '')
        df_saida['Data de Abertura'] = pd.to_datetime(df.get('DataAbertura'), errors='coerce', dayfirst=True).dt.strftime('%d/%m/%Y')
        df_saida['Mercado'] = df.get('CNAEDescricao', '').astype(str).replace('False', '').replace('nan', '')
        df_saida['Faixa de Funcionários da Empresa'] = df.get('QtdeFuncionarios').apply(converter_para_faixa_funcionarios) if 'QtdeFuncionarios' in df.columns else ''
        df_saida['Idade da Empresa'] = df.get('DataAbertura').apply(calcular_idade_empresa) if 'DataAbertura' in df.columns else ''

        # --- Telefones ---
        cols_telefones = [col for col in df.columns if re.match(r'Telefone\d+', col)]
        if cols_telefones:
            telefones_formatados = df[cols_telefones].applymap(formatar_telefone)
            df_saida['Telefones'] = telefones_formatados.apply(lambda row: ', '.join(row.dropna().astype(str)), axis=1)
            df_saida['Telefones'] = df_saida['Telefones'].replace('', np.nan)

        # --- Emails ---
        cols_emails = [col for col in df.columns if re.match(r'Email\d+', col)]
        if cols_emails:
            emails = df[cols_emails].astype(str).replace('nan', '', regex=True)
            df_saida['E-mails Válidos de Decisores'] = emails.apply(
                lambda row: ', '.join(row.str.strip().replace('', np.nan).dropna()), axis=1
            )
            df_saida['E-mails Válidos de Decisores'] = df_saida['E-mails Válidos de Decisores'].replace('', np.nan)

        # --- Sócios ---
        for i in range(1, 4):
            df_saida[f'SOCIO{i}Nome'] = df.get(f'SOCIO{i}Nome', np.nan)
            for j in [1, 2]:
                df_saida[f'SOCIO{i}Email{j}'] = df.get(f'SOCIO{i}Email{j}', np.nan) if f'SOCIO{i}Email{j}' in df.columns else np.nan
                df_saida[f'SOCIO{i}Celular{j}'] = df.get(f'SOCIO{i}Celular{j}').apply(formatar_telefone) if f'SOCIO{i}Celular{j}' in df.columns else np.nan
            df_saida[f'SOCIO{i}Linkedin'] = np.nan
            df_saida[' ' * i] = np.nan

        # --- Cabeçalhos secundários ---
        SECOND_HEADER_LABELS = COLUNAS_SAIDA.copy()
        for idx, col in enumerate(SECOND_HEADER_LABELS):
            if 'Nome do Lead' in col:
                SECOND_HEADER_LABELS[idx] = 'Razão Social'
            elif 'Nome Fantasia' in col:
                SECOND_HEADER_LABELS[idx] = 'Nome Fantasia'
            elif 'Telefones' in col:
                SECOND_HEADER_LABELS[idx] = 'Telefones Válidos'
            elif 'E-mails Válidos de Decisores' in col:
                SECOND_HEADER_LABELS[idx] = 'Todos E-mails'

        # --- Geração do Excel ---
        buffer_saida = io.BytesIO()
        with pd.ExcelWriter(buffer_saida, engine='xlsxwriter') as writer:
            df_saida.to_excel(writer, sheet_name='Sheet1', index=False, header=False, startrow=2)
            worksheet = writer.sheets['Sheet1']
            for col_num, value in enumerate(COLUNAS_SAIDA):
                worksheet.write(0, col_num, value)
            for col_num, value in enumerate(SECOND_HEADER_LABELS):
                worksheet.write(1, col_num, value)

        buffer_saida.seek(0)
        return StreamingResponse(
            buffer_saida,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=Speedio_Assertiva_Unificado.xlsx"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {type(e).__name__}: {str(e)}")
