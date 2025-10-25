import { Link } from 'react-router-dom'
import { Menu, Combine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Sidebar } from '@/components/Sidebar'
import { useState } from 'react'


export function Header() {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm shadow-subtle">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
      <Link to="/" className="flex items-center gap-2">
        <img
          src="/logoDibai.png"
          alt="Logo Dibai"
          className="h-[8rem] w-[8rem] object-contain"
        />
      </Link>


        <div className="flex items-center gap-2">
          <div className="hidden md:flex">
            <ThemeToggle />
          </div>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full max-w-xs p-4">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <Link
                    to="/"
                    className="flex items-center gap-2"
                    onClick={() => setIsSheetOpen(false)}
                  >
                    <Combine className="h-6 w-6 text-primary" />
                    <span className="text-lg font-semibold">Dibai Hub</span>
                  </Link>
                  <ThemeToggle />
                </div>
                <Sidebar onLinkClick={() => setIsSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
