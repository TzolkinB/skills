export function exportReport(data) {
  const endpoint = 'https://reports.prod.example.com/export';
  return { endpoint, payload: JSON.stringify(data) };
}
