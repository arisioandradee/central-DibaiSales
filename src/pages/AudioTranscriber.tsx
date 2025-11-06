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
import { Loader2, CheckCircle, XCircle, Download, Mic } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ENDPOINTS } from '../api/endpoints'

type ProcessingStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ExcelTranscriber() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null)
  const { toast } = useToast()

  // novo nome do arquivo gerado
  const DOWNLOAD_FILENAME = 'relatorios_transcricoes.zip'

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

  const handleProcess = async () => {
    if (!file) return
    setStatus('loading')
    setErrorMessage('')
    setConvertedBlob(null)

    const API_URL = ENDPOINTS.transcreverAudios

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      })

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

      // agora a API retorna um ZIP contendo 2 PDFs
      const zipBlob = await response.blob()
      setConvertedBlob(zipBlob)
      setStatus('success')

      toast({
        title: 'Processamento concluído!',
        description: `O arquivo ${DOWNLOAD_FILENAME} foi gerado com sucesso.`,
      })
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
              Processando a planilha... Isso pode levar alguns minutos.
            </p>
          </div>
        )
      case 'success':
        return (
          <Alert className="bg-success/10 border-success/30 text-success-foreground shadow-lg dark:bg-success/20 dark:border-success/50">
            <CheckCircle className="h-5 w-5 text-success" />
            <AlertTitle className="text-lg font-semibold text-success">
              Processamento concluído!
            </AlertTitle>
            <AlertDescription className="text-success-foreground">
              Seu arquivo ZIP com os dois PDFs está pronto para download: <b>{DOWNLOAD_FILENAME}</b>.
            </AlertDescription>
          </Alert>
        )
      case 'error':
        return (
          <Alert variant="destructive" className="shadow-lg">
            <XCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Erro no Processamento</AlertTitle>
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
              Enviar Planilha XLSX
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              A planilha deve conter as colunas: <b>ID, Atendente, Gravação</b> (entre outras).
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-3">
              O sistema irá baixar os áudios, transcrever usando Gemini e gerar um ZIP com dois PDFs (modelo padrão e análise BANT).
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <FileUploader
              onFileSelect={(selectedFile) => {
                setFile(selectedFile)
                setStatus('idle')
              }}
              acceptedFormats=".xlsx"
              instructionText="Arraste e solte a planilha XLSX aqui ou clique para selecionar"
            />

            <Separator />

            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={handleProcess}
                disabled={!file || status === 'loading'}
                className="w-full h-12 text-lg font-semibold transition-transform duration-200 hover:scale-[1.01] shadow-lg shadow-primary/50"
              >
                {status === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Processar Planilha
              </Button>

              {status !== 'idle' && <div className="w-full pt-2">{renderStatusIndicator()}</div>}

              {status === 'success' && convertedBlob && (
                <Button
                  onClick={() => handleDownload(convertedBlob, DOWNLOAD_FILENAME)}
                  className="w-full h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground transition-transform duration-200 hover:scale-[1.01] mt-4 shadow-lg shadow-success/50"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Baixar ZIP ({DOWNLOAD_FILENAME})
                </Button>
              )}

              {file === null && (
                <Alert className="bg-primary/5 dark:bg-primary/10 border-primary/20 mt-6 p-4 break-words">
                  <div className="flex items-start gap-2">
                    <Mic className="h-7 w-7 text-primary mt-1" />
                    <div>
                      <AlertTitle className="text-primary font-semibold">Aviso Importante sobre o Formato</AlertTitle>
                      <AlertDescription className="text-sm leading-relaxed">
                        A API4COM gera a planilha originalmente em <strong>.csv</strong>. <br />
                        Para utilizá-la aqui, converta para <strong>.xlsx</strong> usando uma ferramenta online simples, como <a href="https://convertio.co/pt/csv-xlsx/" target="_blank" className="text-primary">Convertio</a>.
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
