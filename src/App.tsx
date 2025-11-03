/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import EmailValidatorPage from './pages/EmailValidator'
import SpreadsheetConverterPage from './pages/SpreadsheetConverter'
import ExtratorEmail from './pages/ExtratorEmail'
import AudioTranscriber from './pages/AudioTranscriber'
import SpeedioAssertivaConverter from './pages/SpeedioAssertivaConverter'
import ExtratorNumero from './pages/ExtratorNumero'
import WhatsappValidator from './pages/WhatsappValidator'
import Salesforce from './pages/Salesforce'

const App = () => (
  <BrowserRouter
    future={{ v7_startTransition: false, v7_relativeSplatPath: false }}
  >
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/email-validator" element={<EmailValidatorPage />} />
            <Route
              path="/spreadsheet-converter"
              element={<SpreadsheetConverterPage />}
            />
            <Route
              path="/extrator-email"
              element={<ExtratorEmail />}
            />
            <Route
              path="/audio-transcriber"
              element={<AudioTranscriber />}
            />
            <Route
              path="/speedio-assertiva-converter"
              element={<SpeedioAssertivaConverter />}
            />
            <Route
              path="/extrator-numero"
              element={<ExtratorNumero />}
            />
            <Route
              path="/whatsapp-validator"
              element={<WhatsappValidator />}
            />
            <Route
              path="/salesforce"
              element={<Salesforce />}
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </ThemeProvider>
  </BrowserRouter>
)

export default App
