/**
 * Hook utilitaire pour exporter un tableau en CSV côté client.
 * Gère l'encodage UTF-8 avec BOM pour Excel.
 */

function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
) {
  const headerLine = headers.map(escapeCSV).join(",")
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","))
  const csv = "\uFEFF" + [headerLine, ...dataLines].join("\r\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
