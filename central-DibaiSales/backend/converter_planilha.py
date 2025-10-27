import io
import re
import zipfile
import pandas as pd
import xlsxwriter
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from starlette.responses import StreamingResponse
from datetime import datetime

router = APIRouter()

# ==== Funções auxiliares ====
def separar_redes_sociais(series_redes: pd.Series):
    links_instagram, links_facebook = [], []
    instagram_pattern = re.compile(r'(instagram\.com/[^\s,]+)', re.IGNORECASE)
    facebook_pattern = re.compile(r'(facebook\.com/[^\s,]+)', re.IGNORECASE)
    for redes_str in series_redes.fillna(''):
        partes = redes_str.split(',')
        insta_encontrado, face_encontrado = '', ''
        for parte in partes:
            parte = parte.strip()
            if not insta_encontrado and (m := instagram_pattern.search(parte)):
                insta_encontrado = 'http://' + m.group(1).lower()
            if not face_encontrado and (m := facebook_pattern.search(parte)):
                face_encontrado = 'http://' + m.group(1).lower()
            if insta_encontrado and face_encontrado:
                break
        links_instagram.append(insta_encontrado)
        links_facebook.append(face_encontrado)
    return pd.Series(links_facebook), pd.Series(links_instagram)


def limpar_numero_endereco(series: pd.Series) -> pd.Series:
    series = series.astype(str).str.upper().str.strip()
    series_limpa = series.str.replace(r'[^0-9]', '', regex=True)
    series_limpa = series_limpa.apply(lambda x: '0' if len(x) > 15 and x.isdigit() else x)
    return series_limpa.replace(r'^\s*$', '0', regex=True).fillna('0')


# === MAPA EMPRESA ===
MAPA_EMPRESA = {
    'Nome': 'Nome do Lead',
    'CNPJ': 'CNPJ',
    'Razão Social': 'Nome do Lead',
    'Categoria': 'Observação',
    'Origem': 'Outbound',
    'Usuário responsável': 'Vazio',
    'Setor': 'Vazio',
    'Descrição': 'Vazio',
    'E-mail': 'E-mails Válidos de Decisores',
    'WhatsApp': 'Vazio',
    'Telefone': 'Telefones',
    'Celular': 'Vazio',
    'Fax': 'Vazio',
    'Ramal': 'Vazio',
    'Website': 'Vazio',
    'CEP': 'CEP',
    'País': 'Brasil',
    'Estado': 'Estado',
    'Cidade': 'Cidade',
    'Bairro': 'Bairro',
    'Rua': 'Logradouro',
    'Número': 'Número',
    'Complemento': 'Complemento',
    'Produto': 'Vazio',
    'Facebook': 'Vazio',
    'Twitter': 'Vazio',
    'LinkedIn': 'Vazio',
    'Skype': 'Vazio',
    'Instagram': 'Vazio',
    'Ranking': 'Vazio'
}


# === COLUNAS NEGÓCIOS ===
COLUNAS_NEGOCIOS = [
    'Título do negócio', 'Empresa relacionada', 'Pessoa relacionada', 'Usuário responsável',
    'Data de início', 'Data de conclusão', 'Valor Total', 'Funil', 'Etapa', 'Status',
    'Motivo de perda', 'Descrição do motivo de perda', 'Ranking', 'Descrição', 'Produtos e Serviços'
]


# === COLUNAS PESSOAS ===
COLUNAS_PESSOAS = [
    'Nome', 'CPF', 'Empresa', 'Cargo', 'Aniversário', 'Ano de nascimento',
    'Usuário responsável', 'Categoria', 'Origem', 'Descrição', 'E-mail', 'WhatsApp',
    'Telefone', 'Celular', 'Fax', 'Ramal', 'CEP', 'País', 'Estado', 'Cidade', 'Bairro',
    'Rua', 'Número', 'Complemento', 'Produto', 'Rede Social', 'Twitter', 'LinkedIn',
    'Skype', 'Instagram', 'Ranking'
]


