import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function ShelfPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: shelf, error: shelfError } = await supabase
    .from("shelves")
    .select("id, code, photo_url")
    .eq("code", code)
    .single();

  const { data: books, error: booksError } = await supabase
    .from("book_catalog")
    .select("id, title, author, position, binding, shelf_code")
    .eq("shelf_code", code)
    .order("title");

  const imageUrl = shelf?.photo_url
    ? supabase.storage
        .from("shelf-photos")
        .getPublicUrl(shelf.photo_url).data.publicUrl
    : null;

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <a href="/" className="text-sm underline">
          ← Назад
        </a>

        <h1 className="mt-6 text-4xl font-bold">
          Полка {code}
        </h1>

        {shelfError && (
          <p className="mt-4 text-red-600">
            Ошибка загрузки полки: {shelfError.message}
          </p>
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={"Полка " + code}
            className="mt-8 w-full h-auto max-w-2xl rounded-2xl object-contain"
          />
        )}

        <h2 className="mt-10 text-2xl font-semibold">
          Книги на этой полке
        </h2>

        {booksError && (
          <p className="mt-4 text-red-600">
            Ошибка загрузки книг: {booksError.message}
          </p>
        )}

        <div className="mt-5 space-y-3">
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

              <div className="mt-1 text-sm font-medium">
                Место: {book.position || "не указано"}
              </div>
            </div>
          ))}

          {books?.length === 0 && !booksError && (
            <p className="text-gray-500">
              На этой полке пока нет книг.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}