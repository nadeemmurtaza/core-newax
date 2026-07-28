const REDACTIONS = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    '<redacted-private-key>',
  ],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '<redacted-github-token>'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, 'Bearer <redacted-token>'],
  [
    /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s@/]+:[^\s@/]+@/gi,
    '$1://<redacted-credentials>@',
  ],
  [/\b(api[_-]?key|password|passwd|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=<redacted>'],
];

export function sanitizeEngineeringEvidence(value) {
  let sanitized = String(value ?? '');
  for (const [pattern, replacement] of REDACTIONS) {
    sanitized = sanitized.replaceAll(pattern, replacement);
  }
  return sanitized;
}
