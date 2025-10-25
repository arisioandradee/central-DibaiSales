import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Download, SheetIcon } from 'lucide-react';

// --- Componente Card ---
const Card = ({ title, description, children }: any) => (
  <div className="bg-card text-foreground rounded-xl shadow-2xl dark:shadow-black/20 border border-border p-6 w-full">
    <div className="border-b border-border pb-4 mb-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

// --- Componente Alert ---
const Alert = ({ variant, title, description, icon: Icon }: any) => {
  const baseClasses = "p-4 rounded-lg shadow-md flex items-start space-x-3";
  let classes = baseClasses;
  let iconColor = "text-gray-500";

  if (variant === 'destructive') {
    classes += " bg-destructive/10 border border-destructive/20 text-destructive-foreground";
    iconColor = "text-destructive";
  } else {
    classes += " bg-success/10 border border-success/20 text-success-foreground";
    iconColor = "text-success";
  }

  return (
    <div className={classes}>
      {Icon && <Icon className={`h-5 w-5 ${iconColor} mt-0.5`} />}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
};

// --- Componente FileUploader ---
const FileUploader = ({ onFileSelect, acceptedFormats, instructionText }: any) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setSelectedFileName(file.name);
      onFileSelect(file);
    }
    event.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      onFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFileName(null);
    onFileSelect(null);
  };

  return (
    <div className="w-full">
      {!selectedFileName ? (
        <div
          className="border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-primary/70 transition duration-150 bg-muted/10"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('file-input-conversion')?.click()}
        >
          <p className="text-muted-foreground text-sm">{instructionText}</p>
          <p className="text-xs text-primary mt-1">Formatos aceitos: {acceptedFormats}</p>
          <input
            id="file-input-conversion"
            type="file"
            accept={acceptedFormats}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border border-primary/50 bg-primary/10 rounded-lg shadow-sm">
          <span className="text-sm text-primary truncate">{selectedFileName}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="ml-4 text-sm text-destructive hover:text-destructive-hover font-medium transition"
          >
            Remover
          </button>
        </div>
      )}
    </div>
  );
};

// --- Componente Principal ---
export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);

  const API_URL = 'http://127.0.0.1:8000/api/speedio_assertiva'
  const DOWNLOAD_FILENAME = 'planilha_convertida.xlsx';

  const handleConvert = async () => {
    if (!file) return;

    setStatus('loading');
    setErrorMessage('');
    setConvertedBlob(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(API_URL, { method: 'POST', body: formData });

      if (!response.ok) {
        let errorDetail = await response.text();
        try {
            const errorJson = JSON.parse(errorDetail);
            errorDetail = errorJson.detail || errorDetail;
        } catch {}
        setStatus('error');
        setErrorMessage(`Erro HTTP ${response.status}: ${errorDetail}`);
        return;
      }

      const blob = await response.blob();
      setConvertedBlob(blob);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Não foi possível conectar ao servidor. Verifique o backend.');
    }
  };

  const handleDownload = () => {
    if (!convertedBlob) return;
    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = DOWNLOAD_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center justify-center space-x-2 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">Convertendo sua planilha...</p>
          </div>
        );
      case 'success':
        return (
          <Alert variant="success" icon={CheckCircle} title="Conversão concluída!" description="Seu arquivo está pronto para download." />
        );
      case 'error':
        return (
          <Alert variant="destructive" icon={XCircle} title="Erro na conversão" description={errorMessage} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl space-y-8">
        <Card
          title="Upload e Processamento"
          description="Faça o upload da planilha para iniciar o processo de conversão para o formato Assertiva."
        >
          <FileUploader
            onFileSelect={(selectedFile: File | null) => {
              setFile(selectedFile);
              setStatus('idle');
            }}
            acceptedFormats=".xlsx,.xls,.csv"
            instructionText="Arraste e solte seu arquivo aqui ou clique para selecionar"
          />
          <div className="flex flex-col items-center gap-4 mt-4 w-full">
            <button
              onClick={handleConvert}
              disabled={!file || status === 'loading'}
              className={`w-full h-12 text-lg font-semibold rounded-lg transition duration-200 shadow-lg flex items-center justify-center
                ${!file || status === 'loading'
                  ? 'bg-muted-foreground/50 text-gray-200 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/50'
                }`}
            >
              {status === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Converter Planilha
            </button>

            {status !== 'idle' && renderStatus()}

            {status === 'success' && convertedBlob && (
              <button
                onClick={handleDownload}
                className="w-full h-12 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/50 flex items-center justify-center mt-4"
              >
                <Download className="mr-2 h-5 w-5" />
                Baixar Arquivo ({DOWNLOAD_FILENAME})
              </button>
            )}
          </div>
        </Card>

        {file === null && (
          <Alert
            variant="success"
            icon={SheetIcon}
            title="Aviso Importante sobre o Formato"
            description={
              <span>
                A planilha gerada pela Assertiva pode vir em <strong>.csv</strong>.<br />
                Para utilizá-la aqui, converta para <strong>.xlsx</strong> usando uma ferramenta online simples, como{' '}
                <a href="https://convertio.co/pt/csv-xlsx/" target="_blank" className="text-primary">Convertio</a>.
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}
