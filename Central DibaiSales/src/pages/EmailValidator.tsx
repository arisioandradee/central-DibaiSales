import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUploader } from '@/components/FileUploader'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Download,
  ShieldAlert,
  Ban,
  MailWarning,
  FileText,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type {
  ValidationStatus,
  SingleValidationResult,
  BatchResult,
  FileUploadResponse,
  FileStatusResponse,
} from '@/types/zerobounce'
import * as XLSX from 'xlsx'

const API_KEY = import.meta.env.VITE_ZEROBOUNCE_API_KEY
const SINGLE_VALIDATION_URL = 'https://api.zerobounce.net/v2/validate'
const BATCH_UPLOAD_URL = 'https://bulkapi.zerobounce.net/v2/sendfile'
const BATCH_STATUS_URL = 'https://bulkapi.zerobounce.net/v2/filestatus'
const BATCH_RESULT_URL = 'https://bulkapi.zerobounce.net/v2/getfile'

// Map Status -> Label PT + cor hex
const statusMap: Record<ValidationStatus, { label: string; color: string }> = {
  valid: { label: 'Válido', color: 'FF00FF00' },
  invalid: { label: 'Inválido', color: 'FFFF0000' },
  'catch-all': { label: 'Catch-all', color: 'FFFFFF00' },
  unknown: { label: 'Desconhecido', color: 'FF808080' },
  spamtrap: { label: 'Spamtrap', color: 'FFFFA500' },
  abuse: { label: 'Abuso', color: 'FF8B0000' },
  do_not_mail: { label: 'Não Enviar', color: 'FF808080' },
}

const statusConfig: Record<ValidationStatus, { icon: React.ElementType; color: string; label: string }> = {
  valid: { icon: CheckCircle, color: 'text-green-400', label: 'Válido' },
  invalid: { icon: XCircle, color: 'text-red-500', label: 'Inválido' },
  'catch-all': { icon: AlertCircle, color: 'text-yellow-400', label: 'Catch-all' },
  unknown: { icon: HelpCircle, color: 'text-gray-400', label: 'Desconhecido' },
  spamtrap: { icon: ShieldAlert, color: 'text-orange-400', label: 'Spamtrap' },
  abuse: { icon: Ban, color: 'text-red-600', label: 'Abuso' },
  do_not_mail: { icon: MailWarning, color: 'text-gray-500', label: 'Não Enviar' },
}

// MÁXIMO DE REQUISIÇÕES CONCORRENTES PARA EVITAR LENTIDÃO
const MAX_CONCURRENT_REQUESTS = 10; 

