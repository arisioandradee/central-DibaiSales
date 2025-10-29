import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, MailCheck, Sheet as SheetIcon, Users, Mic, FileSpreadsheet, Mails, Phone, Headset} from 'lucide-react'

interface SidebarProps {
  className?: string
  onLinkClick?: () => void
}

const navigation = [
  { name: 'Dibai Hub', href: '/', icon: Home },
  { name: 'Validador de E-mail', 
    href: '/email-validator', 
    icon: MailCheck },
  /*{
    name: 'Extrator de E-mails',
    href: '/extrator-email',
    icon: Mails,
  },*/
  {
    name: 'Extrator de Números',
    href: '/extrator-numero',
    icon: Phone,
  },
  {
    name: 'CRM Builder',
    href: '/spreadsheet-converter',
    icon: FileSpreadsheet,
  }, 
  /*{
    name: 'Speedio/Assertiva',
    href: '/speedio-assertiva-converter',
    icon: SheetIcon,
  },*/
  {
    name: 'Transcritor de Áudios',
    href: '/audio-transcriber',
    icon: Mic,
  },
  {
    name: 'Agente de Ligações',
    href: 'https://ia-dibaisales.vercel.app/',
    icon: Headset,
  },
]

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  return (
    <nav className={cn('flex flex-col space-y-2', className)}>
      {navigation.map((item) => (
        <NavLink
          key={item.name}
          to={item.href}
          onClick={onLinkClick}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )
          }
          end={item.href === '/'}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.name}</span>
        </NavLink>
      ))}
    </nav>
  )
}

