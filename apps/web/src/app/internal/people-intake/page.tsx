import type { Metadata } from 'next';

import { PeopleIntakeDashboard } from './people-intake-dashboard';

export const metadata: Metadata = {
  title: 'People Intake Verification',
  description: 'Internal NEWAX workspace for controlled people and family intake verification.',
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default function PeopleIntakePage() {
  return <PeopleIntakeDashboard />;
}
