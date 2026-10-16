import { expect, test } from "@playwright/test";

test("play through handoffs, open Moves, resign and see the mines", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chessweeper" })).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(64);

  const play = async (from: string, to: string, next: "Black" | "White") => {
    await page.locator(`[data-square="${from}"]`).click();
    await page.locator(`[data-square="${to}"]`).click();
    await expect(page.getByText(`Pass to ${next}`)).toBeVisible();
    await page.getByRole("button", { name: "Ready" }).click();
  };

  // Pawn moves first: a mine on the landing square is relocated by safe start (3.1).
  await play("e2", "e4", "Black");
  await play("e7", "e5", "White");
  await play("d2", "d4", "Black");

  await page.getByRole("button", { name: "Moves" }).click();
  const moves = page.getByRole("dialog", { name: "Moves" });
  await expect(moves).toBeVisible();
  await expect(moves.locator("li")).toHaveCount(3);
  await moves.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Resign" }).click();
  const over = page.getByRole("dialog", { name: "Game over" });
  await expect(over).toBeVisible();
  await expect(over).toContainText("wins");
  await expect(over).toContainText("resignation");
  await expect(page.getByTestId("gameover-mines")).toContainText("Mines (");
  await over.getByRole("button", { name: "View board" }).click();
  expect(await page.locator("[data-mine]").count()).toBeGreaterThan(0);
});
