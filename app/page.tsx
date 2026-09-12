import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || "").trim();

  const { data: shelves, error: shelvesError } = await supabase
    .from("shelves")
    .select("id, code")
    .order("code");

  let books = null;
  let booksError = null;

  if (query) {
    const result = await supabase
      .from("book_catalog")
      .select(
        "id, title, author, shelf_code, position, binding"
      )
      .or(
        "title.ilike.%" +
          query +
          "%,author.ilike.%" +
          query +
          "%"
      )
      .not("shelf_code", "is", null)
      .order("title");

    books = result.data;
    booksError = result.error;
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              📚 Bookshelf
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Найди книгу на полке
            </p>
          </div>

          <a
            href="/import"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Добавить книги
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-4xl font-bold">
          Поиск книг
        </h2>

        <p className="mt-3 text-gray-600">
          Введите название книги или автора.
        </p>

        <form className="mt-8 flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Название книги или автор..."
            className="w-full max-w-xl rounded-xl border border-gray-300 px-4 py-3"
          />

          <button
            type="submit"
            className="rounded-xl bg-black px-6 py-3 text-white"
          >
            Найти
          </button>
        </form>

        {query && (
          <div className="mt-10">
            <h3 className="text-xl font-semibold">
              Результаты поиска
            </h3>

            {booksError && (
              <p className="mt-4 text-red-600">
                Ошибка поиска: {booksError.message}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {books?.map((book) => (
                <div
                  key={book.id}
                  className="rounded-xl border p-4"
                >
                  <div className="font-semibold">
                    {book.title}
                  </div>

                  {book.author && (
                    <div className="mt-1 text-sm text-gray-500">
                      {book.author}
                    </div>
                  )}

                  {book.binding && (
                    <div className="mt-1 text-sm text-gray-500">
                      Переплёт: {book.binding}
                    </div>
                  )}

                  <a
                    href={"/shelf/" + book.shelf_code}
                    className="mt-2 inline-block text-sm font-medium underline"
                  >
                    Полка {book.shelf_code}
                  </a>

                  <div className="mt-2 text-sm font-semibold">
                    Место: {book.position || "не указано"}
                  </div>
                </div>
              ))}

              {books?.length === 0 && !booksError && (
                <p className="text-gray-500">
                  Ничего не найдено.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-12">
          <h3 className="text-xl font-semibold">
            Полки
          </h3>

          {shelvesError && (
            <p className="mt-4 text-red-600">
              Ошибка загрузки полок: {shelvesError.message}
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelves?.map((shelf) => (
              <div
                key={shelf.id}
                className="rounded-xl border p-5"
              >
                <div className="text-2xl">
                  📖
                </div>

                <div className="mt-3 font-semibold">
                  Полка {shelf.code}
                </div>

                <a
                  href={"/shelf/" + shelf.code}
                  className="mt-3 inline-block text-sm underline"
                >
                  Посмотреть книги
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}