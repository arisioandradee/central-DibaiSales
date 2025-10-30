import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, CheckCircle, XCircle, HelpCircle, Download, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import * as XLSX from 'xlsx'
import { ENDPOINTS } from '../api/endpoints'

type ValidationStatus = 'valid' | 'invalid' | 'unknown'

interface BatchResult {
  number: string
  status: ValidationStatus
  sub_status?: string
}

type HistoryItem = {
  id: string
  date: string
  type: 'Único' | 'Em Lote'
  input: string
  status: 'Concluído' | 'Falhou'
  valid: number
  invalid: number
  total: number
}

const statusMap: Record<ValidationStatus, { label: string; color: string }> = {
  valid: { label: 'Válido', color: 'FF00FF00' },
  invalid: { label: 'Inválido', color: 'FFFF0000' },
  unknown: { label: 'Desconhecido', color: 'FF808080' },
}

const statusConfig: Record<ValidationStatus, { icon: React.ElementType; color: string; label: string }> = {
  valid: { icon: CheckCircle, color: 'text-green-400', label: 'Válido' },
  invalid: { icon: XCircle, color: 'text-red-500', label: 'Inválido' },
  unknown: { icon: HelpCircle, color: 'text-gray-400', label: 'Desconhecido' },
}

const MAX_CONCURRENT_REQUESTS = 10

export default function WhatsAppValidatorPage() {
  const [singleNumber, setSingleNumber] = useState('')
  const [isSingleLoading, setIsSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<BatchResult | null>(null)

  const [batchText, setBatchText] = useState('')
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [displayLimit, setDisplayLimit] = useState<number | 'all'>(10)
  const { toast } = useToast()

  const addHistoryItem = (item: Omit<HistoryItem, 'id' | 'date'>) => {
    const saved = localStorage.getItem('whatsappHistory')
    const history: HistoryItem[] = saved ? JSON.parse(saved) : []

    const newItem: HistoryItem = {
      id: String(history.length + 1),
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...item,
    }

    const updated = [newItem, ...history]
    localStorage.setItem('whatsappHistory', JSON.stringify(updated))
  }

  const handleSingleValidate = async () => {
    if (!singleNumber) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, insira um número.' })
      return
    }

    setIsSingleLoading(true)
    setSingleResult(null)

    try {
      const resp = await fetch(ENDPOINTS.whatsappValidator, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: singleNumber }),
      })

      if (!resp.ok) throw new Error('Erro ao validar número.')

      const data: BatchResult = await resp.json()
      setSingleResult(data)

      addHistoryItem({
        type: 'Único',
        input: singleNumber,
        status: 'Concluído',
        valid: data.status === 'valid' ? 1 : 0,
        invalid: data.status === 'invalid' ? 1 : 0,
        total: 1,
      })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro na Validação', description: error.message || 'Erro inesperado.' })

      addHistoryItem({
        type: 'Único',
        input: singleNumber,
        status: 'Falhou',
        valid: 0,
        invalid: 0,
        total: 1,
      })
    } finally {
      setIsSingleLoading(false)
    }
  }

  const handleTextBatchValidate = async () => {
    if (!batchText.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Cole ao menos um número.' })
      return
    }

    const numbers = batchText.split('\n').map((n) => n.trim()).filter(Boolean)
    if (numbers.length === 0) return

    setIsBatchLoading(true)
    setBatchResults([])

    try {
      const results: BatchResult[] = []

      for (let i = 0; i < numbers.length; i += MAX_CONCURRENT_REQUESTS) {
        const batchSlice = numbers.slice(i, i + MAX_CONCURRENT_REQUESTS)
        const resp = await fetch(ENDPOINTS.whatsappValidator, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers: batchSlice }),
        })

        if (!resp.ok) throw new Error('Erro ao validar números em lote.')

        const data: BatchResult[] = await resp.json()
        results.push(...data)
        setBatchProgress(Math.floor(((i + batchSlice.length) / numbers.length) * 100))
      }

      setBatchResults(results)

      const validCount = results.filter((r) => r.status === 'valid').length
      const invalidCount = results.filter((r) => r.status === 'invalid').length

      toast({ title: 'Validação concluída!', description: `Foram processados ${results.length} números.` })

      addHistoryItem({
        type: 'Em Lote',
        input: `${numbers.length} números`,
        status: 'Concluído',
        valid: validCount,
        invalid: invalidCount,
        total: results.length,
      })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro na Validação', description: error.message || 'Erro inesperado.' })

      addHistoryItem({
        type: 'Em Lote',
        input: `${batchText.split('\n').length} números`,
        status: 'Falhou',
        valid: 0,
        invalid: 0,
        total: batchText.split('\n').length,
      })
    } finally {
      setIsBatchLoading(false)
      setBatchProgress(100)
    }
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

  // ======== EXPORTAÇÃO COM COLUNA LINK ========
  const exportResults = () => {
    if (batchResults.length === 0) return
    const wsData = [
      ['Número', 'Status', 'Link'],
      ...batchResults.map((r) => [
        r.number,
        statusMap[r.status]?.label || r.status,
        `http://wa.me/${r.number}`,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `validation_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ======== RESULTADOS LIMITADOS ========
  const displayedResults =
    displayLimit === 'all' ? batchResults : batchResults.slice(0, displayLimit)

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-10">Validador de WhatsApp</h1>

        <Tabs defaultValue="single">
          <TabsList className="flex bg-popover rounded-full p-1 mx-auto w-fit mb-8 shadow-md">
            <TabsTrigger value="single" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">
              Validação Única
            </TabsTrigger>
            <TabsTrigger value="batch" className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white transition">
              Validação em Lote
            </TabsTrigger>
          </TabsList>

          {/* ===== ÚNICO ===== */}
          <TabsContent value="single">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Validação de Número Único</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="tel"
                    placeholder="Digite o número"
                    value={singleNumber}
                    onChange={(e) => setSingleNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSingleValidate()}
                    className="flex-1 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <Button
                    onClick={handleSingleValidate}
                    disabled={isSingleLoading || !singleNumber}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition text-white"
                  >
                    {isSingleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validar
                  </Button>
                </div>

                {singleResult && (
                  <div className="p-4 border rounded-lg animate-fade-in-up">
                    <h3 className="font-semibold mb-2">Resultado:</h3>
                    {renderStatus(singleResult.status)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== LOTE ===== */}
          <TabsContent value="batch">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Validação de Números em Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <textarea
                  rows={8}
                  className="w-full rounded-lg border border-indigo-500/50 p-2 bg-background text-foreground focus:ring-indigo-500 focus:border-indigo-500 transition shadow-inner"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="ex: 559999999999&#10;559888888888"
                />

                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <Button
                    onClick={handleTextBatchValidate}
                    disabled={isBatchLoading || !batchText.trim()}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition text-white"
                  >
                    {isBatchLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validar Números ({batchText.trim().split('\n').filter((e) => e.trim()).length} itens)
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
                          className="border rounded-md p-1 text-sm"
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
                          <Download className="h-4 w-4" />
                          Exportar XLSX
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-popover">
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedResults.map((res, i) => (
                            <TableRow key={i} className="hover:bg-popover transition-colors">
                              <TableCell className="font-medium">{res.number}</TableCell>
                              <TableCell>{renderStatus(res.status)}</TableCell>
                              <TableCell>
                                <a
                                  href={`http://wa.me/${res.number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  Abrir <ExternalLink className="h-3 w-3" />
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
