import Layout from '@/components/Layout';
import Link from 'next/link';

export default function StoragePage() {
  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Хранилище</h1>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            <li>
              <Link
                href="/contracts"
                className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
              >
                Договора
              </Link>
            </li>
            <li>
              <Link
                href="/invoices"
                className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
              >
                Счета
              </Link>
            </li>
            <li>
              <Link
                href="/closeout"
                className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
              >
                Закрывающие документы
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
