import { Link } from 'react-router-dom'
import React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MailCheck, 
  Phone, 
  FileSpreadsheet, 
  Mic, 
  Headset, 
  Smartphone,
  ArrowRight, 
  Search, 
  History,
  FileCheck,
  Construction
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EmailValidatorHistory } from '@/components/EmailValidatorHistory'
import { PartnerContactExtractorHistory } from '@/components/PartnerContactExtractorHistory'
import { WhatsAppValidatorHistory} from '@/components/WhatsappValidatorHistory'
import WhatsAppValidatorPage from './WhatsappValidator'

// --- COMPONENTE AUXILIAR (Ação Rápida no Card) ---
interface ActionButtonProps {
  to: string
  text: string
  icon: React.ElementType
  variant?: 'default' | 'secondary'
  disabled?: boolean
}

const ActionButton: React.FC<ActionButtonProps> = ({
  to,
  text,
  icon: Icon,
  variant = 'default',
  disabled = false,
}) => (
  <Button
    asChild
    variant={variant}
    className={`w-full max-w-[180px] text-sm font-semibold h-11 transition-transform duration-200 hover:scale-[1.01] border-none ${disabled ? 'pointer-events-none opacity-60' : ''}`}
  >
    <Link to={to}>
      {text}
      <Icon className="ml-2 h-4 w-4" />
    </Link>
  </Button>
)

export default function Index() {
  const [search, setSearch] = React.useState('')

  const tools = [
    {
      title: 'CRM Builder',
      description: 'Transforme leads brutos em 5 arquivos Excel formatados para sistemas CRM.',
      icon: FileSpreadsheet,
      actions: [
        { to: '/spreadsheet-converter', text: 'Converter Planilha', icon: ArrowRight },
      ],
    },
      {
      title: 'Salesforce Builder',
      description: 'Transforme uma planilha para o formato Salesforce.',
      icon: FileCheck,
      actions: [
        { to: '/salesforce', text: 'Acessar Conversor', icon: ArrowRight},
      ],
    },
    {
      title: 'Validador de E-mail',
      description: 'Verifique e-mails individualmente ou em lote para garantir a qualidade dos leads.',
      icon: MailCheck,
      actions: [
        { to: '/email-validator', text: 'Acessar Validador', icon: ArrowRight },
      ],
    },
    {
      title: 'Validador de Whatsapp',
      description: 'Valide números de WhatsApp rapidamente e garanta que seus contatos estão ativos.',
      icon: Smartphone,
      actions: [
        { to: '/whatsapp-validator', text: 'Acessar Validador', icon: ArrowRight},
      ],
    },
    {
      title: 'Extrator de Números',
      description: 'Extraia telefones de uma planilha no formato da Dibai Sales e receba os arquivos no formato ideal para subir no nosso Agente.',
      icon: Phone,
      actions: [
        { to: '/extrator-numero', text: 'Acessar Extrator', icon: ArrowRight },
      ],
    },

    {
      title: 'Transcritor de Áudios',
      description: 'Converta arquivos de áudio de reuniões ou chamadas em texto de forma instantânea.',
      icon: Mic,
      actions: [
        { to: '/audio-transcriber', text: 'Iniciar Transcrição', icon: ArrowRight },
      ],
    },
    {
      title: 'Agente de Ligações',
      description: 'Acesse a plataforma para subir campanhas no Agente',
      icon: Headset,
      actions: [
        { to: 'https://ia-dibaisales.vercel.app/', text: 'Acessar plataforma', icon: ArrowRight, external: true },
      ],
    },
    {
      title: 'Em Breve',
      description: 'Próxima ferramenta em desenvolvimento.',
      icon: Construction,
      actions: [
        { 
          to: '#', 
          text: 'Em Breve', 
          icon: ArrowRight, 
          disabled: true,  
          variant: 'secondary'
        },
      ],
    }
  ]

  const filteredTools = tools.filter(tool =>
    tool.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-1 flex-col gap-12 p-4 md:p-12 bg-background">
      <header className="max-w-6xl mx-auto w-full text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-foreground mb-3">
          Central <span className="text-primary">Dibai Sales</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Sua central inteligente de ferramentas para otimizar processos e extrair dados valiosos.
        </p>

        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar ferramenta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-7 pl-10 pr-4 text-base shadow-xl transition-shadow duration-300 hover:shadow-2xl focus:shadow-2xl focus-visible:ring-primary/50"
          />
        </div>
      </header>

      {/* 2. SEÇÃO DE FERRAMENTAS (CARDS) */}
      <div className="max-w-8xl mx-auto w-full min-h-[500px]"> 
        {/* min-h garante que a área não encolha demais */}
        <h2 className="text-3xl font-bold tracking-tight mb-8 text-foreground">
          Ferramentas
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredTools.map((tool) => (
            <Card
              key={tool.title}
              className={`
                flex flex-col h-full p-2 border-l-4 transition-all duration-300
                hover:scale-[1.02] border-l-primary/50 hover:border-l-primary/80
                hover:shadow-xl dark:hover:shadow-[0_10px_15px_-3px_rgba(59,130,246,0.1),0_4px_6px_-2px_rgba(59,130,246,0.3)]
              `}
            >
              <CardHeader className="flex-grow p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="p-4 rounded-xl bg-primary/15 shrink-0">
                    <tool.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-extrabold text-foreground">
                      {tool.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {tool.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0 p-4 md:p-6">
                <div className={`flex flex-wrap ${tool.actions.length > 1 ? 'flex-row' : 'flex-col'} gap-4`}>
                  {tool.actions.map((action, index) => (
                    <ActionButton
                      key={index}
                      to={action.to}
                      text={action.text}
                      icon={action.icon}
                      variant={action.variant}
                      disabled={action.disabled}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. SEÇÃO DE HISTÓRICOS */}
      <div className="max-w-8xl mx-auto w-full mt-10">
        <h2 className="text-3xl font-bold tracking-tight mb-8 text-foreground flex items-center">
          <History className="w-6 h-6 mr-2 text-primary" />
          Atividade Recente e Históricos
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="p-0 border shadow-lg">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold">Histórico do Validador de E-mails</CardTitle>
              <EmailValidatorHistory />
            </CardContent>
          </Card>

          <Card className="p-0 border shadow-lg">
            <CardContent className="p-6">
              <CardTitle className="text-xl font-semibold">Histórico do Validador de Whatsapp</CardTitle>
              <WhatsAppValidatorHistory />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
