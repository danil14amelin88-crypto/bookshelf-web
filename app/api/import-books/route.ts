import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

type ImportBook = {
  title: string;
  author: string | null;
  binding: string | null;
  position: string | null;
};

function parseBooks(input: string): ImportBook[] {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const books: ImportBook[] = [];

  for (let line of lines) {
    line = line.replace(/^\d+\.\s*/, "");

    const parts = line.split(";").map((part) => part.trim());
    const firstPart = parts[0] || "";

    let title = firstPart;
    let author: string | null = null;

    if (firstPart.includes(" — ")) {
      const split = firstPart.split(" — ");
      title = split[0].replace(/[«»]/g, "").trim();
      author = split.slice(1).join(" — ").trim();
    } else {
      title = firstPart.replace(/[«»]/g, "").trim();
    }

    let position: string | null = null;
    let binding: string | null = null;

    for (const part of parts.slice(1)) {
      const lower = part.toLowerCase();

      if (lower.startsWith("положение:")) {
        position = part.split(":").slice(1).join(":").trim();
      }

      if (
        lower.startsWith("переплёт:") ||
        lower.startsWith("переплет:")
      ) {
        binding = part.split(":").slice(1).join(":").trim();
      }
    }

    if (title) {
      books.push({
        title,
        author,
        binding,
        position,
      });
    }
  }

  return books;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const shelfCode = String(
      formData.get("shelfCode") || ""
    ).trim();

    const text = String(
      formData.get("text") || ""
    ).trim();

    if (!shelfCode) {
      return NextResponse.redirect(
        new URL("/import?error=Не указан код полки", request.url)
      );
    }

    if (!text) {
      return NextResponse.redirect(
        new URL("/import?error=Список книг пуст", request.url)
      );
    }

    const books = parseBooks(text);

    if (books.length === 0) {
      return NextResponse.redirect(
        new URL("/import?error=Не удалось распознать книги", request.url)
      );
    }

    const { data: existingShelf, error: shelfLookupError } =
      await supabase
        .from("shelves")
        .select("id, code")
        .eq("code", shelfCode)
        .maybeSingle();

    if (shelfLookupError) {
      return NextResponse.redirect(
        new URL(
          "/import?error=" +
            encodeURIComponent(shelfLookupError.message),
          request.url
        )
      );
    }

    if (!existingShelf) {
      const { error: shelfInsertError } = await supabase
        .from("shelves")
        .insert({
          code: shelfCode,
          photo_url: null,
        });

      if (shelfInsertError) {
        return NextResponse.redirect(
          new URL(
            "/import?error=" +
              encodeURIComponent(shelfInsertError.message),
            request.url
          )
        );
      }
    }

    const rows = books.map((book) => ({
      title: book.title,
      author: book.author,
      binding: book.binding,
      position: book.position,
      shelf_code: shelfCode,
    }));

    const { error } = await supabase
      .from("book_catalog")
      .insert(rows);

    if (error) {
      return NextResponse.redirect(
        new URL(
          "/import?error=" + encodeURIComponent(error.message),
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        "/import?success=" + rows.length,
        request.url
      )
    );
  } catch {
    return NextResponse.redirect(
      new URL("/import?error=Ошибка импорта", request.url)
    );
  }
}