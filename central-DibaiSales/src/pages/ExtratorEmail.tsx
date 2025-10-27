import { useState } from 'react'
import { FileUploader } from '@/components/FileUploader'
import { Button } from '@/components/ui/button'
import { Loader2, Download, Mail, FileText } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

export default function EmailExtractorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [emails, setEmails] = useState<string[]>([])
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null)
  const { toast } = useToast()

  const handleProcess = async () => {
    if (!file) return
    setLoading(true)
    setEmails([])
    setExcelBlob(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('gerar_excel', 'true') // opcional

    try {
      const response = await fetch('http://127.0.0.1:8000/api/extrator-email', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: `Erro HTTP ${response.status}` }))
        throw new Error(err.detail || 'Erro desconhecido')
      }

      const data = await response.json()
      setEmails(data.emails || [])

      if (data.excel_base64) {
        const bytes = new Uint8Array([...data.excel_base64].map(c => c.charCodeAt(0)))
        setExcelBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      }

      toast({ title: 'Extração concluída!', description: `Foram encontrados ${data.emails?.length || 0} e-mails.` })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!excelBlob) return
    const url = URL.createObjectURL(excelBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'emails_extraidos.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="bg-background shadow-2xl rounded-2xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Processamento de Planilha</h2>
          <p className="text-muted-foreground">Envie sua planilha (.xlsx ou .csv) contendo os dados dos sócios.</p>

          <FileUploader
            onFileSelect={(f) => setFile(f)}
            acceptedFormats=".csv,.xlsx,.xls"
            instructionText="Arraste e solte sua planilha ou clique para selecionar"
          />

          <Separator />

          <Button
            onClick={handleProcess}
            disabled={!file || loading}
            className="w-full h-12 text-lg font-semibold transition-transform duration-200 hover:scale-[1.01] shadow-lg shadow-primary/50"
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Extrair E-mails
          </Button>

          {emails.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5" /> Resultados Extraídos
              </h3>
              <div className="max-h-72 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 shadow-inner scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
                {emails.map((email, idx) => (
                  <p key={idx} className="break-words py-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    {email}
                  </p>
                ))}
              </div>

              {excelBlob && (
                <Button
                  onClick={handleDownload}
                  className="w-full h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground mt-4 shadow-lg shadow-success/50 flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" /> Baixar Excel
                </Button>
              )}
            </div>
          )}

          {!file && (
            <Alert className="mt-6 flex items-start gap-2 bg-primary/5 dark:bg-primary/10 border-primary/20 p-4">
              <Mail className="h-5 w-5 text-primary mt-1" />
              <div>
                <AlertTitle className="text-primary font-semibold">Aviso sobre o Formato</AlertTitle>
                <AlertDescription className="text-sm leading-relaxed">
                  Sua planilha deve ser no formato <strong>Excel das planilhas Dibai Sales</strong>.<br />
                  A aba que contém os dados precisa, preferencialmente, se chamar <strong>main</strong>.
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
