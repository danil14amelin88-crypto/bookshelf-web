import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeTrigrams(text: string) {
  const value = normalize(text);

  const result = new Set<string>();

  if (value.length < 3) {
    if (value) {
      result.add(value);
    }

    return result;
  }

  for (let i = 0; i <= value.length - 3; i++) {
    result.add(value.slice(i, i + 3));
  }

  return result;
}

function similarity(a: string, b: string) {
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  if (!aNorm || !bNorm) {
    return 0;
  }

  const aWords = new Set(
    aNorm.split(" ").filter((word) => word.length > 1)
  );

  const bWords = new Set(
    bNorm.split(" ").filter((word) => word.length > 1)
  );

  let commonWords = 0;

  for (const word of aWords) {
    if (bWords.has(word)) {
      commonWords++;
    }
  }

  const wordScore =
    commonWords /
    Math.max(aWords.size, bWords.size, 1);

  const aTrigrams = makeTrigrams(aNorm);
  const bTrigrams = makeTrigrams(bNorm);

  let commonTrigrams = 0;

  for (const trigram of aTrigrams) {
    if (bTrigrams.has(trigram)) {
      commonTrigrams++;
    }
  }

  const trigramScore =
    commonTrigrams /
    Math.max(
      aTrigrams.size,
      bTrigrams.size,
      1
    );

  let startBonus = 0;

  const firstA = aNorm.split(" ")[0];
  const firstB = bNorm.split(" ")[0];

  if (
    firstA &&
    firstB &&
    (
      firstA === firstB ||
      firstA.startsWith(firstB) ||
      firstB.startsWith(firstA)
    )
  ) {
    startBonus = 0.15;
  }

  return (
    wordScore * 0.45 +
    trigramScore * 0.55 +
    startBonus
  );
}

function extractOutputText(data: any) {
  let text = "";

  for (const item of data.output || []) {
    for (const itemContent of item.content || []) {
      if (itemContent.type === "output_text") {
        text += itemContent.text;
      }
    }
  }

  return text.trim();
}

function parseList(text: string) {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*\d+[\.\)\-:]\s*/, "")
        .trim()
    )
    .filter(Boolean)
    .filter(
      (line) =>
        !line.toLowerCase().startsWith("итого") &&
        !line.toLowerCase().startsWith("всего")
    );
}

function getZone(index: number, total: number) {
  const position = index / total;

  if (position < 1 / 3) {
    return "left";
  }

  if (position < 2 / 3) {
    return "center";
  }

  return "right";
}

