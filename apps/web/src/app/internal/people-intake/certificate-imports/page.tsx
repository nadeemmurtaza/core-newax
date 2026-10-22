import type { Metadata } from 'next';
import { CertificateImportWorkspace } from './workspace';

export const metadata: Metadata = {
  title: 'Certificate Import | NEWAX Core',
  robots: { index: false, follow: false },
};

export default function CertificateImportPage() {
  return <CertificateImportWorkspace />;
}
