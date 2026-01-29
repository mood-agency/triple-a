import { useState } from 'react';
import { CloudUpload, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';

interface SyncDiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DiagnosticData = Record<string, { total: number; pending: number; local: number }>;
type DiagnosticDetails = { table: string; type: 'pending' | 'local'; items: Record<string, unknown>[] };

export function SyncDiagnosticsDialog({ open, onOpenChange }: SyncDiagnosticsDialogProps) {
  const { store } = useTinyBase();
  const { user } = useAuth();
  const { connectionStatus, error: syncError, pushAllToSupabase, isPushingAll, isPullingAll, retryQueueLength, conflicts, syncNow } = useSync();

  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [diagnosticDetails, setDiagnosticDetails] = useState<DiagnosticDetails | null>(null);

  const canPush = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;

  const collectDiagnosticData = () => {
    if (!store) return;

    const tables = ['notes', 'labels', 'contacts', 'projects', 'note_labels', 'note_assignees', 'note_versions', 'note_actions'] as const;
    const data: DiagnosticData = {};

    tables.forEach((tableName) => {
      const table = store.getTable(tableName) || {};
      const rows = Object.values(table);
      data[tableName] = {
        total: rows.length,
        pending: rows.filter((row) => (row as Record<string, unknown>).sync_status === 'pending').length,
        local: rows.filter((row) => (row as Record<string, unknown>).sync_status === 'local').length,
      };
    });

    setDiagnosticData(data);
    setDiagnosticDetails(null);
  };

  const showDiagnosticDetails = (tableName: string, type: 'pending' | 'local') => {
    if (!store) return;

    const table = store.getTable(tableName) || {};
    const rows = Object.entries(table);
    const filteredItems = rows
      .filter(([, row]) => (row as Record<string, unknown>).sync_status === type)
      .map(([id, row]) => ({ id, ...(row as Record<string, unknown>) }));

    if (filteredItems.length > 0) {
      setDiagnosticDetails({ table: tableName, type, items: filteredItems });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !diagnosticData) {
      collectDiagnosticData();
    }
    if (!newOpen) {
      setDiagnosticDetails(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync Diagnostics</DialogTitle>
          <DialogDescription>
            Detailed sync status for all tables
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4 max-h-[50vh] overflow-y-auto pr-2">
          {diagnosticData && Object.entries(diagnosticData).map(([table, stats]) => (
            <div key={table} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{table}</span>
                <span className="text-xs text-muted-foreground">{stats.total} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  role="button"
                  tabIndex={stats.pending > 0 ? 0 : -1}
                  onClick={() => { if (stats.pending > 0) showDiagnosticDetails(table, 'pending'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && stats.pending > 0) showDiagnosticDetails(table, 'pending'); }}
                  className={`flex items-center justify-between px-2 py-1 bg-yellow-500/10 rounded ${stats.pending > 0 ? 'cursor-pointer hover:bg-yellow-500/20' : 'opacity-70'}`}
                >
                  <span>Pending:</span>
                  <span className={stats.pending > 0 ? 'font-semibold text-yellow-600' : ''}>{stats.pending}</span>
                </div>
                <div
                  role="button"
                  tabIndex={stats.local > 0 ? 0 : -1}
                  onClick={() => { if (stats.local > 0) showDiagnosticDetails(table, 'local'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && stats.local > 0) showDiagnosticDetails(table, 'local'); }}
                  className={`flex items-center justify-between px-2 py-1 bg-blue-500/10 rounded ${stats.local > 0 ? 'cursor-pointer hover:bg-blue-500/20' : 'opacity-70'}`}
                >
                  <span>Local:</span>
                  <span className={stats.local > 0 ? 'font-semibold text-blue-600' : ''}>{stats.local}</span>
                </div>
              </div>
            </div>
          ))}
          {/* Retry Queue */}
          {retryQueueLength > 0 && (
            <div className="mt-4 p-3 bg-orange-500/10 text-orange-700 dark:text-orange-400 text-sm rounded">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <RefreshCw className="h-4 w-4" />
                Retry Queue: {retryQueueLength} items
              </div>
              <div className="text-xs">
                These items will be retried automatically with exponential backoff.
              </div>
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm rounded">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <AlertTriangle className="h-4 w-4" />
                Conflicts: {conflicts.length}
              </div>
              <div className="text-xs">
                Some items have conflicting changes that need to be resolved.
              </div>
            </div>
          )}

          {syncError && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
              <div className="font-semibold mb-1">Sync Error:</div>
              <div className="text-xs">{syncError}</div>
            </div>
          )}
          {diagnosticDetails && (
            <div className="mt-4 p-3 bg-muted rounded border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">
                  {diagnosticDetails.table} - {diagnosticDetails.type} ({diagnosticDetails.items.length})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDiagnosticDetails(null)}
                  className="h-6 px-2 text-xs"
                >
                  Close
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {diagnosticDetails.items.map((item, index) => (
                  <div key={index} className="text-xs p-2 bg-background rounded border">
                    <pre className="whitespace-pre-wrap break-all font-mono">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={async () => {
              await syncNow();
              collectDiagnosticData();
            }}
            disabled={!canPush}
            className="w-full"
            variant="secondary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Now
          </Button>
          <Button
            onClick={async () => {
              await pushAllToSupabase();
              collectDiagnosticData();
            }}
            disabled={!canPush}
            className="w-full"
          >
            <CloudUpload className="h-4 w-4 mr-2" />
            Force Push All
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
