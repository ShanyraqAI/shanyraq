/** Real built-app catalog/editor acceptance; local fixture only, no business mocks. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.GUEST_STAY_TEST_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Loopback only");
const f = JSON.parse(
  await readFile(process.env.GUEST_STAY_FIXTURE_PATH, "utf8"),
);
const out = process.env.CATALOG_TEST_OUTPUT || "/data/catalog-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const owner = await browser.newContext({
    viewport: { width: 390, height: 844 },
  }),
  guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
const results = [],
  errors = [];
await owner.addCookies([
  {
    name: "shanyraq_session",
    value: f.sessionToken,
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  },
  {
    name: "shanyraq_active_hotel",
    value: f.hotelId,
    url: base,
    sameSite: "Lax",
  },
]);
const op = await owner.newPage(),
  gp = await guest.newPage();
for (const p of [op, gp]) p.on("pageerror", (e) => errors.push(e.name));
async function check(label, fn) {
  console.log(`RUN: ${label}`);
  await fn();
  results.push({ label, status: "PASS" });
  console.log(`PASS: ${label}`);
}
async function overflow(p, label) {
  const size = await p.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  assert(size.scroll <= size.width + 1, `${label}: horizontal overflow`);
}
const title = "Светлая квартира у парка";
const editorUrl = `${base}/dashboard/rooms/${f.roomId}/catalog`;
let listingId;
async function confirm() {
  await op.getByRole("checkbox", { name: /Проверено: эти тексты/ }).check();
}
try {
  await check(
    "owner editor is not an unauthenticated public page",
    async () => {
      await gp.goto(editorUrl);
      assert(new URL(gp.url()).pathname === "/login");
    },
  );
  await check(
    "phone editor accepts description, advantages and multiple photos without leaving page",
    async () => {
      await op.goto(editorUrl);
      await op
        .getByRole("button", { name: "Не сейчас", exact: true })
        .waitFor({ timeout: 2000 })
        .then(() =>
          op.getByRole("button", { name: "Не сейчас", exact: true }).click(),
        )
        .catch(() => undefined);
      await op
        .getByRole("form", { name: "Редактор страницы квартиры" })
        .waitFor();
      await op.getByLabel("Название", { exact: true }).fill(title);
      await op
        .getByLabel("Расположение для гостей", { exact: true })
        .fill("Астана · район Есиль");
      await op
        .getByLabel("Описание", { exact: true })
        .fill(
          "Светлое пространство для спокойной поездки. Большие окна, удобная кухня и место для работы. Рядом прогулочная зона.",
        );
      await op
        .getByLabel("Свои преимущества", { exact: true })
        .fill("Панорамные окна\nРядом с парком");
      await op.getByRole("button", { name: "Wi-Fi", exact: true }).click();
      await op.getByRole("button", { name: "Кухня", exact: true }).click();
      await op.getByText("Связь, стоимость и правила", { exact: true }).click();
      await op
        .getByLabel("Ссылка для связи", { exact: true })
        .fill("https://wa.me/77015550000");
      await op
        .getByLabel("Важные правила", { exact: true })
        .fill("Без курения и вечеринок. Тихие часы после 22:00.");
      await op
        .getByLabel("Добавить фото с телефона", { exact: true })
        .setInputFiles([
          "public/icons/shanyraq-192.png",
          "public/brand/hotel-lobby.webp",
        ]);
      await op.getByText(/Фото добавлены. Проверьте/).waitFor();
      await op
        .getByRole("button", { name: "Переместить фото 2 раньше", exact: true })
        .click();
      assert(
        (
          await op.getByLabel("Описание", { exact: true }).inputValue()
        ).includes("Светлое пространство"),
      );
      assert(
        (
          await op.getByLabel("Свои преимущества", { exact: true }).inputValue()
        ).includes("Панорамные окна"),
      );
      await overflow(op, "owner editor 390");
    },
  );
  await check(
    "saving draft persists real data but does not publish or leak photos; owner preview works",
    async () => {
      await confirm();
      await op
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await op
        .getByText("Черновик сохранён. Гостям он не виден.", { exact: true })
        .waitFor();
      const w = await (
        await owner.request.get(`${base}/api/guest-stay?roomId=${f.roomId}`)
      ).json();
      listingId = w.listing.id;
      const data = await (
        await guest.request.get(
          `${base}/api/catalog?slug=${f.slug}&listingId=${listingId}`,
        )
      ).json();
      assert.equal(data.cards.length, 0);
      assert.equal(
        (
          await guest.request.get(`${base}/api/catalog/${listingId}/photo/0`)
        ).status(),
        404,
      );
      assert.equal(
        (
          await guest.request.get(
            `${base}/api/catalog/${listingId}/photo/0?preview=true`,
          )
        ).status(),
        401,
      );
      const preview = await owner.newPage();
      await preview.goto(`${base}/catalog/${f.slug}/${listingId}?preview=true`);
      await preview
        .getByRole("heading", { name: title, exact: true })
        .waitFor();
      await preview.waitForFunction(() =>
        Array.from(document.images).some(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      await preview.close();
      await op.reload();
      await op
        .getByRole("form", { name: "Редактор страницы квартиры" })
        .waitFor();
      assert.equal(
        await op.getByLabel("Название", { exact: true }).inputValue(),
        title,
      );
      assert(
        (
          await op.getByLabel("Свои преимущества", { exact: true }).inputValue()
        ).includes("Wi-Fi"),
      );
    },
  );
  await check(
    "explicit owner publication makes sanitized photo-first catalog visible without app menus",
    async () => {
      await op
        .getByRole("switch", { name: "Показывать в каталоге", exact: true })
        .check();
      await confirm();
      await op
        .getByRole("button", { name: "Сохранить и опубликовать", exact: true })
        .click();
      await op
        .getByText("Страница квартиры сохранена и опубликована.", {
          exact: true,
        })
        .waitFor();
      await gp.goto(`${base}/catalog/${f.slug}`);
      await gp.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(await gp.locator("nav").count(), 0);
      assert.equal(
        await gp
          .getByRole("button", { name: /уведомлен|бургер|меню/i })
          .count(),
        0,
      );
      assert.equal(
        await gp
          .getByRole("button", { name: /начать|бронировать|оплатить/i })
          .count(),
        0,
      );
      const body = await gp.content();
      for (const marker of [
        "E2E_SECRET_DOOR",
        "E2E_WIFI_SECRET",
        "PRIVATE_ADDRESS",
        "PRIVATE_GUEST",
      ])
        assert(!body.includes(marker));
      const photo = await guest.request.get(
        `${base}/api/catalog/${listingId}/photo/0`,
      );
      assert(photo.ok());
      const bytes = await photo.body();
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8);
    },
  );
  await check(
    "card opens apartment description, actual advantages and working swipe/thumbnail gallery",
    async () => {
      const card = gp
        .locator("article")
        .filter({ has: gp.getByRole("heading", { name: title, exact: true }) });
      await card
        .getByRole("link", { name: "Смотреть квартиру", exact: true })
        .click();
      await gp
        .getByRole("heading", { name: "О квартире", exact: true })
        .waitFor();
      assert(
        await gp
          .getByRole("heading", { name: "Преимущества", exact: true })
          .isVisible(),
      );
      assert(
        await gp.getByText("Панорамные окна", { exact: true }).isVisible(),
      );
      assert(
        await gp
          .getByRole("link", { name: "Связаться с хозяином", exact: true })
          .isVisible(),
      );
      await gp
        .getByRole("button", { name: "Следующее фото", exact: true })
        .click();
      await gp
        .getByRole("button", { name: "Показать фото 2", exact: true })
        .and(gp.locator("[aria-pressed=true]"))
        .waitFor();
      await gp
        .getByRole("button", { name: "Показать фото 1", exact: true })
        .click();
      await gp
        .getByRole("button", { name: "Показать фото 1", exact: true })
        .and(gp.locator("[aria-pressed=true]"))
        .waitFor();
    },
  );
  await check(
    "catalog, apartment and owner editor fit phone/tablet/desktop widths and expanded forms",
    async () => {
      const cp = await guest.newPage();
      await cp.goto(`${base}/catalog/${f.slug}`);
      await cp.getByRole("heading", { name: title, exact: true }).waitFor();
      for (const width of [320, 360, 390, 430, 768, 1440]) {
        for (const p of [cp, gp, op])
          await p.setViewportSize({ width, height: 900 });
        await overflow(cp, `catalog ${width}`);
        await overflow(gp, `apartment ${width}`);
        await gp.getByLabel("Даты и гости", { exact: true }).click();
        await overflow(gp, `expanded apartment filter ${width}`);
        assert(
          (await gp.getByLabel("Заезд", { exact: true }).boundingBox()).width >=
            180,
        );
        await gp.getByLabel("Даты и гости", { exact: true }).click();
        await overflow(op, `editor ${width}`);
        for (const [p, name] of [
          [cp, "catalog"],
          [gp, "apartment"],
          [op, "owner-editor"],
        ])
          await p.screenshot({
            path: `${out}/${name}-${width}.png`,
            fullPage: true,
          });
      }
      await cp.close();
      await gp.setViewportSize({ width: 390, height: 844 });
      await op.setViewportSize({ width: 390, height: 844 });
      await gp.getByLabel("Даты и гости", { exact: true }).click();
      await gp.getByLabel("Заезд", { exact: true }).fill(f.dates.checkIn);
      await gp.getByLabel("Выезд", { exact: true }).fill(f.dates.checkOut);
      await gp.getByLabel("Гостей", { exact: true }).fill("2");
      await overflow(gp, "expanded date form 390");
    },
  );
  await check(
    "date checks reuse live availability and preserve selection between card and catalog",
    async () => {
      await gp
        .getByRole("button", { name: "Показать доступность", exact: true })
        .click();
      await gp.getByText("Занято на выбранные даты", { exact: true }).waitFor();
      assert(new URL(gp.url()).searchParams.has("checkIn"));
      await gp.getByRole("link", { name: "Все квартиры", exact: true }).click();
      await gp.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(new URL(gp.url()).searchParams.get("guests"), "2");
      const card = gp
        .locator("article")
        .filter({ has: gp.getByRole("heading", { name: title, exact: true }) });
      const href = await card
        .getByRole("link", { name: "Смотреть квартиру", exact: true })
        .getAttribute("href");
      assert(href.includes(`checkIn=${f.dates.checkIn}`));
    },
  );
  await check(
    "large upload is a useful error; existing unsaved description is kept",
    async () => {
      await op
        .getByLabel("Описание", { exact: true })
        .fill("Несохранённое описание остаётся после ошибки фото.");
      await op
        .getByLabel("Добавить фото с телефона", { exact: true })
        .setInputFiles({
          name: "too-large.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
        });
      await op
        .getByRole("alert")
        .filter({ hasText: "Выберите фотографии до 4 МБ каждая." })
        .waitFor();
      assert(
        (
          await op.getByLabel("Описание", { exact: true }).inputValue()
        ).startsWith("Несохранённое"),
      );
      // Restore without navigating away from dirty editor.
      await op
        .getByLabel("Описание", { exact: true })
        .fill(
          "Светлое пространство для спокойной поездки. Большие окна, удобная кухня и место для работы. Рядом прогулочная зона.",
        );
    },
  );
  await check(
    "owner can remove a photo with inline confirmation; saved catalog keeps correct cover",
    async () => {
      await op
        .getByRole("button", { name: /Удалить из библиотеки .*фото 1/ })
        .click();
      await op
        .getByRole("button", { name: "Убрать фото", exact: true })
        .click();
      await op
        .getByText(
          "Фото убрано из библиотеки. Сохраните обновлённую карточку.",
          { exact: true },
        )
        .waitFor();
      await confirm();
      await op
        .getByRole("button", { name: "Сохранить и опубликовать", exact: true })
        .click();
      await op
        .getByText("Страница квартиры сохранена и опубликована.", {
          exact: true,
        })
        .waitFor();
      await gp.goto(`${base}/catalog/${f.slug}/${listingId}`);
      await gp.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(
        await gp
          .getByRole("button", { name: "Следующее фото", exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    "unpublish removes catalog entry and public photo bytes, owner preview remains private",
    async () => {
      await op
        .getByRole("switch", { name: "Показывать в каталоге", exact: true })
        .uncheck();
      await confirm();
      await op
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await op
        .getByText("Черновик сохранён. Гостям он не виден.", { exact: true })
        .waitFor();
      const data = await (
        await guest.request.get(
          `${base}/api/catalog?slug=${f.slug}&listingId=${listingId}`,
        )
      ).json();
      assert.equal(data.cards.length, 0);
      assert.equal(
        (
          await guest.request.get(`${base}/api/catalog/${listingId}/photo/0`)
        ).status(),
        404,
      );
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        realPhones: "NOT RUN",
        images:
          "Synthetic local fixture only; existing repository image uploaded through real owner API",
      },
      null,
      2,
    ),
  );
  console.log(`${results.length} real built-app catalog/editor checks passed.`);
} catch (e) {
  await op
    .screenshot({ path: `${out}/failure-owner.png`, fullPage: true })
    .catch(() => undefined);
  await gp
    .screenshot({ path: `${out}/failure-guest.png`, fullPage: true })
    .catch(() => undefined);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, failure: e.name }, null, 2),
  );
  console.error(e.message.replace(/[a-f0-9]{64}/g, "[redacted]"));
  process.exitCode = 1;
} finally {
  await owner.close();
  await guest.close();
  await browser.close();
}
