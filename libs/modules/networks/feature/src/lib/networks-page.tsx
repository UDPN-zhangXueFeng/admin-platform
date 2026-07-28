'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

const CARDS = [
  { image: '/stablecoin/images/net_2.svg', alt: 'udpn-kissen-network', descKey: 'networks_0004' },
  { image: '/stablecoin/images/net_1.svg', alt: 'cbmt', descKey: 'networks_0003' },
  { image: '/stablecoin/images/net_4.svg', alt: 'hong-kong-stablecoin-hub', descKey: 'networks_0006' },
  { image: '/stablecoin/images/net_3.svg', alt: 'partior', descKey: 'networks_0005', bg: 'bg-gray-300' },
];

export function NetworksPage() {
  const t = useTranslations('modules.networks');
  return (
    <div className="w-full min-h-full rounded-3xl bg-[#f3f4f6] px-4 py-8 md:px-8 md:py-10 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-[1440px]">
        <h1 className="text-center text-2xl font-semibold text-[#0f172a] md:text-4xl">{t('networks_0000')}</h1>
        <div className="mx-auto mt-8 max-w-[1280px] leading-8 text-[#27364a] md:mt-12 md:text-lg md:leading-10">
          <p>{t('networks_0001')}</p><p className="mt-2">{t('networks_0002')}</p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-8 xl:grid-cols-2">
          {CARDS.map((c) => (
            <div key={c.alt} className={`rounded-3xl px-8 py-10 shadow-[0_2px_10px_rgba(15,23,42,0.12)] ${c.bg || 'bg-[#ececf5]'}`}>
              <div className="flex h-20 items-center"><Image src={c.image} alt={c.alt} width={200} height={80} style={{ maxHeight: '100%', width: 'auto', objectFit: 'contain' }} /></div>
              <p className="mt-8 leading-8 text-[#1f2937] md:text-lg md:leading-10">{t(c.descKey)}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex justify-center">
          <div className="rounded-lg border-2 px-8 py-4">
            <p className="text-center text-base text-[#1f2937]">Send us an email at <a href="mailto:contact@udpn.io" className="text-[#3b82f6] hover:underline">contact@udpn.io</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
