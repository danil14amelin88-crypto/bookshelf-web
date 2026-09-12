export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-3xl px-6 py-12">
        <a href="/" className="text-sm underline">
          ← На главную
        </a>

        <h1 className="mt-6 text-4xl font-bold">
          Добавить книги на полку
        </h1>

        <p className="mt-3 text-gray-600">
          Укажите код полки и вставьте подготовленный список книг.
        </p>

        {params.success && (
          <p className="mt-6 rounded-xl border p-4 font-medium">
            Готово. Добавлено книг: {params.success}
          </p>
        )}

        {params.error && (
          <p className="mt-6 rounded-xl border p-4 text-red-600">
            Ошибка: {params.error}
          </p>
        )}

        <form
          action="/api/import-books"
          method="POST"
          className="mt-8"
        >
          <div>
            <label className="font-semibold">
              Код полки
            </label>

            <input
              name="shelfCode"
              placeholder="Например: A2"
              required
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            />
          </div>

          <div className="mt-6">
            <label className="font-semibold">
              Список книг
            </label>

            <textarea
              name="text"
              placeholder="Вставьте сюда список книг из ChatGPT..."
              rows={16}
              required
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            />
          </div>

          <button
            type="submit"
            className="mt-6 rounded-xl bg-black px-6 py-3 font-medium text-white"
          >
            Импортировать книги
          </button>
        </form>
      </section>
    </main>
  );
}