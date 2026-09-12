export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-md px-6 py-20">
        <h1 className="text-3xl font-bold">
          Вход
        </h1>

        <p className="mt-3 text-gray-600">
          Введите общий пароль для доступа к библиотеке.
        </p>

        <form
          action="/api/login"
          method="POST"
          className="mt-8"
        >
          <input
            type="password"
            name="password"
            placeholder="Пароль"
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
          />

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-black px-6 py-3 font-medium text-white"
          >
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}