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

type HistoryItem = {
  id: string
  date: string
  fileName: string
  status: 'Concluído' | 'Falhou'
  contactsExtracted: number
}

const extractorHistory: HistoryItem[] = [
  {
    id: '1',
    date: '2024-10-08 10:05',
    fileName: 'telefonesEmpresa.csv',
    status: 'Concluído',
    contactsExtracted: 15,
  },
  {
    id: '2',
    date: '2024-10-07 16:20',
    fileName: 'telefones_parceiros.csv',
    status: 'Concluído',
    contactsExtracted: 88,
  },
  {
    id: '3',
    date: '2024-10-06 11:00',
    fileName: 'telefones.csv',
    status: 'Falhou',
    contactsExtracted: 0,
  },
  {
    id: '4',
    date: '2024-10-05 15:45',
    fileName: 'teste.csv',
    status: 'Concluído',
    contactsExtracted: 210,
  },
  {
  id: '5',
  date: '2024-10-05 23:10',
  fileName: 'teste_telefones.csv',
  status: 'Falhou',
  contactsExtracted: 210,
  },
]

export function PartnerContactExtractorHistory() {
  // REMOVIDO: O <Card> e <CardHeader> e <CardDescription> envolventes,
  // pois o componente Index (pai) já fornece o container Card e o título/descrição.
  
  return (
    // REMOVIDO: O div com 'border rounded-lg' que adicionava a borda extra.
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {/* Classe 'border-b-0' para remover a borda do header, focando na clareza. */}
          <TableRow className="hover:bg-transparent border-b-0">
            <TableHead className="w-[100px] text-muted-foreground font-normal p-3">Data</TableHead>
            <TableHead className="text-muted-foreground font-normal p-3">Arquivo</TableHead>
            <TableHead className="text-center text-muted-foreground font-normal p-3">Status</TableHead>
            <TableHead className="text-right text-muted-foreground font-normal p-3">Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extractorHistory.slice(0, 10).map((item) => (
            <TableRow key={item.id} className="border-b-0">
              <TableCell className="text-xs text-muted-foreground p-3">
                {/* Separando Data e Hora */}
                <div className="flex flex-col">
                    <span>{item.date.split(' ')[0]}</span>
                    <span className="text-foreground/70">{item.date.split(' ')[1]}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium truncate max-w-xs p-3">
                {item.fileName}
              </TableCell>
              <TableCell className="text-center p-3">
                <Badge
                  variant="default" // Usamos 'default' e sobrepomos as cores
                  className={`
                    font-medium
                    ${item.status === 'Concluído'
                        ? 'bg-success/10 text-success border-none hover:bg-success/20'
                        : 'bg-destructive/10 text-destructive border-none hover:bg-destructive/20'
                    }
                  `}
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-sm p-3 whitespace-nowrap">
                {item.status === 'Concluído' ? (
                  <>
                    <span className="font-medium">{item.contactsExtracted} contatos</span>
                    <span className="text-foreground/50 font-normal"></span>
                  </>
                ) : (
                  <span className="text-muted-foreground font-medium">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}