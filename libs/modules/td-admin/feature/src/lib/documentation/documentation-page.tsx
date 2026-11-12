'use client';

import { Download, ExternalLink, FileText } from 'lucide-react';

import { Button, Card } from '@myorg/shared/ui';

interface DocItem {
  title: string;
  description: string;
  file: string;
  downloadName?: string;
}

interface DocSection {
  title: string;
  items: DocItem[];
}

/**
 * Documentation page.
 *
 * Mirrors the old td-manage header/menu documentation entries
 * (`src/lib/components/CustomMenus/Header.tsx` and `MenuLeft.tsx`), which
 * linked directly to the PDF/Markdown files shipped in `public/`.
 * The files are copied from the old project; nothing is generated here.
 */
const SECTIONS: DocSection[] = [
  {
    title: 'API Documentation',
    items: [
      {
        title: 'Management System API',
        description: 'OpenAPI documentation for the Tokenized Deposit management system (v1.9.0).',
        file: '/Tokenized Deposit OpenAPI Documentation for Management System v1.9.0.pdf',
      },
      {
        title: 'Service Provider API',
        description: 'OpenAPI documentation for service providers (v2.2.0).',
        file: '/Tokenized Deposit OpenAPI Documentation for Service Provider v2.2.0.pdf',
      },
      {
        title: 'Service Provider API (Markdown)',
        description: 'Markdown edition of the service provider OpenAPI documentation (v2.2.0).',
        file: '/Tokenized_Deposit_OpenAPI_Documentation_for_Service_Provider_v2.2.0.md',
        downloadName: 'Tokenized_Deposit_OpenAPI_Documentation_for_Service_Provider_v2.2.0.md',
      },
    ],
  },
  {
    title: 'User Manual',
    items: [
      {
        title: 'User Manual',
        description: 'UDPN Tokenized Deposit Stablecoin system user manual (v2.3.0).',
        file: '/UDPN_Tokenized_Deposit_Stablecoin_System_User_Manual_v2.3.0.pdf',
      },
    ],
  },
];

function openDocument(item: DocItem): void {
  window.open(encodeURI(item.file), '_blank', 'noopener,noreferrer');
}

function downloadDocument(item: DocItem): void {
  const link = document.createElement('a');
  link.href = encodeURI(item.file);
  link.download = item.downloadName ?? item.file.split('/').pop() ?? 'document';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function DocumentationPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Product manuals and API references for the Tokenized Deposit platform.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item) => (
              <Card key={item.title} className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => openDocument(item)}>
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => downloadDocument(item)}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    Download
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
