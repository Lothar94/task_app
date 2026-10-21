/** Saves text as a file through a temporary link, as the browser's download. */
export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** UTF-8 CSV download; the BOM makes spreadsheets read accents correctly. */
export const downloadCsv = (fileName: string, csv: string): void =>
  downloadFile(fileName, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
