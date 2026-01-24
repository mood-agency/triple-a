import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Database, Download } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import {
  DataMigrationService,
  downloadBackup,
  type MigrationProgress,
  type MigrationResult,
  type VerificationResult,
} from '@/services/DataMigrationService';
import {
  enableTinyBase,
  markMigrationComplete,
} from '@/config/featureFlags';

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MigrationStep = 'intro' | 'backup' | 'migrating' | 'verifying' | 'complete' | 'error';

export function MigrationDialog({ open, onOpenChange }: MigrationDialogProps) {
  const { db: sqlDb } = useDatabase();
  const { store: tinybaseStore } = useTinyBase();

  const [step, setStep] = useState<MigrationStep>('intro');
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [backupData, setBackupData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartMigration = async () => {
    if (!sqlDb || !tinybaseStore) {
      setError('Database not ready');
      setStep('error');
      return;
    }

    try {
      // Step 1: Backup
      setStep('backup');
      setProgress({ table: 'backup', current: 0, total: 1, phase: 'backup' });

      const service = new DataMigrationService(sqlDb, tinybaseStore, setProgress);
      const backup = service.exportBackup();
      setBackupData(backup);

      setProgress({ table: 'backup', current: 1, total: 1, phase: 'backup' });

      // Step 2: Migration
      setStep('migrating');
      const result = await service.migrateAll();
      setMigrationResult(result);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors.join('\n'));
        setStep('error');
        return;
      }

      // Step 3: Verification
      setStep('verifying');
      const verification = await service.verify();
      setVerificationResult(verification);

      if (!verification.success) {
        setError(verification.errors.join('\n'));
        setStep('error');
        return;
      }

      // Success!
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  const handleDownloadBackup = () => {
    if (backupData) {
      downloadBackup(backupData);
    }
  };

  const handleEnableTinyBase = () => {
    markMigrationComplete();
    enableTinyBase();
    window.location.reload();
  };

  const handleClose = () => {
    if (step === 'migrating' || step === 'verifying') {
      // Don't allow closing during migration
      return;
    }
    setStep('intro');
    setProgress(null);
    setMigrationResult(null);
    setVerificationResult(null);
    setBackupData(null);
    setError(null);
    onOpenChange(false);
  };

  const getProgressPercent = () => {
    if (!progress) return 0;
    if (progress.total === 0) return 100;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {step === 'intro' && 'Migrate to TinyBase'}
            {step === 'backup' && 'Creating Backup...'}
            {step === 'migrating' && 'Migrating Data...'}
            {step === 'verifying' && 'Verifying Migration...'}
            {step === 'complete' && 'Migration Complete'}
            {step === 'error' && 'Migration Error'}
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Migrate your data from SQL.js to TinyBase for improved performance and offline sync.'}
            {step === 'backup' && 'Creating a backup of your current data...'}
            {step === 'migrating' && `Migrating ${progress?.table || ''}...`}
            {step === 'verifying' && 'Verifying data integrity...'}
            {step === 'complete' && 'Your data has been successfully migrated.'}
            {step === 'error' && 'An error occurred during migration.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Intro */}
          {step === 'intro' && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  A backup will be created before migration. You can download it at any time.
                </AlertDescription>
              </Alert>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">What will happen:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your data will be copied to TinyBase</li>
                  <li>A backup of your SQL database will be created</li>
                  <li>Migration will be verified for data integrity</li>
                  <li>You can switch back anytime if needed</li>
                </ul>
              </div>
            </div>
          )}

          {/* Progress */}
          {(step === 'backup' || step === 'migrating' || step === 'verifying') && (
            <div className="space-y-4">
              <Progress value={getProgressPercent()} className="h-2" />
              <div className="text-sm text-center text-muted-foreground">
                {progress?.phase === 'backup' && 'Creating backup...'}
                {progress?.phase === 'migrate' && `Migrating ${progress.table}: ${progress.current}/${progress.total}`}
                {progress?.phase === 'verify' && `Verifying ${progress.table}...`}
              </div>
            </div>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              {migrationResult && (
                <div className="text-sm text-muted-foreground">
                  <p>Migrated {migrationResult.rowsMigrated} rows from {migrationResult.tablesProcessed} tables.</p>
                  <p>Duration: {(migrationResult.duration / 1000).toFixed(1)}s</p>
                </div>
              )}
              {verificationResult && (
                <div className="text-sm">
                  <p className="font-medium mb-2">Verification Results:</p>
                  <ul className="space-y-1">
                    {verificationResult.details.map((detail) => (
                      <li key={detail.table} className="flex items-center gap-2">
                        {detail.match ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{detail.table}: {detail.tinybaseCount} rows</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <Alert variant="destructive">
                <AlertDescription className="whitespace-pre-wrap text-sm">
                  {error}
                </AlertDescription>
              </Alert>
              {backupData && (
                <Button variant="outline" onClick={handleDownloadBackup} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'intro' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStartMigration}>
                Start Migration
              </Button>
            </>
          )}

          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={handleDownloadBackup}>
                <Download className="h-4 w-4 mr-2" />
                Download Backup
              </Button>
              <Button onClick={handleEnableTinyBase}>
                Enable TinyBase
              </Button>
            </>
          )}

          {step === 'error' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
