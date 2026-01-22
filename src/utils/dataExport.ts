/**
 * Data export/import barrel file
 * Re-exports all export/import functions from specialized modules
 *
 * This file maintains backward compatibility while delegating to specialized services:
 * - exportService.ts: Export data from database
 * - dataValidation.ts: Validate imported data
 * - importService.ts: Import data into database
 * - fileHandling.ts: File I/O operations
 */

export { exportAllData, downloadExportFile } from './export/exportService';
export { validateImportData } from './export/dataValidation';
export { importData } from './export/importService';
export { readFileAsJson } from './export/fileHandling';
