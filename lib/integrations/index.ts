/**
 * Import/export adapters (ARCHITECTURE.md §7): CSV import/export and manual
 * external-source adapters (incl. SSQRD manual discovery). No scraping, no
 * fabricated live integrations (§2.2).
 */
export {
  RESEARCH_CSV_COLUMNS,
  PERMISSION_STATES,
  parseCsv,
  validateResearchCsv,
  researchCsvRowSchema,
  type CsvImportValidation,
  type CsvRowError,
  type ResearchCsvRow,
} from "./csv";
