import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DocumentMissingProps {
  documentId?: string;
  sectionId?: string;
  title?: string;
  supportingCopy?: string;
  className?: string;
}

const defaultTitle = 'Fixture data unavailable';
const defaultSupportingCopy =
  'We could not locate deterministic fixtures for the requested document. Return to the dashboard and re-launch the deep link once fixtures are refreshed.';

export function DocumentMissing({
  documentId,
  sectionId,
  title = defaultTitle,
  supportingCopy = defaultSupportingCopy,
  className,
}: DocumentMissingProps) {
  return (
    <Card
      className={cn('mx-auto mt-16 w-full max-w-xl', className)}
      data-testid="fixture-missing-view"
    >
      <CardHeader>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p
          className="mt-1 text-sm text-gray-600 dark:text-gray-300"
          data-testid="fixture-missing-supporting-copy"
        >
          {supportingCopy}
        </p>
      </CardHeader>

      <CardContent className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
        {(documentId || sectionId) && (
          <dl className="space-y-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {documentId && (
              <div className="flex items-center justify-between">
                <dt>Document</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-200">{documentId}</dd>
              </div>
            )}
            {sectionId && (
              <div className="flex items-center justify-between">
                <dt>Section</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-200">{sectionId}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard" aria-label="Back to dashboard">
              Back to dashboard
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DocumentMissing;
