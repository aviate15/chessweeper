import { expect, test, type Page } from "@playwright/test";

// Manual mine mode (design doc 3.10). Written against the built client; not yet run in CI.
// The online test needs the M-C server (placement messages and timer).

const BASE_URL = "http://localhost:4173";

async function dismissRules(page: Page) {
  await expect(page.locator(".board")).toBeVisible();
  const rules = page.getByRole("dialog", { name: "Rules" });
  if (await rules.isVisible()) await page.getByRole("button", { name: "OK" }).click();
  await expect(rules).toBeHidden();
}

async function placeMines(page: Page, squares: string[]) {
  for (const name of squares) await page.locator(`[data-square="${name}"]`).click();
}

test("local: White places, the board is hidden for Black, then play starts", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "chessweeper.options",
      JSON.stringify({ reshuffleInterval: 10, densityPercent: 30, mode: "manual" }),
    );
    localStorage.setItem("chessweeper.rulesHidden", "1");
  });
  await page.goto("/");

  // White's placement round: quota 5, no timer, no info bar.
  await expect(page.getByText("Place your mines")).toBeVisible();
  await expect(page.getByTestId("placement-quota")).toContainText("of 5");
  await expect(page.getByTestId("placement-countdown")).toHaveCount(0);
  await placeMines(page, ["a3", "b3", "c3", "d3", "e3"]);
  await expect(page.getByTestId("placement-placed")).toContainText("5");
  await page.getByRole("button", { name: "Done" }).click();

  // The handoff hides the board completely.
  await expect(page.getByText("Pass to Black to place mines")).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(0);
  await page.getByRole("button", { name: "Ready" }).click();

  // Black starts with an empty board of their own marks.
  await expect(page.getByTestId("placement-placed")).toContainText("0");
  await expect(page.locator("[data-mine-kind]")).toHaveCount(0);
  await placeMines(page, ["a6", "b6", "c6", "d6", "e6"]);
  await page.getByRole("button", { name: "Done" }).click();

  // Handoff to the side to move, then the normal game: 10 live mines, nothing shown.
  await expect(page.getByText("Pass to White")).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(0);
  await page.getByRole("button", { name: "Ready" }).click();
  await expect(page.getByTestId("status-turn")).toContainText("White to move");
  await expect(page.getByTestId("mine-count")).toContainText("10");
  await expect(page.locator("[data-mine-kind]")).toHaveCount(0);
});

test("online: both place secretly, the round ends when both are Done", async ({ browser }) => {
  const white = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  const black = await (await browser.newContext({ baseURL: BASE_URL })).newPage();

  await white.goto("/");
  await dismissRules(white);
  await white.getByRole("button", { name: "Game" }).click();
  await white.getByRole("menuitem", { name: "Online..." }).click();
  await white.getByLabel("Mine mode").selectOption("manual");
  await white.getByRole("button", { name: "Create game" }).click();
  await expect(white.getByTestId("waiting-settings")).toContainText("Manual mine mode");
  const code = (await white.getByTestId("invite-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await black.goto("/");
  await dismissRules(black);
  await black.getByRole("button", { name: "Game" }).click();
  await black.getByRole("menuitem", { name: "Online..." }).click();
  await black.getByLabel("Invite code").fill(code);
  await black.getByRole("button", { name: "Join game" }).click();

  // Both are placing, with a countdown and their own colour at the bottom.
  for (const page of [white, black]) {
    await expect(page.getByText("Place your mines")).toBeVisible();
    await expect(page.getByTestId("placement-countdown")).toBeVisible();
    await expect(page.getByTestId("placement-quota")).toContainText("of 5");
  }
  await expect(white.locator("[data-square]").first()).toHaveAttribute("data-square", "a8");
  await expect(black.locator("[data-square]").first()).toHaveAttribute("data-square", "h1");

  // White places 5, Black only 2 (the rest is placed at random for Black).
  await placeMines(white, ["a3", "b3", "c3", "d3", "e3"]);
  await placeMines(black, ["a6", "b6"]);
  // The opponent never sees the squares, only the state.
  await expect(black.locator('[data-square="a3"]')).not.toHaveAttribute("data-mine-kind", /.*/);
  await white.getByRole("button", { name: "Done" }).click();
  await expect(black.getByText("Opponent ready")).toBeVisible();
  await black.getByRole("button", { name: "Done" }).click();

  // Play begins: 10 mines, and only Black is told about the random fill.
  await expect(white.getByTestId("mine-count")).toContainText("10");
  await expect(black.getByTestId("mine-count")).toContainText("10");
  await expect(black.getByTestId("status-narration")).toContainText("placed at random for you");
  await expect(white.getByTestId("status-narration")).not.toContainText("placed at random");
  await expect(white.getByTestId("status-turn")).toContainText("White to move");

  // Resigning ends the game and shows who placed each mine.
  await white.getByRole("button", { name: "Game" }).click();
  await white.getByRole("menuitem", { name: "Resign" }).click();
  await white
    .getByRole("dialog", { name: "Resign" })
    .getByRole("button", { name: "Resign" })
    .click();
  await expect(white.getByRole("dialog", { name: "Game over" })).toBeVisible();
  await white
    .getByRole("dialog", { name: "Game over" })
    .getByRole("button", { name: "View board" })
    .click();
  await expect(white.locator('[data-mine-kind="w"]').first()).toBeVisible();
});
