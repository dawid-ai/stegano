/**
 * Scan report builder for exporting findings as structured JSON.
 *
 * @module export
 */

/** Structured scan report for clipboard/file export */
export interface ScanReport {
  version: 1;
  url: string;
  timestamp: string;
  summary: {
    total: number;
    tags: number;
    zerowidth: number;
    watermark: number;
  };
  findings: ScanReportFinding[];
}

interface ScanReportFinding {
  type: 'tags' | 'zerowidth' | 'watermark';
  replacement: string;
  codepoints: string[];
  position: { start: number; end: number };
}

/**
 * Build a structured ScanReport from raw findings data.
 *
 * @param data - Raw findings from the content script's getFindings response
 * @returns A versioned ScanReport with summary counts and normalized findings
 */
export function buildScanReport(data: {
  findings: Array<{
    type: 'tags' | 'zerowidth' | 'watermark';
    replacement: string;
    original: string;
    codepoints: string[];
    position: { start: number; end: number };
  }>;
  url: string;
  timestamp: string;
}): ScanReport {
  const summary = { total: 0, tags: 0, zerowidth: 0, watermark: 0 };
  const reportFindings: ScanReportFinding[] = [];

  for (const f of data.findings) {
    summary.total++;
    summary[f.type]++;
    reportFindings.push({
      type: f.type,
      replacement: f.replacement,
      codepoints: f.codepoints,
      position: f.position,
    });
  }

  return {
    version: 1,
    url: data.url,
    timestamp: data.timestamp,
    summary,
    findings: reportFindings,
  };
}
