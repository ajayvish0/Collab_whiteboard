import { expect, test } from "@playwright/test";

// Real touch input through the Chrome DevTools Protocol, so the browser
// produces genuine touch pointer events (audit I-9).
test("draws with one finger and pinch-zooms with two", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New board" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    });

  await touch("touchStart", [[80, 300]]);
  for (let i = 1; i <= 6; i++) await touch("touchMove", [[80 + i * 25, 300 + i * 15]]);
  await touch("touchEnd", []);
  await expect(page.locator("[data-testid=canvas] path[data-shape-id]")).toHaveCount(1);

  const zoomLabel = page.getByRole("button", { name: /^Zoom \d+%/ });
  await expect(zoomLabel).toHaveText("100%");
  await touch("touchStart", [[150, 400], [250, 400]]);
  for (let i = 1; i <= 5; i++) await touch("touchMove", [[150 - i * 10, 400], [250 + i * 10, 400]]);
  await touch("touchEnd", []);
  await expect(zoomLabel).toHaveText("200%");
  // Pinching must not leave a stray stroke behind.
  await expect(page.locator("[data-testid=canvas] path[data-shape-id]")).toHaveCount(1);
});
