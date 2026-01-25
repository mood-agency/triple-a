import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Upload, FileJson, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import {
  exportAllData,
  downloadExportFile,
  importData,
  readFileAsJson,
  validateImportData,
} from '@/utils/dataExport';
import type { ImportResult } from '@/types/note';

export function ImportExportDialog() {
  const { t } = useTranslation();
  const { store } = useTinyBase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    if (!store) return;

    try {
      const data = exportAllData(store);
      downloadExportFile(data);
      setError(null);
      toast.success(t('toast.exportSuccess'));
    } catch (err) {
      setError(t('importExport.exportError'));
      toast.error(t('toast.exportError'));
      console.error('Export error:', err);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const json = await readFileAsJson(file);

      if (!validateImportData(json)) {
        setError(t('importExport.invalidFormat'));
        setImporting(false);
        return;
      }

      const result = await importData(store, json, { useCurrentDate: true });
      setImportResult(result);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0]);
        toast.error(t('toast.importError'));
      } else {
        toast.success(t('toast.importSuccess'));
      }
    } catch (err) {
      setError(t('importExport.importError'));
      toast.error(t('toast.importError'));
      console.error('Import error:', err);
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setImportResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileJson className="h-4 w-4 mr-2" />
          {t('importExport.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importExport.title')}</DialogTitle>
          <DialogDescription>{t('importExport.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Export Section */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">{t('importExport.export')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('importExport.exportDescription')}
            </p>
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {t('importExport.exportButton')}
            </Button>
          </div>

          <div className="border-t" />

          {/* Import Section */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">{t('importExport.import')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('importExport.importDescription')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={handleImportClick}
              variant="outline"
              className="w-full"
              disabled={importing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? t('importExport.importing') : t('importExport.importButton')}
            </Button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {importResult && importResult.success && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              {t('importExport.importSuccess', {
                notes: importResult.notesImported,
                history: importResult.historyImported,
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
