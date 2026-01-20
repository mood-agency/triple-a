import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDatabase } from '@/contexts/DatabaseContext';
import { persistDatabase } from '@/db';
import {
  exportAllData,
  downloadExportFile,
  importData,
  readFileAsJson,
  validateImportData,
} from '@/utils/dataExport';
import type { ImportResult } from '@/types/note';

export function SettingsMenu() {
  const { t } = useTranslation();
  const { db } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    if (!db) return;

    try {
      const data = exportAllData(db);
      downloadExportFile(data);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    setImporting(true);
    setError(null);
    setImportResult(null);
    setImportDialogOpen(true);

    try {
      const json = await readFileAsJson(file);

      if (!validateImportData(json)) {
        setError(t('importExport.invalidFormat'));
        setImporting(false);
        return;
      }

      const result = await importData(db, json, persistDatabase);
      setImportResult(result);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0]);
      }
    } catch (err) {
      setError(t('importExport.importError'));
      console.error('Import error:', err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDialogClose = () => {
    setImportDialogOpen(false);
    setImportResult(null);
    setError(null);
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('settings')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('importExport.export')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-2" />
            {t('importExport.import')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dialog open={importDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('importExport.import')}</DialogTitle>
            <DialogDescription>
              {importing ? t('importExport.importing') : t('importExport.importDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
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
    </>
  );
}
