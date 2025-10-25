import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileText, User } from 'lucide-react'

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

const validationHistory: HistoryItem[] = [
  {
    id: '1',
    date: '2024-10-08 14:30',
    type: 'Em Lote',
    input: 'lista_clientes.csv',
    status: 'Concluído',
    valid: 450,
    invalid: 50,
    total: 500,
  },
  {
    id: '2',
    date: '2024-10-08 11:15',
    type: 'Único',
    input: 'contato@empresa.com',
    status: 'Concluído',
    valid: 1,
    invalid: 0,
    total: 1,
  },
  {
    id: '3',
    date: '2024-10-07 18:00',
    type: 'Em Lote',
    input: 'prospects_q3.csv',
    status: 'Concluído',
    valid: 1890,
    invalid: 110,
    total: 2000,
  },
  {
    id: '4',
    date: '2024-10-07 09:45',
    type: 'Único',
    input: 'email_invalido@.com',
    status: 'Concluído',
    valid: 0,
    invalid: 1,
    total: 1,
  },
]

export function EmailValidatorHistory() {
  // REMOVIDO: O <Card> envolvente, pois o componente Index já o fornece.
  return (
    // REMOVIDO: O div com 'border rounded-lg' que adicionava a borda extra.
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {/* Adicionada a classe 'border-b-0' para garantir que a linha do header seja invisível, como na imagem. */}
          <TableRow className="hover:bg-transparent border-b-0">
            <TableHead className="w-[100px] text-muted-foreground font-normal p-3">Data</TableHead>
            <TableHead className="w-[80px] text-muted-foreground font-normal p-3">Tipo</TableHead>
            <TableHead className="text-muted-foreground font-normal p-3">Entrada</TableHead>
            <TableHead className="text-center text-muted-foreground font-normal p-3">Status</TableHead>
            <TableHead className="text-right text-muted-foreground font-normal p-3">Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {validationHistory.map((item) => (
            // Removida a borda inferior de cada linha
            <TableRow key={item.id} className="border-b-0"> 
              <TableCell className="text-xs text-muted-foreground p-3">
                {/* Separando Data e Hora como na imagem */}
                <div className="flex flex-col">
                    <span>{item.date.split(' ')[0]}</span>
                    <span className="text-foreground/70">{item.date.split(' ')[1]}</span>
                </div>
              </TableCell>
              <TableCell className="p-3">
                <Badge
                  // Usando 'secondary' para Único (ícone User) e 'outline' para Em Lote (ícone FileText)
                  variant={item.type === 'Único' ? 'secondary' : 'outline'}
                  // Aplicando cores mais neutras e classes customizadas para se parecer com a imagem
                  className={`flex items-center gap-1 w-fit font-medium text-xs h-6 ${
                    item.type === 'Único' 
                      ? 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20' 
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border-muted/50'
                  }`}
                >
                  {item.type === 'Único' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {item.type === 'Único' ? 'Único' : 'Em Lote'}
                </Badge>
              </TableCell>
              <TableCell className="font-medium truncate max-w-xs p-3">
                {item.input}
              </TableCell>
              <TableCell className="text-center p-3">
                {/* O status na imagem é um verde mais escuro sem bordas fortes */}
                <Badge
                  variant="default" // Usamos 'default' e sobrepomos as cores
                  className={`
                    ${item.status === 'Concluído'
                        ? 'bg-success/10 text-success border-none hover:bg-success/20 font-medium'
                        : 'bg-destructive/10 text-destructive border-none hover:bg-destructive/20 font-medium'
                    }
                  `}
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm p-3 whitespace-nowrap">
                {/* Ajuste de cor e fonte para resultado */}
                <span className="text-success font-semibold">
                  {item.valid}
                </span>
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