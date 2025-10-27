import React, { useState, useEffect } from 'react'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Database,
  User,
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { ENDPOINTS } from '../api/endpoints'

const FUNNELS = [
  'Todos os funis',
  'Funil de Vendas',
  'Dibai Sales',
  'Data Car',
  "Let's Perform",
  'F5 Digital',
  'Contém',
  'Eleven',
  'TMC',
  'TNB Telecom',
  'AspinBots',
  'WEConecta',
  'Galinari'
]

const USERS = [
  'Eu', 'Bruno', 'Camila', 'Eliana', 'Jorge Boruszewsky',
  'Marcio', 'Matheus Dibai', 'Rafaella', 'Barbara Cristina',
  'Carlos', 'Charles', 'Charles Anderson', 'Erika', 'Ingrid Maiara',
  'Maria', 'Gabriella'
]

// Componente Card
const Card = ({ title, description, children }: any) => (
  // Mantido dark:bg-gray-800 para contraste com o fundo principal, agora mais escuro
  <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-xl shadow-2xl dark:shadow-black/20 border border-gray-200 dark:border-gray-700 p-6 w-full transition-colors duration-300">
    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
    <div className="space-y-6">{children}</div>
  </div>
)

// Componente Alert
const Alert = ({ variant, title, description, icon: Icon }: any) => {
  const base = "p-4 rounded-lg shadow-md flex items-start space-x-3"
  const isError = variant === "destructive"
  const isCustom = variant === "custom"

  let classes, iconColor
  
  const successColor = "text-emerald-600 dark:text-emerald-400"
  const successBg = "bg-emerald-50 dark:bg-emerald-950"
  const errorColor = "text-red-600 dark:text-red-400"
  const errorBg = "bg-red-50 dark:bg-red-950"
  const customColor = "text-blue-600 dark:text-blue-400"
  const customBg = "bg-blue-50 dark:bg-blue-950"

  if (isError) {
    classes = `${errorBg} border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200`
    iconColor = errorColor
  } else if (isCustom) {
    classes = `${customBg} border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200`
    iconColor = customColor
  } else {
    classes = `${successBg} border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200`
    iconColor = successColor
  }

  return (
    <div className={`${base} ${classes}`}>
      {Icon && <Icon className={`h-5 w-5 ${iconColor} mt-0.5 flex-shrink-0`} />}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// Componente FileUploader
const FileUploader = ({ onFileSelect, acceptedFormats, instructionText }: any) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (file) {
      setSelectedFileName(file.name)
      onFileSelect(file)
    } else {
      setSelectedFileName(null)
      onFileSelect(null)
    }
    event.target.value = '' 
  }

  const handleRemoveFile = () => {
    setSelectedFileName(null)
    onFileSelect(null)
  }

  return (
    <div className="w-full text-center">
      {!selectedFileName ? (
        <label className="block w-full border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition duration-150 bg-gray-50 dark:bg-gray-700/50">
          <Upload className="h-6 w-6 mx-auto mb-2 text-blue-500 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-300 text-sm">{instructionText}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Formatos aceitos: {acceptedFormats}</p>
          <input type="file" accept={acceptedFormats} onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="flex items-center justify-between p-4 border border-blue-500/50 bg-blue-100 dark:bg-blue-900/50 rounded-lg shadow-sm">
          <span className="text-sm text-blue-800 dark:text-blue-200 truncate">{selectedFileName}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="ml-4 text-sm text-red-600 dark:text-red-400 hover:opacity-80 font-medium transition"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null)
  const [selectedFunnel, setSelectedFunnel] = useState(FUNNELS[0])
  const [selectedUser, setSelectedUser] = useState(USERS[0])
  
  // --- LÓGICA DE TEMA (DARK MODE) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // 1. Inicializa o tema checando o localStorage ou a preferência do sistema
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // 2. Aplica a classe 'dark' ou remove no <html>
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // 3. Salva a preferência
    // Nota: Em ambientes isolados como este, o localStorage pode não persistir, mas a lógica do código é correta.
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
  };
  // ---------------------------------

  const API_URL = ENDPOINTS.converterPlanilha
  
  const DOWNLOAD_FILENAME = 'planilhas_convertidas.zip'

  // Função para download do arquivo
  const handleDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleConvert = async () => {
    if (!file) return
    setStatus('loading')
    setErrorMessage('')
    setConvertedBlob(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('funil', selectedFunnel)
    formData.append('usuario_responsavel', selectedUser)

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        });
      
      if (!response.ok) {
        // Tentativa de extrair mensagem de erro detalhada do FastAPI
        let errorDetail = await response.text()
        try {
          const errorJson = JSON.parse(errorDetail)
          errorDetail = errorJson.detail || errorJson.detail
        } catch {} // Se não for JSON, usa o texto puro.
        
        setStatus('error')
        setErrorMessage(`Erro HTTP ${response.status}: ${errorDetail}`)
        return
      }
      
      const blob = await response.blob()
      setConvertedBlob(blob)
      setStatus('success')

    } catch (err) {
      console.error('Erro de rede ou fetch:', err)
      setStatus('error')
      setErrorMessage('Não foi possível conectar ao servidor. Verifique se o backend está rodando em ' + API_URL)
    }
  }

  // Renderiza status de processamento
  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center justify-center space-x-2 text-blue-500 dark:text-blue-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">Convertendo e processando dados...</p>
          </div>
        )
      case 'success':
        return (
          <Alert
            variant="success"
            icon={CheckCircle}
            title="Conversão concluída!"
            description="Seu arquivo ZIP está pronto para download."
          />
        )
      case 'error':
        return (
          <Alert
            variant="destructive"
            icon={XCircle}
            title="Erro na conversão"
            description={errorMessage}
          />
        )
      default:
        return null
    }
  }

  return (
    // ALTERAÇÃO: Fundo principal agora é dark:bg-gray-950 para um preto mais profundo
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="w-full max-w-4xl">

        
        <Card
          title="Upload de Planilha para Conversão"
          description="Selecione o funil e o usuário responsável para atribuir aos leads convertidos no CRM."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Database className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
                Funil de Vendas
              </label>
              <select
                value={selectedFunnel}
                onChange={(e) => setSelectedFunnel(e.target.value)}
                className="block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 transition duration-150"
              >
                {FUNNELS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <User className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
                Usuário Responsável
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="block w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 transition duration-150"
              >
                {USERS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-6"></div>

          <div className="space-y-6">
            <FileUploader
              onFileSelect={(selectedFile: File | null) => {
                setFile(selectedFile)
                setStatus('idle')
              }}
              acceptedFormats=".xlsx"
              instructionText="Arraste e solte seu arquivo Excel aqui ou clique para selecionar"
            />

            {file === null && (
              <Alert
                variant="custom"
                icon={FileSpreadsheet}
                title="Aviso de Formato Necessário"
                description={
                  <>
                    Sua planilha deve ser no formato <strong>Excel da Dibai Sales</strong> (incluindo as colunas de leads).<br />
                    A aba (sheet) que contém os dados precisa, preferencialmente, se chamar <strong>main</strong>
                  </>
                }
              />
            )}

            {/* Botões */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleConvert}
                disabled={!file || status === 'loading'}
                className={`w-full sm:w-80 h-12 text-lg font-semibold rounded-lg transition duration-200 shadow-lg flex items-center justify-center
                  ${!file || status === 'loading'
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/50'
                  }`}
              >
                {status === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Converter e Processar
              </button>

              {status !== 'idle' && <div className="w-full">{renderStatus()}</div>}

              {status === 'success' && convertedBlob && (
                <div className="w-full flex justify-center mt-4">
                  <button
                    onClick={() => handleDownload(convertedBlob, DOWNLOAD_FILENAME)}
                    className="
                      w-full sm:w-96 h-14 px-6
                      text-lg font-semibold rounded-xl
                      border-2 border-emerald-500/70
                      bg-emerald-500 hover:bg-emerald-600 text-white
                      shadow-lg shadow-emerald-500/40
                      flex items-center justify-center
                      transition-all duration-200
                    "
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Baixar Arquivo ZIP ({DOWNLOAD_FILENAME})
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
