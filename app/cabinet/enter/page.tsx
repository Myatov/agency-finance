export default function CabinetEnterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">
          Личный кабинет клиента
        </h1>
        <p className="text-slate-600">
          Для входа используйте ссылку, которую вам отправил ваш менеджер.
          В ссылке содержится уникальный код доступа.
        </p>
      </div>
    </div>
  );
}
