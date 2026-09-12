import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  const password = String(formData.get("password") || "");
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.redirect(
      new URL("/login?error=Настройка пароля не найдена", request.url),
      303
    );
  }

  if (password !== sitePassword) {
    return NextResponse.redirect(
      new URL("/login?error=Неверный пароль", request.url),
      303
    );
  }

  const response = NextResponse.redirect(
    new URL("/", request.url),
    303
  );

  response.cookies.set("bookshelf_access", "granted", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}