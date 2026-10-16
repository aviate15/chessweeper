import { expect, test } from "@playwright/test";

test("play, flip, use the Game menu, resign and see the mines; /sprites renders", async ({
  page,
}) => {
  await page.goto("/");
  // The rules page opens on first load; close it.
  await expect(page.getByRole("dialog", { name: "Rules" })).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("dialog", { name: "Rules" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Chessweeper" })).toBeVisible();
  await expect(page.locator("[data-square]")).toHaveCount(64);
  // White at the bottom at the start.
  await expect(page.locator("[data-square]").first()).toHaveAttribute("data-square", "a8");

  // Pawn moves first: a mine on the landing square is relocated by safe start (3.1).
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.getByText("Pass to Black")).toBeVisible();
  await page.getByRole("button", { name: "Ready" }).click();

  // Black's back rank is now at the bottom: the board is flipped.
  await expect(page.locator("[data-square]").first()).toHaveAttribute("data-square", "h1");
  await expect(page.locator("[data-square]").last()).toHaveAttribute("data-square", "a8");
  await expect(page.getByRole("region", { name: "Moves" }).locator("li")).toHaveCount(1);

  await page.getByRole("button", { name: "Game" }).click();
  const sound = page.getByRole("menuitemcheckbox", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await page.getByRole("menuitem", { name: "Resign" }).click();

  const over = page.getByRole("dialog", { name: "Game over" });
  await expect(over).toBeVisible();
  await expect(over).toContainText("wins");
  await expect(over).toContainText("resignation");
  await expect(page.getByTestId("gameover-mines")).toContainText("Mines (");
  await over.getByRole("button", { name: "View board" }).click();
  expect(await page.locator("[data-mine]").count()).toBeGreaterThan(0);

  await page.goto("/sprites");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-sprite]").first()).toBeVisible();
});
