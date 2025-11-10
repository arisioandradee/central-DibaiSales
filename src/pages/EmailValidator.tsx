import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle, AlertCircle, HelpCircle, ShieldAlert, Ban, MailWarning, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import * as XLSX from 'xlsx'

const API_KEY = import.meta.env.VITE_ZEROBOUNCE_API_KEY
const SINGLE_VALIDATION_URL = 'https://api.zerobounce.net/v2/validate'

type ValidationStatus = 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse' | 'do_not_mail'

type SingleValidationResult = {
  status: ValidationStatus
  sub_status: string
  did_you_mean?: string
}

type BatchResult = {
  email: string
  status: ValidationStatus
  sub_status: string
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

export default function EmailValidatorPage() {
  const [singleEmail, setSingleEmail] = useState('')
  const [isSingleLoading, setIsSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<SingleValidationResult | null>(null)

  const [batchText, setBatchText] = useState('')
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [displayLimit, setDisplayLimit] = useState<number | 'all'>(10)

  const { toast } = useToast()

  const saveHistory = (item: any) => {
    const saved = JSON.parse(localStorage.getItem('emailHistory') || '[]')
    const newItem = {
      id: String(saved.length + 1),
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...item,
    }
    localStorage.setItem('emailHistory', JSON.stringify([newItem, ...saved]))
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

  const handleSingleValidate = async () => {
    if (!singleEmail || !API_KEY) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: !API_KEY ? 'Chave da API não configurada' : 'Digite um e-mail',
      })
      return
    }

    setIsSingleLoading(true)
    setSingleResult(null)
    try {
      const response = await fetch(`${SINGLE_VALIDATION_URL}?api_key=${API_KEY}&email=${encodeURIComponent(singleEmail)}`)
      if (!response.ok) throw new Error('Falha na validação do e-mail.')
      const result: SingleValidationResult = await response.json()
      setSingleResult(result)

      saveHistory({
        type: 'Único',
        input: singleEmail,
        status: 'Concluído',
        valid: result.status === 'valid' ? 1 : 0,
        invalid: result.status !== 'valid' ? 1 : 0,
        total: 1,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na Validação',
        description: error instanceof Error ? error.message : 'Erro inesperado',
      })
    } finally {
      setIsSingleLoading(false)
    }
  }

  const handleTextBatchValidate = async () => {
    if (!batchText.trim() || !API_KEY) {
      toast({ variant: 'destructive', title: 'Erro', description: !API_KEY ? 'Chave da API não configurada' : 'Cole ao menos um e-mail.' })
      return
    }

    const emails = batchText
      .split('\n')
      .map(e => e.trim())
      .filter(e => e)

    if (emails.length === 0) return

    setIsBatchLoading(true)
    setBatchResults([])

    const MAX_CONCURRENT_REQUESTS = 10
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
      const batchRes = await processBatch(emailBatch)
      results.push(...batchRes)
      setBatchProgress(Math.floor(((i + emailBatch.length) / emails.length) * 100))
    }

    setBatchResults(results)
    setIsBatchLoading(false)
    setBatchProgress(100)

    const validCount = results.filter(r => r.status === 'valid').length
    const invalidCount = results.length - validCount

    saveHistory({
      type: 'Em Lote',
      input: 'Lote de e-mails',
      status: 'Concluído',
      valid: validCount,
      invalid: invalidCount,
      total: results.length,
    })

    toast({ title: 'Validação concluída!', description: `Foram processados ${results.length} e-mails.` })
  }

  const exportResults = () => {
    if (batchResults.length === 0) return
    const wsData = [
      ['E-mail', 'Status'],
      ...batchResults.map(row => [row.email, row.status]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `validation_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Exibe apenas a quantidade escolhida
  const displayedResults = displayLimit === 'all' ? batchResults : batchResults.slice(0, displayLimit)

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-10">Validador de E-mail</h1>

        <Tabs defaultValue="single">
          <TabsList className="flex bg-popover rounded-full p-1 mx-auto w-fit mb-8 shadow-md">
            <TabsTrigger value="single" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">Validação Única</TabsTrigger>
            <TabsTrigger value="batch" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">Validação em Lote</TabsTrigger>
          </TabsList>

          {/* ===== ÚNICO ===== */}
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
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== LOTE ===== */}
          <TabsContent value="batch">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Validação de E-mails em Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <textarea
                  rows={8}
                  className="w-full rounded-lg border border-indigo-500/50 p-2 bg-background text-foreground focus:ring-indigo-500 focus:border-indigo-500 transition shadow-inner" 
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="ex: email1@teste.com&#10;email2@teste.com"
                  disabled={showFileUpload}
                />
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <Button
                    onClick={handleTextBatchValidate}
                    disabled={isBatchLoading || !batchText.trim() || showFileUpload}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition text-white"
                  >
                    {isBatchLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validar E-mails ({batchText.trim().split('\n').filter(e => e.trim()).length} itens)
                  </Button>
                </div>

                {batchResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">
                        Resultados ({displayedResults.length}/{batchResults.length})
                      </h3>

                      <div className="flex items-center gap-2">
                        <select
                          className="border border-border rounded-md px-2 py-1 text-sm bg-background text-foreground hover:bg-accent/20 transition-colors"
                          value={displayLimit}
                          onChange={(e) =>
                            setDisplayLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))
                          }
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value="all">Todos</option>
                        </select>

                        <Button variant="outline" size="sm" onClick={exportResults} className="flex items-center gap-2">
                          <Download className="h-4 w-4" /> Exportar XLSX
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-popover">
                          <tr>
                            <th className="text-left p-2">E-mail</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedResults.map((res, i) => (
                            <tr key={i} className="hover:bg-popover transition-colors">
                              <td className="p-2 font-medium">{res.email}</td>
                              <td className="p-2">{renderStatus(res.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
