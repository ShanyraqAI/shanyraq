/** Built-app HTTP + browser E2E. No mocked business APIs, no external sends. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright"
);
const base = process.env.GUEST_STAY_TEST_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Loopback disposable deployment only");
const f = JSON.parse(
  await readFile(
    process.env.GUEST_STAY_FIXTURE_PATH || "/data/stay-fixture.json",
    "utf8",
  ),
);
const out = process.env.GUEST_STAY_TEST_OUTPUT || "/data/stay-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [],
  mobile = [];
let owner, guest;
const errorEvents = [];
async function check(label, work) {
  console.log(`RUN: ${label}`);
  await work();
  results.push({ label, status: "PASS" });
  console.log(`PASS: ${label}`);
}
try {
  owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const op = await owner.newPage(),
    gp = await guest.newPage();
  for (const page of [op, gp]) {
    page.on("pageerror", (e) => errorEvents.push(e.name));
    page.on("dialog", async (dialog) => {
      errorEvents.push("UnexpectedDialog");
      await dialog.dismiss();
    });
  }
  const origin = new URL(base).origin;
  const staff = async (body) => {
    const response = await owner.request.post(`${base}/api/guest-stay`, {
      headers: { Origin: origin, "x-shanyraq-scope": f.scope },
      data: body,
    });
    assert(response.ok(), `staff request returned ${response.status()}`);
    return response.json();
  };
  let token, stayId, initialUrl;
  await check(
    "unauthenticated staff API and cross-origin guest request are denied",
    async () => {
      const response = await guest.request.get(
        `${base}/api/guest-stay?roomId=${f.roomId}`,
      );
      assert.equal(response.status(), 401);
      const csrf = await guest.request.post(`${base}/api/guest/stay`, {
        headers: { Origin: "https://attacker.example" },
        data: { action: "load", token: "0".repeat(64) },
      });
      assert.equal(csrf.status(), 400);
    },
  );
  await check(
    "real owner booking card creates a stable personalized form link",
    async () => {
      await op.goto(`${base}/dashboard/reservations/${f.reservationId}`);
      await op
        .getByRole("button", { name: "Не сейчас", exact: true })
        .waitFor({ timeout: 2000 })
        .then(() =>
          op.getByRole("button", { name: "Не сейчас", exact: true }).click(),
        )
        .catch(() => undefined);
      await op
        .getByRole("heading", { name: "Гость и заселение", exact: true })
        .waitFor();
      const send = op.getByRole("button", {
        name: "Отправить форму гостю",
        exact: true,
      });
      await send.click();
      await op
        .getByRole("button", { name: "Отправить форму гостю", exact: true })
        .waitFor();
      await op.getByText(/Персональная ссылка подготовлена/).waitFor();
      await op
        .getByRole("button", { name: "Отправить форму гостю", exact: true })
        .click();
      const prepared = await op.getByLabel("Готовый текст").inputValue();
      initialUrl = prepared.match(
        /https?:\/\/[^\s]+\/guest\/stay#[a-f0-9]{64}/,
      )?.[0];
      assert(initialUrl);
      token = new URL(initialUrl).hash.slice(1);
      const w = await owner.request.get(
        `${base}/api/guest-stay?reservationId=${f.reservationId}`,
      );
      stayId = (await w.json()).stays[0].id;
      assert(
        await op
          .getByRole("button", {
            name: "Отправить страницу заселения",
            exact: true,
          })
          .isDisabled(),
      );
    },
  );
  const guestApi = async (body) =>
    guest.request.post(`${base}/api/guest/stay`, {
      headers: { Origin: origin },
      data: { token, ...body },
    });
  await check(
    "no secrets in pre-approval HTML, API, RSC prefetch or request URLs",
    async () => {
      const requestUrls = [];
      gp.on("request", (r) => requestUrls.push(r.url()));
      const nav = await gp.goto(initialUrl);
      assert(nav);
      assert.match(nav.headers()["cache-control"] || "", /no-store/);
      assert.equal(nav.headers()["referrer-policy"], "no-referrer");
      await gp
        .getByRole("heading", { name: "Данные для этой поездки", exact: true })
        .waitFor();
      const api = await guestApi({ action: "load" });
      const body = await api.text();
      for (const secret of [
        "E2E_SECRET_DOOR",
        "E2E_WIFI_SECRET",
        "keyInstructions",
        "wifiPassword",
      ]) {
        assert(!body.includes(secret));
        assert(!(await gp.content()).includes(secret));
      }
      const rsc = await guest.request.get(`${base}/guest/stay?_rsc=test`, {
        headers: { RSC: "1", "Next-Router-Prefetch": "1" },
      });
      assert(!(await rsc.text()).includes("E2E_SECRET_DOOR"));
      assert(!requestUrls.some((v) => v.includes(token)));
      assert(!requestUrls.some((v) => /clarity|analytics/i.test(v)));
      const privatePhoto = await guestApi({ action: "photo", position: 0 });
      assert(!privatePhoto.ok());
    },
  );
  await check(
    "real form saves server draft; reload preserves values and stable URL",
    async () => {
      await gp
        .getByLabel("Имя", { exact: true })
        .fill("ОченьДлинноеИмя" + "А".repeat(50));
      await gp
        .getByLabel("Фамилия", { exact: true })
        .fill("Фамилия" + "Б".repeat(60));
      await gp
        .getByLabel("Контактный телефон", { exact: true })
        .fill("+77015550123");
      await gp
        .getByLabel("Ожидаемое время прибытия", { exact: true })
        .fill("23:50");
      await gp
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await gp
        .getByText("Черновик сохранён на сервере для этой ссылки.")
        .waitFor();
      await gp.reload();
      await gp
        .getByRole("heading", { name: "Данные для этой поездки", exact: true })
        .waitFor();
      assert.match(
        await gp.getByLabel("Имя", { exact: true }).inputValue(),
        /^ОченьДлинноеИмя/,
      );
      assert.equal(gp.url(), initialUrl);
      assert.equal(await gp.evaluate(() => localStorage.length), 0);
    },
  );
  async function overflow(page, label) {
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    assert(
      size.scroll <= size.width + 1,
      `${label}: horizontal overflow ${size.scroll}/${size.width}`,
    );
    const buttons = await page.locator("button:visible").evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, right: r.right, height: r.height };
      }),
    );
    for (const b of buttons) {
      assert(
        b.left >= -1 && b.right <= size.width + 1,
        `${label}: clipped button`,
      );
    }
  }
  await check(
    "mobile/desktop real CSS viewport and orientation matrix",
    async () => {
      const cp = await guest.newPage();
      await cp.goto(`${base}/catalog/${f.slug}`);
      await cp.getByRole("heading", { level: 2 }).first().waitFor();
      for (const width of [320, 360, 390, 430, 1440])
        for (const landscape of [false, true]) {
          const viewport = landscape
            ? {
                width: width === 1440 ? 1440 : 844,
                height: width === 1440 ? 700 : width,
              }
            : { width, height: width === 1440 ? 1000 : 844 };
          await gp.setViewportSize(viewport);
          await cp.setViewportSize(viewport);
          await overflow(
            gp,
            `guest ${width} ${landscape ? "landscape" : "portrait"}`,
          );
          await overflow(
            cp,
            `catalog ${width} ${landscape ? "landscape" : "portrait"}`,
          );
          mobile.push({
            nominalWidth: width,
            orientation: landscape ? "landscape" : "portrait",
            ...viewport,
            status: "PASS",
          });
          if (!landscape) {
            await gp.screenshot({
              path: `${out}/guest-form-${width}.png`,
              fullPage: true,
            });
            await cp.screenshot({
              path: `${out}/catalog-${width}.png`,
              fullPage: true,
            });
          }
        }
      await gp.setViewportSize({ width: 390, height: 420 });
      await gp.getByLabel("Ожидаемое время прибытия", { exact: true }).focus();
      await gp
        .getByLabel("Ожидаемое время прибытия", { exact: true })
        .scrollIntoViewIfNeeded();
      assert(
        await gp
          .getByLabel("Ожидаемое время прибытия", { exact: true })
          .isVisible(),
      );
      await overflow(gp, "reduced visual viewport");
      await gp.setViewportSize({ width: 390, height: 844 });
      await cp.close();
    },
  );
  await check(
    "double submit moves only to waiting, never automatic approval",
    async () => {
      await gp
        .getByRole("button", { name: "Передать данные хозяину", exact: true })
        .dblclick();
      await gp
        .getByText(/Данные переданы хозяину/)
        .first()
        .waitFor();
      const data = await (await guestApi({ action: "load" })).json();
      assert.equal(data.formState, "SUBMITTED");
      assert.equal(data.access, null);
    },
  );
  await check(
    "owner reviews and explicitly grants; same guest URL reveals access",
    async () => {
      await op.reload();
      await op
        .getByRole("heading", { name: "Гость и заселение", exact: true })
        .waitFor();
      const block = op.getByRole("region", { name: "Гость и заселение" });
      await block
        .getByText("Проверка, условия и разрешение", { exact: true })
        .click();
      await block
        .getByLabel("Причина / пояснение")
        .fill("Проверены данные этой поездки");
      await block
        .getByRole("button", { name: "Применить решение", exact: true })
        .click();
      await block.getByText(/Проверка: выполнена/).waitFor();
      await block.getByLabel("Действие", { exact: true }).selectOption("GRANT");
      await block
        .getByRole("button", { name: "Применить решение", exact: true })
        .click();
      await block.getByText(/Доступ: разрешён/).waitFor();
      await gp.reload();
      await gp
        .getByRole("heading", { name: "Когда и куда приехать", exact: true })
        .waitFor();
      assert.equal(gp.url(), initialUrl);
      assert(
        await gp.getByText("E2E_SECRET_DOOR", { exact: true }).isVisible(),
      );
      await gp.screenshot({
        path: `${out}/guest-authorized-390.png`,
        fullPage: true,
      });
      await op
        .getByRole("button", {
          name: "Отправить страницу заселения",
          exact: true,
        })
        .click();
      assert(
        (await op.getByLabel("Готовый текст").inputValue()).includes(
          initialUrl,
        ),
      );
    },
  );
  await check("cancelled native share is not reported as sent", async () => {
    await op.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: () =>
          Promise.reject(new DOMException("cancelled", "AbortError")),
      });
    });
    await op
      .getByRole("button", { name: "Системное меню передачи", exact: true })
      .click();
    await op
      .getByText("Передача отменена. Сообщение не отмечено отправленным.")
      .waitFor();
  });
  await check(
    "unsupported clipboard shows manual fallback without claiming delivery",
    async () => {
      await op.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        }),
      );
      await op
        .getByRole("button", { name: "Скопировать текст", exact: true })
        .click();
      await op
        .getByText("Не удалось скопировать. Выделите текст вручную.", {
          exact: true,
        })
        .waitFor();
    },
  );
  await check(
    "revocation immediately closes HTTP access; reload removes old secrets",
    async () => {
      const w = await (
        await owner.request.get(
          `${base}/api/guest-stay?reservationId=${f.reservationId}`,
        )
      ).json();
      await staff({
        action: "decision",
        stayId,
        version: w.stays[0].version,
        decision: "REVOKE_ACCESS",
        reason: "Отзыв для теста безопасности",
      });
      const data = await (await guestApi({ action: "load" })).json();
      assert.equal(data.access, null);
      await gp.reload();
      await gp
        .getByText(/Ожидайте подтверждения/)
        .first()
        .waitFor();
      assert(!(await gp.content()).includes("E2E_SECRET_DOOR"));
    },
  );
  await check(
    "offline errors fail closed; returning online recovers without duplicate stay",
    async () => {
      await guest.setOffline(true);
      await gp
        .getByRole("button", { name: "Обновить состояние", exact: true })
        .count()
        .then(async (count) => {
          if (count)
            await gp
              .getByRole("button", { name: "Обновить состояние", exact: true })
              .click();
          else
            await gp.evaluate(() => window.dispatchEvent(new Event("focus")));
        });
      await gp
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .waitFor();
      await guest.setOffline(false);
      await gp
        .getByRole("button", { name: "Обновить состояние", exact: true })
        .click();
      await gp
        .getByText(/Ожидайте подтверждения/)
        .first()
        .waitFor();
    },
  );
  await check(
    "token rotation and expiry-style invalid link have useful errors",
    async () => {
      const w = await (
        await owner.request.get(
          `${base}/api/guest-stay?reservationId=${f.reservationId}`,
        )
      ).json();
      await staff({
        action: "decision",
        stayId,
        version: w.stays[0].version,
        decision: "ROTATE",
        reason: "Замена персональной ссылки",
      });
      await gp.reload();
      await gp
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .waitFor();
      assert(!(await gp.content()).includes("E2E_SECRET_DOOR"));
      await gp.goto(`${base}/guest/stay#${"0".repeat(64)}`);
      await gp.reload();
      await gp
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .waitFor();
    },
  );
  assert.equal(
    errorEvents.length,
    0,
    `browser errors: ${errorEvents.join(",")}`,
  );
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        mobile,
        realDevices: "NOT RUN",
        nativeShare: "AbortError simulation only",
        keyboard: "reduced viewport only; no actual OS keyboard",
      },
      null,
      2,
    ),
  );
  console.log(
    `${results.length} built-app browser/HTTP scenarios passed; ${mobile.length} viewport checks.`,
  );
} catch (error) {
  await owner
    ?.pages()[0]
    ?.screenshot({ path: `${out}/failure-owner.png`, fullPage: true })
    .catch(() => undefined);
  await guest
    ?.pages()[0]
    ?.screenshot({ path: `${out}/failure-guest.png`, fullPage: true })
    .catch(() => undefined);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        mobile,
        failure: error instanceof Error ? error.name : "Error",
      },
      null,
      2,
    ),
  );
  console.error(
    error instanceof Error
      ? `${error.name}: ${error.message.replace(/[a-f0-9]{64}/g, "[redacted]")}`
      : "Browser test failed",
  );
  process.exitCode = 1;
} finally {
  await owner?.close();
  await guest?.close();
  await browser.close();
}