export default function EmailValidatorPage() {
  const [singleEmail, setSingleEmail] = useState('')
  const [isSingleLoading, setIsSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<SingleValidationResult | null>(null)

  const [batchText, setBatchText] = useState('')
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [showFileUpload, setShowFileUpload] = useState(false) 
  const { toast } = useToast()

  // ================== Validação Única ==================
  const handleSingleValidate = async () => {
    if (!singleEmail || !API_KEY) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: !API_KEY
          ? 'A chave da API não está configurada.'
          : 'Por favor, insira um e-mail.',
      })
      return
    }
    setIsSingleLoading(true)
    setSingleResult(null)
    try {
      const response = await fetch(
        `${SINGLE_VALIDATION_URL}?api_key=${API_KEY}&email=${encodeURIComponent(singleEmail)}`,
      )
      if (!response.ok) throw new Error('Falha na validação do e-mail.')
      const result: SingleValidationResult = await response.json()
      setSingleResult(result)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na Validação',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
      })
    } finally {
      setIsSingleLoading(false)
    }
  }

  // ================== Validação Texto em Lote ==================
  const handleTextBatchValidate = async () => {
    if (!batchText.trim() || !API_KEY) {
      toast({ variant: 'destructive', title: 'Erro', description: !API_KEY ? 'A chave da API não está configurada.' : 'Cole ao menos um e-mail.' })
      return
    }
    
    if(showFileUpload) {
        setShowFileUpload(false);
        setBatchFile(null); 
    }

    const emails = batchText
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e)

    if (emails.length === 0) return

    setIsBatchLoading(true)
    setBatchResults([])

    const results: BatchResult[] = []

    const processBatch = async (emailBatch: string[]) => {
      const promises = emailBatch.map(async (email) => {
        try {
          const res = await fetch(`${SINGLE_VALIDATION_URL}?api_key=${API_KEY}&email=${encodeURIComponent(email)}`)
          const data: SingleValidationResult = await res.json()
          return { email, status: data.status, sub_status: data.sub_status || '' } as BatchResult
        } catch {
          return { email, status: 'unknown', sub_status: 'Erro de Requisição' } as BatchResult
        }
      })
      return Promise.all(promises)
    }

    for (let i = 0; i < emails.length; i += MAX_CONCURRENT_REQUESTS) {
      const emailBatch = emails.slice(i, i + MAX_CONCURRENT_REQUESTS)
      const batchResults = await processBatch(emailBatch)
      results.push(...batchResults)
      
      setBatchProgress(Math.floor((i + emailBatch.length) / emails.length * 100)); 
    }

    setBatchResults(results)
    setIsBatchLoading(false)
    setBatchProgress(100)
    toast({ title: 'Validação concluída!', description: `Foram processados ${results.length} e-mails.` })
  }

  // ================== Funções de Validação por Arquivo ==================
  const pollBatchStatus = (fileId: string) => {
    const interval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`${BATCH_STATUS_URL}?api_key=${API_KEY}&file_id=${fileId}`)
        if (!statusResponse.ok) throw new Error()
        const statusData: FileStatusResponse = await statusResponse.json()

        const progress = parseInt(statusData.complete_percentage, 10)
        setBatchProgress(progress)

        if (statusData.file_status === 'Complete') {
          clearInterval(interval)
          await fetchBatchResults(fileId)
        } else if (statusData.error_reason) {
          throw new Error(statusData.error_reason)
        }
      } catch (error) {
        clearInterval(interval)
        setIsBatchLoading(false)
        toast({
          variant: 'destructive',
          title: 'Erro no Processamento',
          description: error instanceof Error ? error.message : 'Não foi possível obter o status do arquivo.',
        })
      }
    }, 5000)
  }

  const fetchBatchResults = async (fileId: string) => {
    try {
      const resultsResponse = await fetch(`${BATCH_RESULT_URL}?api_key=${API_KEY}&file_id=${fileId}`)
      if (!resultsResponse.ok) throw new Error('Falha ao buscar resultados.')
      const csvText = await resultsResponse.text()
      const lines = csvText.trim().split('\n')
      const headers = lines[0].split(',').map((h) => h.replace(/"/g, ''))
      const emailIndex = headers.indexOf('Email Address')
      const statusIndex = headers.indexOf('ZB Status')

      const results: BatchResult[] = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.replace(/"/g, ''))
        return {
          email: values[emailIndex],
          status: values[statusIndex] as ValidationStatus,
          sub_status: '', 
        }
      })

      setBatchResults(results)
      toast({
        title: 'Validação em lote concluída!',
        description: 'Os resultados estão prontos para visualização.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Baixar Resultados',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
      })
    } finally {
      setIsBatchLoading(false)
      setBatchProgress(100)
    }
  }

  const handleBatchValidate = async () => {
    if (!batchFile || !API_KEY) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: !API_KEY ? 'A chave da API não está configurada.' : 'Por favor, selecione um arquivo.',
      })
      return
    }
    setIsBatchLoading(true)
    setBatchProgress(0)
    setBatchResults([])
    setBatchText('') 

    const formData = new FormData()
    formData.append('api_key', API_KEY)
    formData.append('file', batchFile)
    formData.append('email_address_column', '1') 

    try {
      const response = await fetch(BATCH_UPLOAD_URL, { method: 'POST', body: formData })
      const data: FileUploadResponse = await response.json()

      if (!response.ok || data.error) throw new Error(data.message || data.error || 'Erro no upload do arquivo.')

      toast({ title: 'Upload bem-sucedido!', description: 'Seu arquivo está sendo processado. Aguarde...' })
      pollBatchStatus(data.file_id)
    } catch (error) {
      setIsBatchLoading(false)
      toast({ variant: 'destructive', title: 'Erro no Upload', description: error instanceof Error ? error.message : 'Erro inesperado.' })
    }
  }

  // ================== Export XLSX ==================
  const exportResults = () => {
    if (batchResults.length === 0) return

    // Exporta apenas E-mail e Status
    const wsData = [
      ['E-mail', 'Status'],
      ...batchResults.map((row) => [
        row.email,
        statusMap[row.status]?.label || row.status,
      ]),
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Ajuste no índice de cor
    const range = XLSX.utils.decode_range(ws['!ref']!)
    for (let R = 1; R <= range.e.r; ++R) {
      const statusCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })]
      if (statusCell && statusCell.v) {
        const statusKey = Object.keys(statusMap).find(
          (key) => statusMap[key as ValidationStatus].label === statusCell.v
        ) as ValidationStatus | undefined
        const color = statusKey ? statusMap[statusKey].color : 'FFDDDDDD'
        statusCell.s = { fill: { fgColor: { rgb: color } }, font: { bold: true } }
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `validation_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const renderStatus = (status: ValidationStatus) => {
    const config = statusConfig[status] || statusConfig.unknown
    return (
      <div className={cn('flex items-center gap-2', config.color)}>
        <config.icon className="h-4 w-4" />
        <span className="font-medium">{config.label}</span>
      </div>
    )
  }
  
  const handleToggleFileUpload = () => {
    if (showFileUpload) {
      setBatchFile(null);
    } else {
      setBatchText('');
    }
    setShowFileUpload(!showFileUpload);
    setBatchResults([]);
    setBatchProgress(0);
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-10">Validador de E-mail</h1>

        <Tabs defaultValue="single">
          <TabsList className="flex bg-popover rounded-full p-1 mx-auto w-fit mb-8 shadow-md">
            <TabsTrigger value="single" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">Validação Única</TabsTrigger>
            <TabsTrigger value="batch" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">Validação em Lote</TabsTrigger>
          </TabsList>

          {/* ================== Aba Única ================== */}
          <TabsContent value="single">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Validação de E-mail Único</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Digite o e-mail"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSingleValidate()}
                    className="flex-1 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <Button onClick={handleSingleValidate} disabled={isSingleLoading || !singleEmail} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition text-white">
                    {isSingleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validar
                  </Button>
                </div>
                {singleResult && (
                  <div className="p-4 border rounded-lg animate-fade-in-up">
                    <h3 className="font-semibold mb-2">Resultado:</h3>
                    <div className="flex items-center gap-3">
                      {renderStatus(singleResult.status)}
                      <Badge variant="secondary">{singleResult.sub_status}</Badge>
                    </div>
                    {singleResult.did_you_mean && <p className="text-sm mt-2">Você quis dizer: <strong>{singleResult.did_you_mean}</strong>?</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================== Aba Lote ================== */}
          <TabsContent value="batch">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Validação de E-mails em Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                <textarea
                  id="batch-textarea"
                  rows={8}
                  className="w-full rounded-lg border border-indigo-500/50 p-2 bg-background text-foreground focus:ring-indigo-500 focus:border-indigo-500 transition shadow-inner" 
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="ex: email1@teste.com&#10;email2@teste.com&#10;email3@teste.com" 
                  disabled={showFileUpload} 
                />
                
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                    {/* Botão Principal de Validação de Texto */}
                    <Button
                      onClick={handleTextBatchValidate}
                      disabled={isBatchLoading || !batchText.trim() || showFileUpload}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition text-white"
                    >
                      {isBatchLoading && !batchFile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Validar E-mails ({batchText.trim().split('\n').filter(e => e.trim()).length} itens)
                    </Button>

                    {/* Botão para Anexar/Ocultar Arquivo (Estilo diferente) */}
                    <Button
                        onClick={handleToggleFileUpload}
                        variant={showFileUpload ? 'destructive' : 'outline'}
                        className={cn(
                            "w-full sm:w-auto transition-colors",
                            showFileUpload ? "bg-red-500 hover:bg-red-600 text-white" : "border-gray-500 text-gray-400 hover:bg-popover"
                        )}
                        disabled={isBatchLoading}
                    >
                        {showFileUpload ? (
                            <><X className="mr-2 h-4 w-4" /> Fechar Arquivo</>
                        ) : (
                            <><FileText className="mr-2 h-4 w-4" /> Anexar Arquivo</>
                        )}
                    </Button>
                </div>

                {/* ------------------ Upload de Arquivo Condicional ------------------ */}
                {showFileUpload && (
                    <div className="space-y-3 p-4 border border-dashed rounded-lg bg-popover/50 mt-4 animate-fade-in-up">
                        <p className="text-sm text-center text-muted-foreground">Use o ZeroBounce Bulk API para arquivos grandes (.csv ou .txt):</p>
                        
                        <FileUploader
                          onFileSelect={(file) => { 
                            setBatchFile(file); 
                            setBatchText(''); 
                            setBatchResults([]); 
                            setBatchProgress(0);
                          }}
                          acceptedFormats=".csv,.txt"
                          instructionText="Selecione um arquivo"
                          className="mx-auto"
                        />

                        <Button
                          onClick={handleBatchValidate}
                          disabled={isBatchLoading || !batchFile}
                          className="w-full sm:w-auto mx-auto block bg-gray-600 hover:bg-gray-700 transition text-white"
                        >
                          {isBatchLoading && !!batchFile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Validar Arquivo
                        </Button>
                        
                        {(isBatchLoading || batchProgress > 0) && !!batchFile && (
                            <Progress value={batchProgress} className="w-full h-2 mt-3" />
                        )}
                    </div>
                )}
                {/* ------------------ Fim Upload de Arquivo Condicional ------------------ */}

                {/* Mensagem de progresso/loading global */}
                {(isBatchLoading && !batchFile && batchText.trim() && batchProgress < 100) && (
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Validando e-mails ({batchProgress}% concluído)...</span>
                    </div>
                )}

                {/* Resultados */}
                {batchResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Resultados ({batchResults.length})</h3>
                      <Button variant="outline" size="sm" onClick={exportResults} className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Exportar XLSX
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-popover">
                          <TableRow>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* ⚠️ Mapeando TODOS os resultados */}
                          {batchResults.map((res, i) => (
                            <TableRow key={i} className="hover:bg-popover transition-colors">
                              <TableCell className="font-medium">{res.email}</TableCell>
                              <TableCell>{renderStatus(res.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* ⚠️ Mensagem de limite removida */}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}