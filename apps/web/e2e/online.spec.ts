import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:4173";

async function dismissRules(page: Page) {
  // The rules dialog sits over the board, so wait for the board before looking for it.
  await expect(page.locator(".board")).toBeVisible();
  const rules = page.getByRole("dialog", { name: "Rules" });
  if (await rules.isVisible()) await page.getByRole("button", { name: "OK" }).click();
  await expect(rules).toBeHidden();
}

async function gameMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Game" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

const moves = (page: Page) => page.getByRole("region", { name: "Moves" }).locator("li");

async function play(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

test("two players: create, join, play, reload, draw, resign, mines revealed", async ({
  browser,
}) => {
  const white = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  const black = await (await browser.newContext({ baseURL: BASE_URL })).newPage();

  // White creates a game and reads the code.
  await white.goto("/");
  await dismissRules(white);
  await gameMenu(white, "Online...");
  await white.getByRole("button", { name: "Create game" }).click();
  const code = (await white.getByTestId("invite-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(white.getByText("Waiting for opponent...")).toBeVisible();

  // Black joins with the code typed in lower case with a space in it.
  await black.goto("/");
  await dismissRules(black);
  await gameMenu(black, "Online...");
  await black
    .getByLabel("Invite code")
    .fill(`${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`);
  await black.getByRole("button", { name: "Join game" }).click();

  // Both see the board; black's orientation is fixed with black at the bottom.
  await expect(white.getByRole("dialog", { name: "Waiting room" })).toBeHidden();
  await expect(white.locator("[data-square]")).toHaveCount(64);
  await expect(black.locator("[data-square]")).toHaveCount(64);
  await expect(white.locator("[data-square]").first()).toHaveAttribute("data-square", "a8");
  await expect(black.locator("[data-square]").first()).toHaveAttribute("data-square", "h1");
  await expect(black.getByTestId("status-you")).toContainText("Black");

  // A few moves. Each side's first move is mine-safe (3.1); later landings may hit a mine,
  // so only the move log is checked, which grows either way.
  await play(white, "e2", "e4");
  await expect(moves(white)).toHaveCount(1);
  await expect(moves(black)).toHaveCount(1);
  await expect(black.getByText(/Pass to/)).toBeHidden();
  await play(black, "e7", "e5");
  await expect(moves(white)).toHaveCount(2);
  await play(white, "g1", "f3");
  await expect(moves(white)).toHaveCount(3);
  await expect(moves(black)).toHaveCount(3);

  // Black reloads mid-game and resumes from the stored seat token.
  await black.reload();
  await dismissRules(black);
  await expect(black.locator("[data-square]")).toHaveCount(64);
  await expect(black.locator("[data-square]").first()).toHaveAttribute("data-square", "h1");
  await expect(moves(black)).toHaveCount(3);

  // White offers a draw, black declines.
  await gameMenu(white, "Offer draw");
  await white
    .getByRole("dialog", { name: "Offer draw" })
    .getByRole("button", { name: "Offer draw" })
    .click();
  await expect(white.getByText("Draw offered. Waiting for an answer...")).toBeVisible();
  await black.getByRole("button", { name: "Decline draw" }).click();
  await black
    .getByRole("dialog", { name: "Decline draw" })
    .getByRole("button", { name: "Decline draw" })
    .click();
  await expect(white.getByText("Draw offered. Waiting for an answer...")).toBeHidden();

  // White resigns after confirming.
  await gameMenu(white, "Resign");
  await white
    .getByRole("dialog", { name: "Resign" })
    .getByRole("button", { name: "Resign" })
    .click();

  for (const page of [white, black]) {
    const over = page.getByRole("dialog", { name: "Game over" });
    await expect(over).toBeVisible();
    await expect(over.getByTestId("gameover-reason")).toContainText("resignation");
    await expect(over.getByTestId("gameover-mines")).toContainText("Mines (");
  }

  await white
    .getByRole("dialog", { name: "Game over" })
    .getByRole("button", { name: "Back to lobby" })
    .click();
  await expect(white.getByRole("dialog", { name: "Online" })).toBeVisible();

  await white.context().close();
  await black.context().close();
});
