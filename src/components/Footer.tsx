export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container flex h-14 items-center justify-center px-4 md:px-6">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Dibai Sales. Todos os
          direitos reservados.
        </p>
      </div>
    </footer>
  )
}
