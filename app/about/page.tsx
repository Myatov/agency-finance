'use client';

import Link from 'next/link';

export default function AboutLandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0f172a]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center h-16">
          <span className="text-xl font-bold tracking-tight">Finance Agency CRM</span>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-emerald-500 text-[#0f172a] font-semibold hover:bg-emerald-400 transition"
          >
            Войти
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-emerald-400 font-medium uppercase tracking-widest text-sm mb-4">
            CRM и финансы для SEO и digital-агентств
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Один сервис вместо{' '}
            <span className="text-emerald-400">табличек, чатов и забытых счетов</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Клиенты, счета, оплаты, закрывающие документы и личные кабинеты с входом по QR — без Excel и переписок.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-emerald-500 text-[#0f172a] font-bold text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/25"
            >
              Попробовать бесплатно
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-slate-500 text-slate-200 font-semibold hover:bg-white/5 transition"
            >
              Тарифы и цены
            </a>
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="py-20 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Знакомо?
          </h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-16">
            Владельцы и руководители SEO-агентств тратят часы на то, что можно автоматизировать.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Счета теряются в почте и чатах',
                desc: 'Клиент не видит историю, бухгалтерия спрашивает «где акт?», вы ищете по переписке.',
              },
              {
                title: 'Не понятно, кто сколько принёс и кому должны',
                desc: 'Доходы и расходы размазаны по таблицам и памяти — нет единой картины по периодам.',
              },
              {
                title: 'Ручная выдача доступов клиентам',
                desc: 'Отправляете логины-пароли вручную, клиент не видит свои счета и отчёты в одном месте.',
              },
              {
                title: 'Закрывающие документы в хаосе',
                desc: 'Акты и отчёты по разным папкам и мессенджерам — сложно отчитаться и передать клиенту.',
              },
              {
                title: 'Роли и доступы «на словах»',
                desc: 'Кто видит финансы, кто только своих клиентов — не зафиксировано в системе.',
              },
              {
                title: 'Оплата по счёту — лишние шаги',
                desc: 'Клиент просит реквизиты снова, бухгалтерия ждёт. Нет QR и единой ссылки на счёт.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/50"
              >
                <h3 className="font-semibold text-lg text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value prop */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Finance Agency CRM закрывает эти боли
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-12">
            Одна система для учёта клиентов, договоров, счетов, оплат, закрывающих документов и отчётов. Плюс личный кабинет клиента с входом по ссылке или QR.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Всё связано: сайт → услуги → периоды → счета → оплаты → отчёты
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Что внутри
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Клиенты и реквизиты', desc: 'Карточки клиентов, юрлица, контакты, привязка к менеджерам и продавцам.', icon: '👤' },
              { title: 'Договоры и документы', desc: 'Хранение договоров, разделы, загрузка файлов. Всё в одном месте.', icon: '📄' },
              { title: 'Сайты и услуги', desc: 'Сайты по клиентам, услуги по сайтам, периоды работ — основа для счетов и отчётов.', icon: '🌐' },
              { title: 'Счета и PDF с QR', desc: 'Формирование счетов, PDF с реквизитами и QR для оплаты в банке. Публичная ссылка на счёт.', icon: '🧾' },
              { title: 'Оплаты и контроль', desc: 'Учёт оплат по счетам, дашборд по ожидаемым и поступившим платежам.', icon: '💰' },
              { title: 'Доходы и расходы', desc: 'Учёт доходов по проектам, расходы по статьям и категориям. Роли и права доступа.', icon: '📊' },
              { title: 'Закрывающие документы', desc: 'Акты, отчёты — пакеты по периодам, загрузка и выдача клиенту из кабинета.', icon: '📁' },
              { title: 'Личный кабинет клиента', desc: 'Отдельный вход по ссылке или QR. Клиент видит свои сайты, услуги, счета, документы и отчёты.', icon: '🔐' },
              { title: 'QR для входа и оплаты', desc: 'QR-код для входа в кабинет — отправили один раз, клиент заходит с телефона. QR на счёт — оплата в два тапа.', icon: '📱' },
              { title: 'Роли и права', desc: 'Владелец, CEO, финансист, аккаунт-менеджер — кто что видит и может делать.', icon: '🛡️' },
              { title: 'Отчёты и экспорт', desc: 'Агрегации по доходам, расходам, сотрудникам. Экспорт в CSV.', icon: '📈' },
              { title: 'Уведомления в Telegram', desc: 'Опционально: уведомления по расходам в вашу группу или канал.', icon: '✈️' },
            ].map((item, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/50 hover:border-emerald-500/50 transition"
              >
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot mockup */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Всё под рукой в одном интерфейсе
          </h2>
          <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-800">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-700">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-4 text-slate-500 text-sm">Финансы агентства — Сайты · Услуги · Счета · Оплаты</span>
            </div>
            <div className="grid grid-cols-12 gap-0 min-h-[320px]">
              <div className="col-span-3 bg-slate-900/80 p-4 border-r border-slate-700">
                <div className="space-y-2">
                  {['Сайты', 'Услуги', 'Клиенты', 'Договора', 'Счета', 'Оплаты', 'Доходы', 'Расходы', 'Отчёты'].map((label, i) => (
                    <div key={i} className="text-slate-400 text-sm py-1">{label}</div>
                  ))}
                </div>
              </div>
              <div className="col-span-9 p-6">
                <div className="bg-slate-800 rounded-xl border border-slate-600 p-4 mb-4">
                  <div className="h-4 w-1/3 bg-slate-600 rounded mb-3" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-slate-700 last:border-0">
                        <div className="h-4 w-32 bg-slate-600 rounded" />
                        <div className="h-4 w-20 bg-emerald-600/60 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Дашборд оплат, счета по периодам, личные кабинеты клиентов</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client cabinet + QR highlight */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-b from-emerald-500/10 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Личный кабинет клиента и вход по QR
          </h2>
          <p className="text-slate-400 mb-8">
            Выдайте клиенту одну ссылку или QR-код — он входит без пароля от вашей CRM. Видит только свои сайты, услуги, счета (с возможностью скачать PDF и оплатить по QR), закрывающие документы и отчёты.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 w-48 text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-lg bg-white flex items-center justify-center">
                <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h12a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="font-medium text-white">Вход по QR</div>
              <div className="text-slate-400 text-sm">Сканировал — вошёл</div>
            </div>
            <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 w-48 text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-lg bg-white flex items-center justify-center">
                <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="font-medium text-white">Счета с QR</div>
              <div className="text-slate-400 text-sm">Оплата в приложении банка</div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple chart block */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Меньше рутины — больше контроля
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-end justify-center gap-1 h-24 mb-4">
                <span className="w-8 bg-slate-600 rounded-t" style={{ height: '40%' }} />
                <span className="w-8 bg-slate-500 rounded-t" style={{ height: '65%' }} />
                <span className="w-8 bg-emerald-500 rounded-t" style={{ height: '100%' }} />
              </div>
              <div className="font-semibold text-white">Время на счета и документы</div>
              <div className="text-slate-400 text-sm">Сокращается в разы</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-end justify-center gap-1 h-24 mb-4">
                <span className="w-8 bg-slate-600 rounded-t" style={{ height: '70%' }} />
                <span className="w-8 bg-slate-500 rounded-t" style={{ height: '85%' }} />
                <span className="w-8 bg-emerald-500 rounded-t" style={{ height: '100%' }} />
              </div>
              <div className="font-semibold text-white">Прозрачность по деньгам</div>
              <div className="text-slate-400 text-sm">Доходы, расходы, оплаты в одном месте</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-end justify-center gap-1 h-24 mb-4">
                <span className="w-8 bg-emerald-500/80 rounded-t" style={{ height: '100%' }} />
                <span className="w-8 bg-emerald-500/60 rounded-t" style={{ height: '90%' }} />
                <span className="w-8 bg-emerald-500/40 rounded-t" style={{ height: '75%' }} />
              </div>
              <div className="font-semibold text-white">Доверие клиентов</div>
              <div className="text-slate-400 text-sm">Кабинет и QR — всё под рукой у клиента</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Тарифы
          </h2>
          <p className="text-slate-400 text-center max-w-xl mx-auto mb-16">
            Выберите вариант под размер команды и объём клиентов. Возможна настройка под ваш бренд и процессы.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Старт */}
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-1">Старт</h3>
              <p className="text-slate-400 text-sm mb-6">До 3 пользователей, до 30 клиентов</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">6 900</span>
                <span className="text-slate-400"> ₽/мес</span>
              </div>
              <ul className="space-y-3 text-slate-300 text-sm flex-1 mb-8">
                <li>Клиенты, сайты, услуги, счета</li>
                <li>Оплаты и отчёты</li>
                <li>Доходы и расходы</li>
                <li>Личные кабинеты клиентов + QR</li>
                <li>Помощь в настройке по email</li>
              </ul>
              <Link
                href="/login"
                className="block text-center py-3 px-4 rounded-xl border border-slate-600 text-white font-medium hover:bg-white/5 transition"
              >
                Начать
              </Link>
            </div>

            {/* Бизнес — рекомендуем */}
            <div className="rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-[#0f172a] text-xs font-bold">
                Популярный
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Бизнес</h3>
              <p className="text-slate-300 text-sm mb-6">До 10 пользователей, до 100 клиентов</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">12 900</span>
                <span className="text-slate-300"> ₽/мес</span>
              </div>
              <ul className="space-y-3 text-slate-200 text-sm flex-1 mb-8">
                <li>Всё из тарифа «Старт»</li>
                <li>Договоры и закрывающие документы</li>
                <li>Роли и права доступа</li>
                <li>Несколько юрлиц, ниши, контакты</li>
                <li>Приоритетная поддержка</li>
              </ul>
              <Link
                href="/login"
                className="block text-center py-3 px-4 rounded-xl bg-emerald-500 text-[#0f172a] font-bold hover:bg-emerald-400 transition"
              >
                Выбрать Бизнес
              </Link>
            </div>

            {/* Под ключ */}
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-1">Под ключ</h3>
              <p className="text-slate-400 text-sm mb-6">Без ограничений + брендинг и настройка</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">от 24 900</span>
                <span className="text-slate-400"> ₽/мес</span>
              </div>
              <ul className="space-y-3 text-slate-300 text-sm flex-1 mb-8">
                <li>Всё из «Бизнес»</li>
                <li>Ваш логотип и домен</li>
                <li>Настройка под ваши процессы</li>
                <li>Обучение команды</li>
                <li>Выделенная поддержка</li>
              </ul>
              <Link
                href="/login"
                className="block text-center py-3 px-4 rounded-xl border border-emerald-500 text-emerald-400 font-medium hover:bg-emerald-500/10 transition"
              >
                Обсудить
              </Link>
            </div>
          </div>
          <p className="text-center text-slate-500 text-sm mt-8">
            Все цены указаны с НДС по запросу. Первый месяц — тестовый период с полным функционалом.
          </p>
        </div>
      </section>

      {/* Ништяки */}
      <section className="py-16 px-4 sm:px-6 bg-slate-900/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            И ещё ништяки
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              'Вход в кабинет клиента по QR — без логинов',
              'PDF счёта с QR для оплаты в приложении банка',
              'Публичная ссылка на счёт — отправил и забыл',
              'Закрывающие документы пакетами по периодам',
              'Агенты и партнёры с комиссиями',
              'Ниши и продукты для аналитики',
              'Хранилище файлов по проектам',
              'Telegram-уведомления по расходам',
            ].map((text, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm"
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Перестаньте вести учёт в таблицах и чатах
          </h2>
          <p className="text-slate-400 mb-8">
            Подключите Finance Agency CRM и получите единую систему для клиентов, счетов, оплат и личных кабинетов с QR.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-10 py-4 rounded-xl bg-emerald-500 text-[#0f172a] font-bold text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/25"
          >
            Попробовать бесплатно
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-slate-500 text-sm">Finance Agency CRM · Финансы и CRM для SEO-агентств</span>
          <Link href="/login" className="text-slate-400 hover:text-white text-sm transition">
            Вход в систему
          </Link>
        </div>
      </footer>
    </div>
  );
}
