import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "Нет настроек Supabase" },
      { status: 500 }
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseKey
  );

  const { data, error, count } = await supabase
    .from("book_catalog")
    .select("id, title, binding", {
      count: "exact",
    })
    .limit(10);

  if (error) {
    return Response.json(
      {
        error: "Не удалось прочитать book_catalog",
        details: error,
      },
      { status: 500 }
    );
  }

  return Response.json({
    totalBooks: count,
    sample: data,
  });
}