def converter_planilha(df_original: pd.DataFrame, funil: str, usuario: str):
    df_original = df_original.fillna('')

    # === EMPRESAS ===
    df_empresa = pd.DataFrame()
    for col_saida, col_entrada in MAPA_EMPRESA.items():
        if col_entrada in df_original.columns:
            df_empresa[col_saida] = df_original[col_entrada]
        elif col_entrada == 'Brasil':
            df_empresa[col_saida] = 'Brasil'
        elif col_entrada == 'Outbound':
            df_empresa[col_saida] = 'Outbound'
        else:
            df_empresa[col_saida] = ''
    df_empresa['Usuário responsável'] = usuario
    df_empresa['Número'] = limpar_numero_endereco(df_empresa['Número'])
    df_empresa['Categoria'] = 'Cliente em potencial'
    df_facebook, df_instagram = separar_redes_sociais(df_original['Rede Social'])
    df_empresa['Facebook'], df_empresa['Instagram'] = df_facebook, df_instagram

    # === NEGÓCIOS ===
    df_negocios = pd.DataFrame(columns=COLUNAS_NEGOCIOS)
    df_negocios['Empresa relacionada'] = df_empresa['Nome']
    df_negocios['Título do negócio'] = df_empresa['Nome']
    df_negocios['Usuário responsável'] = usuario
    df_negocios['Data de início'] = datetime.today().strftime('%d/%m/%Y')
    df_negocios['Funil'] = funil
    df_negocios['Etapa'] = 'Em andamento'
    df_negocios['Status'] = 'Aberto'

    # === PESSOAS (SÓCIOS) ===
    pessoas = {}
    for i in [1, 2, 3]:
        nome_col = f'SOCIO{i}Nome'
        cpf_col = f'SOCIO{i}CPF'
        cargo_col = f'SOCIO{i}Cargo'
        aniversario_col = f'SOCIO{i}Aniversario'
        ano_col = f'SOCIO{i}AnoNascimento'
        email_col = f'SOCIO{i}Email1'
        whatsapp_col = f'SOCIO{i}WhatsApp'
        telefone_col = f'SOCIO{i}Telefone'
        celular_col = f'SOCIO{i}Celular1'
        linkedin_col = f'SOCIO{i}Linkedin'
        instagram_col = f'SOCIO{i}Instagram'
        twitter_col = f'SOCIO{i}Twitter'
        skype_col = f'SOCIO{i}Skype'

        if nome_col in df_original.columns:
            df_filtrado = df_original[df_original[nome_col].str.strip() != '']
            if not df_filtrado.empty:
                df_pessoa = pd.DataFrame(columns=COLUNAS_PESSOAS)
                df_pessoa['Nome'] = df_filtrado[nome_col]
                df_pessoa['CPF'] = df_filtrado[cpf_col] if cpf_col in df_filtrado.columns else ''
                df_pessoa['Empresa'] = df_filtrado['Nome do Lead'] if 'Nome do Lead' in df_filtrado.columns else ''
                df_pessoa['Cargo'] = df_filtrado[cargo_col] if cargo_col in df_filtrado.columns else ''
                df_pessoa['Aniversário'] = df_filtrado[aniversario_col] if aniversario_col in df_filtrado.columns else ''
                df_pessoa['Ano de nascimento'] = df_filtrado[ano_col] if ano_col in df_filtrado.columns else ''
                df_pessoa['Usuário responsável'] = usuario
                df_pessoa['Categoria'] = 'Cliente em potencial'
                df_pessoa['Origem'] = 'Outbound'
                df_pessoa['Descrição'] = ''
                df_pessoa['E-mail'] = df_filtrado[email_col] if email_col in df_filtrado.columns else ''
                df_pessoa['WhatsApp'] = df_filtrado[whatsapp_col] if whatsapp_col in df_filtrado.columns else ''
                df_pessoa['Telefone'] = df_filtrado[telefone_col] if telefone_col in df_filtrado.columns else ''
                df_pessoa['Celular'] = df_filtrado[celular_col] if celular_col in df_filtrado.columns else ''
                df_pessoa['Fax'] = ''
                df_pessoa['Ramal'] = ''
                df_pessoa['CEP'] = df_filtrado['CEP'] if 'CEP' in df_filtrado.columns else ''
                df_pessoa['País'] = 'Brasil'
                df_pessoa['Estado'] = df_filtrado['Estado'] if 'Estado' in df_filtrado.columns else ''
                df_pessoa['Cidade'] = df_filtrado['Cidade'] if 'Cidade' in df_filtrado.columns else ''
                df_pessoa['Bairro'] = df_filtrado['Bairro'] if 'Bairro' in df_filtrado.columns else ''
                df_pessoa['Rua'] = df_filtrado['Logradouro'] if 'Logradouro' in df_filtrado.columns else ''
                df_pessoa['Número'] = df_filtrado['Número'] if 'Número' in df_filtrado.columns else ''
                df_pessoa['Complemento'] = df_filtrado['Complemento'] if 'Complemento' in df_filtrado.columns else ''
                df_pessoa['Produto'] = ''
                df_pessoa['Rede Social'] = df_filtrado['Rede Social'] if 'Rede Social' in df_filtrado.columns else ''
                df_pessoa['Twitter'] = df_filtrado[twitter_col] if twitter_col in df_filtrado.columns else ''
                df_pessoa['LinkedIn'] = df_filtrado[linkedin_col] if linkedin_col in df_filtrado.columns else ''
                df_pessoa['Skype'] = df_filtrado[skype_col] if skype_col in df_filtrado.columns else ''
                df_pessoa['Instagram'] = df_filtrado[instagram_col] if instagram_col in df_filtrado.columns else ''
                df_pessoa['Ranking'] = ''
                pessoas[f'Pessoas{i}.xlsx'] = df_pessoa

    return {
        'Empresas.xlsx': df_empresa,
        'Negocios.xlsx': df_negocios,
        **pessoas
    }


@router.post("/converter_planilha")
async def upload_e_converter(
    file: UploadFile = File(...),
    funil: str = Form(...),
    usuario_responsavel: str = Form(...)
):
    filename_lower = file.filename.lower()
    conteudo = await file.read()
    buffer = io.BytesIO(conteudo)

    try:
        if filename_lower.endswith(('.xlsx', '.xls')):
            xls = pd.ExcelFile(buffer)
            # Dá preferência à aba "main"
            if 'main' in [s.lower() for s in xls.sheet_names]:
                sheet_name = next(s for s in xls.sheet_names if s.lower() == 'main')
            else:
                sheet_name = xls.sheet_names[0]
            df = pd.read_excel(xls, sheet_name=sheet_name, dtype=str)

        elif filename_lower.endswith('.csv'):
            df = pd.read_csv(buffer, dtype=str, encoding='latin-1')
        else:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use .xlsx ou .csv.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler planilha: {str(e)}")

    arquivos = converter_planilha(df, funil, usuario_responsavel)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        for nome_arquivo, dataframe in arquivos.items():
            xlsx_buffer = io.BytesIO()
            with pd.ExcelWriter(xlsx_buffer, engine="xlsxwriter") as writer:
                dataframe.to_excel(writer, index=False)
            xlsx_buffer.seek(0)
            zipf.writestr(nome_arquivo, xlsx_buffer.read())

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": "attachment; filename=planilhas_convertidas.zip"}
    )
