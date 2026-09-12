import { createClient } from "@supabase/supabase-js";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string) {
  const aWords = new Set(normalize(a).split(" "));
  const bWords = new Set(normalize(b).split(" "));

  if (aWords.size === 0 || bWords.size === 0) {
    return 0;
  }

  let common = 0;

  for (const word of aWords) {
    if (bWords.has(word)) {
      common++;
    }
  }

  return common / Math.max(aWords.size, bWords.size);
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "Нет настроек Supabase" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const query = "Искусство беседы и межличностного общения";

  const { data, error } = await supabase
    .from("book_catalog")
    .select("id, title, binding")
    .limit(20000);

  if (error || !data) {
    return Response.json(
      {
        error: "Не удалось прочитать каталог",
        details: error,
      },
      { status: 500 }
    );
  }

  const matches = data
    .map((book) => ({
      ...book,
      score: similarity(query, book.title),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return Response.json({
    query,
    matches,
  });
}