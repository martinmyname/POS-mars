/**
 * Export tabular data to CSV for download.
 * Filename gets a date suffix: name_YYYY-MM-DD.csv
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escape = (cell: string | number): string => {
    const s = String(cell);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
