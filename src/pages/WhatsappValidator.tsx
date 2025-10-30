import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, CheckCircle, XCircle, HelpCircle, Download } from 'lucide-react'
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

// Mapeamento de status para label e cor
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

// Máximo de requisições simultâneas
const MAX_CONCURRENT_REQUESTS = 10

export default function WhatsAppValidatorPage() {
  const [singleNumber, setSingleNumber] = useState('')
  const [isSingleLoading, setIsSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState<BatchResult | null>(null)

  const [batchText, setBatchText] = useState('')
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const { toast } = useToast()

  // ================== HISTÓRICO ==================
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

  // ================== VALIDAÇÃO ÚNICA ==================
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

      // Salvar no histórico
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

  // ================== VALIDAÇÃO EM LOTE ==================
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

      // Adicionar ao histórico
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

  // ================== AUXILIARES ==================
  const renderStatus = (status: ValidationStatus) => {
    const config = statusConfig[status] || statusConfig.unknown
    return (
      <div className={cn('flex items-center gap-2', config.color)}>
        <config.icon className="h-4 w-4" />
        <span className="font-medium">{config.label}</span>
      </div>
    )
  }

  const exportResults = () => {
    if (batchResults.length === 0) return
    const wsData = [['Número', 'Status'], ...batchResults.map((r) => [r.number, statusMap[r.status]?.label || r.status])]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `validation_results_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ================== RENDER ==================
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

          {/* Validação Única */}
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

          {/* Validação em Lote */}
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
                      <h3 className="text-lg font-semibold">Resultados ({batchResults.length})</h3>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-popover">
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchResults.map((res, i) => (
                            <TableRow key={i} className="hover:bg-popover transition-colors">
                              <TableCell className="font-medium">{res.number}</TableCell>
                              <TableCell>{renderStatus(res.status)}</TableCell>
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
