// CSV export utilities

export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(rows: any[], headers: string[]): string {
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.map(escapeCSV).join(','));

  // Add data rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const keys = header.split('.');
      let value: any = row;
      for (const key of keys) {
        value = value?.[key];
      }
      return value ?? '';
    });
    csvRows.push(values.map(escapeCSV).join(','));
  }

  return csvRows.join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
