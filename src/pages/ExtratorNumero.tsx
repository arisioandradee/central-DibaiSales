import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUploader } from '@/components/FileUploader'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Phone,
  ChevronDown,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ENDPOINTS } from '../api/endpoints'

type ProcessingStatus = 'idle' | 'loading' | 'success' | 'error'

interface SocioData {
  [key: string]: {
    name: string
    phone_number: string
    business: string
    prompt: string
  }[]
}

export default function ExtratorContatosPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [socios, setSocios] = useState<SocioData>({})
  const [selectedSocio, setSelectedSocio] = useState('socio1')
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null)
  const { toast } = useToast()
  const DOWNLOAD_FILENAME = 'socios_contatos.zip'

  const handleDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleProcess = async () => {
    if (!file) return
    setStatus('loading')
    setErrorMessage('')
    setConvertedBlob(null)
    setSocios({})

    const API_URL = ENDPOINTS.extratorNumero
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(API_URL, { method: 'POST', body: formData })
      if (!response.ok) {
        let detail = 'Erro desconhecido no servidor.'
        try {
          const errorData = await response.json()
          detail = errorData.detail || detail
        } catch {
          detail = `Erro HTTP ${response.status}.`
        }
        setStatus('error')
        setErrorMessage(detail)
        toast({
          variant: 'destructive',
          title: 'Erro no processamento',
          description: `Falha na API: ${detail}`,
        })
        return
      }

      const fileBlob = await response.blob()
      setConvertedBlob(fileBlob)
      setStatus('success')
      toast({
        title: 'Extração concluída!',
        description: `O arquivo ZIP (${DOWNLOAD_FILENAME}) foi gerado com sucesso.`,
      })

      // --- Ler os arquivos .xlsx dentro do ZIP ---
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(fileBlob)
      const tempSocios: SocioData = {}

      for (const filename of Object.keys(zip.files)) {
        if (!filename.endsWith('.xlsx')) continue
        const fileData = await zip.files[filename].async('arraybuffer')
        const xlsx = await import('xlsx')
        const wb = xlsx.read(fileData, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // Converte a planilha para JSON respeitando as colunas reais
        const jsonData = xlsx.utils.sheet_to_json(ws) as SocioData[string]

        const socioKey = filename.toLowerCase().includes('socio1')
          ? 'socio1'
          : filename.toLowerCase().includes('socio2')
          ? 'socio2'
          : 'socio3'

        tempSocios[socioKey] = jsonData
      }

      setSocios(tempSocios)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Verifique a conexão com a API em ${API_URL}.`
      setStatus('error')
      setErrorMessage(message)
      toast({
        variant: 'destructive',
        title: 'Falha na Conexão',
        description: `Não foi possível enviar o arquivo ao servidor: ${message}`,
      })
    }
  }

  const renderStatusIndicator = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center justify-center space-x-2 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">
              Processando a planilha e gerando os arquivos de contatos...
            </p>
          </div>
        )
      case 'success':
        return (
          <Alert className="bg-success/10 border-success/30 text-success-foreground shadow-lg dark:bg-success/20 dark:border-success/50">
            <CheckCircle className="h-5 w-5 text-success" />
            <AlertTitle className="text-lg font-semibold text-success">
              Extração concluída com sucesso!
            </AlertTitle>
            <AlertDescription className="text-success-foreground">
              O arquivo ZIP (<strong>{DOWNLOAD_FILENAME}</strong>) com os
              contatos dos sócios está pronto.
            </AlertDescription>
          </Alert>
        )
      case 'error':
        return (
          <Alert variant="destructive" className="shadow-lg">
            <XCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">
              Erro no Processamento
            </AlertTitle>
            <AlertDescription className="break-words">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl space-y-8">
        <Card className="shadow-2xl border-none">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-2xl font-bold text-foreground">
              Processamento de Planilha
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Envie sua planilha (`.xlsx`) com os dados dos sócios.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <FileUploader
              onFileSelect={(selectedFile) => {
                setFile(selectedFile)
                setStatus('idle')
              }}
              acceptedFormats=".xlsx"
              instructionText="Arraste e solte sua planilha aqui ou clique para selecionar"
            />

            <Separator />

            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={handleProcess}
                disabled={!file || status === 'loading'}
                className="w-full h-12 text-lg font-semibold transition-transform duration-200 hover:scale-[1.01] shadow-lg shadow-primary/50"
              >
                {status === 'loading' && (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                )}
                Extrair Contatos
              </Button>

              {status !== 'idle' && (
                <div className="w-full pt-2">{renderStatusIndicator()}</div>
              )}

              {status === 'success' && Object.keys(socios).length > 0 && (
                <>
                  <div className="w-full mt-4 flex flex-col gap-2">
                    <label
                      htmlFor="socio-select"
                      className="font-semibold text-foreground"
                    >
                      Selecione o Sócio:
                    </label>
                    <div className="relative w-full">
                      <select
                        id="socio-select"
                        value={selectedSocio}
                        onChange={(e) => setSelectedSocio(e.target.value)}
                        className="w-full p-2 border border-gray-600 dark:border-gray-400 rounded-lg bg-gray-900 text-white dark:bg-gray-700 dark:text-white appearance-none pr-8 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {Object.keys(socios).map((socio) => (
                          <option key={socio} value={socio}>
                            {socio.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none h-5 w-5 text-gray-300" />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-gray-600 dark:border-gray-400 rounded-lg p-2 bg-gray-800 dark:bg-gray-900 shadow-inner mt-2">
                    <div className="grid grid-cols-4 gap-2 font-semibold border-b border-gray-500 pb-1 mb-2 text-gray-200">
                      <span>Nome</span>
                      <span>Telefone</span>
                      <span>Empresa</span>
                      <span>Prompt</span>
                    </div>

                    {socios[selectedSocio]?.map((contato, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-4 gap-2 py-1 px-1 rounded hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="select-text">{contato.name}</div>
                        <div className="select-text">
                          {contato.phone_number}
                        </div>
                        <div className="select-text">{contato.business}</div>
                        <div className="select-text truncate">
                          {contato.prompt}
                        </div>
                      </div>
                    ))}
                  </div>

                  {convertedBlob && (
                    <Button
                      onClick={() =>
                        handleDownload(convertedBlob, DOWNLOAD_FILENAME)
                      }
                      className="w-full h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground transition-transform duration-200 hover:scale-[1.01] mt-4 shadow-lg shadow-success/50 flex items-center justify-center gap-2"
                    >
                      <Download className="h-5 w-5" /> Baixar ZIP
                    </Button>
                  )}
                </>
              )}

              {!file && (
                <Alert className="bg-primary/5 dark:bg-primary/10 border-primary/20 mt-6 p-4 break-words">
                  <div className="flex items-start gap-2">
                    <Phone className="h-5 w-5 text-primary mt-1" />
                    <div>
                      <AlertTitle className="text-primary font-semibold">
                        Aviso Importante sobre o Formato
                      </AlertTitle>
                      <AlertDescription className="text-sm leading-relaxed">
                        Sua planilha deve ser no formato{' '}
                        <strong>Excel das planilhas Dibai Sales</strong>.
                        <br />
                        A aba que contém os dados precisa, preferencialmente, se
                        chamar <strong>main</strong>.
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
