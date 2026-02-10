import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Finance Agency CRM — CRM и финансы для SEO-агентств',
  description:
    'Клиенты, счета, оплаты, закрывающие документы и личные кабинеты с входом по QR. Один сервис вместо табличек и чатов.',
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
