/**
 * Utility to dynamically import exceljs for client-side export
 * This prevents Node.js built-in modules from being bundled client-side
 */
export async function getExcelJS() {
  const ExcelJS = await import("exceljs");
  return ExcelJS;
}
