import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { User, FileText } from 'lucide-react'

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

export function WhatsAppValidatorHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('whatsappHistory')
    if (saved) setHistory(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem('whatsappHistory', JSON.stringify(history))
  }, [history])

  const addHistoryItem = (item: Omit<HistoryItem, 'id' | 'date'>) => {
    const newItem: HistoryItem = {
      id: String(history.length + 1),
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...item,
    }
    setHistory([newItem, ...history])
  }

  return (
    <div className="overflow-x-auto mt-6">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b-0">
            <TableHead className="w-[100px] text-muted-foreground font-normal p-3">Data</TableHead>
            <TableHead className="w-[80px] text-muted-foreground font-normal p-3">Tipo</TableHead>
            <TableHead className="text-muted-foreground font-normal p-3">Entrada</TableHead>
            <TableHead className="text-center text-muted-foreground font-normal p-3">Status</TableHead>
            <TableHead className="text-right text-muted-foreground font-normal p-3">Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.slice(0, 10).map((item) => (
            <TableRow key={item.id} className="border-b-0">
              <TableCell className="text-xs text-muted-foreground p-3">
                <div className="flex flex-col">
                  <span>{item.date.split(' ')[0]}</span>
                  <span className="text-foreground/70">{item.date.split(' ')[1]}</span>
                </div>
              </TableCell>
              <TableCell className="p-3">
                <Badge
                  variant={item.type === 'Único' ? 'secondary' : 'outline'}
                  className={`flex items-center gap-1 w-fit font-medium text-xs h-6 ${
                    item.type === 'Único'
                      ? 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border-muted/50'
                  }`}
                >
                  {item.type === 'Único' ? <User className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell className="font-medium truncate max-w-xs p-3">{item.input}</TableCell>
              <TableCell className="text-center p-3">
                <Badge
                  variant="default"
                  className={`${
                    item.status === 'Concluído'
                      ? 'bg-success/10 text-success border-none hover:bg-success/20 font-medium'
                      : 'bg-destructive/10 text-destructive border-none hover:bg-destructive/20 font-medium'
                  }`}
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm p-3 whitespace-nowrap">
                <span className="text-success font-semibold">{item.valid}</span>
                <span className="text-foreground/50 font-normal"> / </span>
                <span className="text-destructive font-semibold">{item.invalid}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