async function runOpenAI(
  apiKey: string,
  content: any[]
) {
  const startResponse = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        background: true,
        input: [
          {
            role: "user",
            content: content,
          },
        ],
      }),
    }
  );

  const startData = await startResponse.json();

  if (!startResponse.ok) {
    throw new Error(
      "OpenAI start error: " +
        JSON.stringify(startData)
    );
  }

  const responseId = startData.id;

  if (!responseId) {
    throw new Error(
      "OpenAI не вернул response ID"
    );
  }

  let finalData = startData;

  for (let attempt = 0; attempt < 100; attempt++) {
    if (finalData.status === "completed") {
      return finalData;
    }

    if (
      finalData.status === "failed" ||
      finalData.status === "cancelled" ||
      finalData.status === "incomplete"
    ) {
      throw new Error(
        "OpenAI status: " +
          finalData.status
      );
    }

    await sleep(3000);

    const checkResponse = await fetch(
      "https://api.openai.com/v1/responses/" +
        responseId,
      {
        headers: {
          Authorization: "Bearer " + apiKey,
        },
      }
    );

    finalData = await checkResponse.json();

    if (!checkResponse.ok) {
      throw new Error(
        "OpenAI check error: " +
          JSON.stringify(finalData)
      );
    }
  }

  throw new Error(
    "OpenAI слишком долго выполняет анализ"
  );
}

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY не найден" },
      { status: 500 }
    );
  }

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

  try {
    const { data: shelf, error: shelfError } =
      await supabase
        .from("shelves")
        .select("id, code")
        .eq("code", "A1")
        .single();

    if (shelfError || !shelf) {
      return Response.json(
        {
          error: "Полка A1 не найдена",
          details: shelfError,
        },
        { status: 500 }
      );
    }

    const {
      data: photos,
      error: photosError,
    } = await supabase
      .from("shelf_photos")
      .select("id, photo_url")
      .eq("shelf_id", shelf.id)
      .order("id");

    if (
      photosError ||
      !photos ||
      photos.length === 0
    ) {
      return Response.json(
        {
          error:
            "Не удалось получить фотографии A1",
          details: photosError,
        },
        { status: 500 }
      );
    }

    const imageParts: any[] = [];

    for (const photo of photos) {
      const publicUrl = supabase.storage
        .from("shelf-photos")
        .getPublicUrl(photo.photo_url)
        .data.publicUrl;

      const imageResponse =
        await fetch(publicUrl);

      if (!imageResponse.ok) {
        return Response.json(
          {
            error:
              "Не удалось скачать фотографию",
            photo: photo.photo_url,
            status: imageResponse.status,
          },
          { status: 500 }
        );
      }

      const arrayBuffer =
        await imageResponse.arrayBuffer();

      const base64 =
        Buffer.from(arrayBuffer).toString(
          "base64"
        );

      const contentType =
        imageResponse.headers.get(
          "content-type"
        ) || "image/jpeg";

      imageParts.push({
        type: "input_image",
        image_url:
          "data:" +
          contentType +
          ";base64," +
          base64,
        detail: "high",
      });
    }

    const firstContent: any[] = [
      {
        type: "input_text",
        text:
          "Это фотографии частей одной книжной полки. " +
          "Фотографии могут немного пересекаться. " +
          "Твоя задача сейчас НЕ определять официальные названия книг и НЕ угадывать их. " +
          "Иди слева направо по каждому физическому корешку. " +
          "Для каждого корешка перепиши максимально точно именно тот текст, который реально виден на фотографии. " +
          "Если видно только часть названия, запиши именно эту часть. " +
          "Не дополняй текст по памяти. " +
          "Авторы не нужны. " +
          "Один физический корешок должен быть одной строкой. " +
          "Если одна книга видна на двух соседних фотографиях из-за пересечения, считай ее только один раз. " +
          "Если корешок совершенно без текста, напиши: корешок без надписи. " +
          "Если текст есть, но совершенно невозможно разобрать, напиши: неразборчиво. " +
          "Выдай только пронумерованный список слева направо.",
      },
      ...imageParts,
    ];

    const firstData = await runOpenAI(
      apiKey,
      firstContent
    );

    const firstText =
      extractOutputText(firstData);

    const rawSpines =
      parseList(firstText);

    const catalog: any[] = [];
    const pageSize = 1000;

    for (
      let from = 0;
      from < 20000;
      from += pageSize
    ) {
      const to =
        from + pageSize - 1;

      const {
        data: catalogPage,
        error: catalogError,
      } = await supabase
        .from("book_catalog")
        .select("id, title, binding")
        .range(from, to);

      if (catalogError) {
        return Response.json(
          {
            error:
              "Не удалось прочитать каталог",
            details: catalogError,
          },
          { status: 500 }
        );
      }

      if (
        !catalogPage ||
        catalogPage.length === 0
      ) {
        break;
      }

      catalog.push(...catalogPage);

      if (
        catalogPage.length < pageSize
      ) {
        break;
      }
    }

    const candidateBlocks =
      rawSpines.map(
        (spine, index) => {
          if (
            spine.toLowerCase() ===
              "неразборчиво" ||
            spine
              .toLowerCase()
              .includes(
                "корешок без надписи"
              )
          ) {
            return (
              String(index + 1) +
              ". Видимый текст: " +
              spine +
              "\nКаталог: кандидатов нет."
            );
          }

          const matches = catalog
            .map((book) => ({
              title: book.title,
              binding: book.binding,
              score: similarity(
                spine,
                book.title
              ),
            }))
            .sort(
              (a, b) =>
                b.score - a.score
            )
            .slice(0, 8);

          const candidateText =
            matches
              .map(
                (match, matchIndex) =>
                  "   " +
                  String(
                    matchIndex + 1
                  ) +
                  ") " +
                  match.title +
                  (
                    match.binding
                      ? " [" +
                        match.binding +
                        "]"
                      : ""
                  )
              )
              .join("\n");

          return (
            String(index + 1) +
            ". Видимый текст: " +
            spine +
            "\nВозможные книги из каталога:\n" +
            candidateText
          );
        }
      )
      .join("\n\n");

    const secondContent: any[] = [
      {
        type: "input_text",
        text:
          "Это повторная проверка той же книжной полки. " +
          "Ниже я дам текст, предварительно прочитанный с каждого корешка, и несколько возможных названий из реального каталога магазина. " +
          "Снова внимательно посмотри на фотографии. " +
          "Главная цель — получить максимально точное название каждой физической книги. " +
          "Каталог является только подсказкой, а не обязательным списком. " +
          "Если один из вариантов каталога действительно соответствует тексту на корешке, используй ТОЧНОЕ название из каталога. " +
          "Если варианты каталога не соответствуют фотографии, НЕ выбирай их только потому, что они есть в списке. " +
          "В таком случае сам прочитай название по фотографии. " +
          "Книги, которых нет в каталоге, обязательно тоже должны остаться в результате. " +
          "Не придумывай книги. " +
          "Не разделяй одно длинное название одной книги на две книги. " +
          "Не объединяй две соседние книги в одну. " +
          "Фотографии могут пересекаться — одинаковую книгу на стыке считай только один раз. " +
          "Авторы не нужны. " +
          "Выдай только один пронумерованный список точных названий книг слева направо. " +
          "Если физический корешок реально без надписи, напиши: корешок без надписи.\n\n" +
          candidateBlocks,
      },
      ...imageParts,
    ];

    const secondData = await runOpenAI(
      apiKey,
      secondContent
    );

    const finalText =
      extractOutputText(secondData);

    const finalBooks =
      parseList(finalText);

    if (finalBooks.length === 0) {
      return Response.json(
        {
          error:
            "Не удалось получить итоговый список книг",
        },
        { status: 500 }
      );
    }

    // Удаляем только старые книги A1
    const { error: deleteError } =
      await supabase
        .from("books")
        .delete()
        .eq("shelf_id", shelf.id);

    if (deleteError) {
      return Response.json(
        {
          error:
            "Не удалось удалить старые книги A1",
          details: deleteError,
        },
        { status: 500 }
      );
    }

    // Формируем новые записи
    const rows = finalBooks.map(
      (title, index) => ({
        shelf_id: shelf.id,
        shelf_code: shelf.code,
        title: title,
        zone: getZone(
          index,
          finalBooks.length
        ),
      })
    );

    const { error: insertError } =
      await supabase
        .from("books")
        .insert(rows);

    if (insertError) {
      return Response.json(
        {
          error:
            "Не удалось записать книги A1",
          details: insertError,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      shelf: shelf.code,
      booksSaved: finalBooks.length,
      books: finalBooks,
    });
  } catch (error: any) {
    console.error(
      "ANALYZE SHELF ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Ошибка анализа полки",
        details:
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}