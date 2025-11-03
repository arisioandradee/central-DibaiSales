import React, { useState } from 'react'
import { Loader2, CheckCircle, XCircle, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileUploader } from '@/components/FileUploader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ENDPOINTS } from '../api/endpoints'

type ProcessingStatus = 'idle' | 'loading' | 'success' | 'error'

export default function SalesforceConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null)

  const DOWNLOAD_FILENAME = 'Salesforce.xlsx'

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

    try {
      const response = await fetch(ENDPOINTS.salesforce, { method: 'POST', body: formData })

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
        return
      }

      const blob = await response.blob()
      setConvertedBlob(blob)
      setStatus('success')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Não foi possível conectar ao servidor. Verifique o backend.`
      setStatus('error')
      setErrorMessage(message)
    }
  }

  const renderStatusIndicator = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center justify-center space-x-2 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">Convertendo sua planilha...</p>
          </div>
        )
      case 'success':
        return (
          <Alert className="bg-success/10 border-success/30 text-success-foreground shadow-lg dark:bg-success/20 dark:border-success/50">
            <CheckCircle className="h-5 w-5 text-success" />
            <AlertTitle className="text-lg font-semibold text-success">Conversão concluída!</AlertTitle>
            <AlertDescription className="text-success-foreground">
              Seu arquivo <b>{DOWNLOAD_FILENAME}</b> está pronto para download.
            </AlertDescription>
          </Alert>
        )
      case 'error':
        return (
          <Alert variant="destructive" className="shadow-lg">
            <XCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Erro na conversão</AlertTitle>
            <AlertDescription className="break-words">{errorMessage}</AlertDescription>
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
            <CardTitle className="text-2xl font-bold text-foreground">Conversor Salesforce</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Envie sua planilha para gerar o arquivo compatível com Salesforce.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <FileUploader
              onFileSelect={(selectedFile) => {
                setFile(selectedFile)
                setStatus('idle')
              }}
              acceptedFormats=".xlsx,.xls"
              instructionText="Arraste e solte sua planilha XLSX aqui ou clique para selecionar"
            />

            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={handleConvert}
                disabled={!file || status === 'loading'}
                className="w-full h-12 text-lg font-semibold transition-transform duration-200 hover:scale-[1.01] shadow-lg shadow-primary/50"
              >
                {status === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Converter Planilha
              </Button>

              {status !== 'idle' && <div className="w-full pt-2">{renderStatusIndicator()}</div>}

              {status === 'success' && convertedBlob && (
                <Button
                  onClick={() => handleDownload(convertedBlob, DOWNLOAD_FILENAME)}
                  className="w-full h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground transition-transform duration-200 hover:scale-[1.01] mt-4 shadow-lg shadow-success/50"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Baixar {DOWNLOAD_FILENAME}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
