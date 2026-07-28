'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

const PROVIDERS = [
  { img: '/stablecoin/images/screen1.png', name: 'Chainalysis', href: 'https://www.chainalysis.com/', features: ['screening_providers_0003','screening_providers_0004','screening_providers_0005','screening_providers_0006','screening_providers_0007'], tag: 'KYA / KYT' },
  { img: '/stablecoin/images/screen2.svg', name: 'Elliptic', href: 'https://www.elliptic.co/', features: ['screening_providers_0008','screening_providers_0009','screening_providers_0010','screening_providers_0011'], tag: 'KYA / KYT' },
  { img: '/stablecoin/images/screen3.svg', name: 'MistTrack', href: 'https://misttrack.io/', features: ['screening_providers_0012','screening_providers_0013','screening_providers_0014','screening_providers_0015'], tag: 'KYA / KYT' },
  { img: '/stablecoin/images/screen4.svg', name: 'LexisNexis Risk Solutions', href: 'https://risk.lexisnexis.com/', features: ['screening_providers_0017','screening_providers_0018','screening_providers_0019','screening_providers_0020','screening_providers_0021'], tag: 'AML / CFT' },
  { img: '/stablecoin/images/screen5.svg', name: 'Oracle', href: 'https://www.oracle.com/financial-services/aml-financial-crime-compliance/', features: ['screening_providers_0022','screening_providers_0023','screening_providers_0024','screening_providers_0025'], tag: 'AML / CFT' },
  { img: '/stablecoin/images/screen6.svg', name: 'SAS', href: 'https://www.sas.com/en_us/solutions/fraud-security-intelligence/solutions/aml-cft-compliance.html', features: ['screening_providers_0026','screening_providers_0027','screening_providers_0028','screening_providers_0029','screening_providers_0030'], tag: 'AML / CFT' },
];

export function ScreeningProvidersPage() {
  const t = useTranslations('modules.screening-providers');
  return (
    <div className="bg-gray-50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('screening_providers_0016')}</h1>
          <p className="text-gray-600 text-lg leading-relaxed max-w-4xl mx-auto">{t('screening_providers_0002')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {PROVIDERS.map((p) => (
            <div key={p.name} className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-6">
                <Image src={p.img} alt={p.name} width={300} height={120} className="mr-3 object-contain" />
              </div>
              <div className="space-y-4 mb-8 min-h-[10rem]">
                {p.features.map((fk) => (<div key={fk} className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-3" /><span className="text-gray-700">{t(fk)}</span></div>))}
              </div>
              <a href={p.href} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center mb-4">
                {t('screening_providers_0001')}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-2"><path d="M14 3h7v7h-2V6.414l-9.293 9.293-1.414-1.414L17.586 5H14V3z" /><path d="M5 5h6v2H7v10h10v-4h2v6H5V5z" /></svg>
              </a>
              <div className="text-sm text-gray-500 font-medium">{p.tag}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
