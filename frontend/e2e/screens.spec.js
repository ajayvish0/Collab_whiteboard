import { test } from "@playwright/test";

// Not an assertion test: produces screenshots for docs when SCREENSHOTS=1.
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture");
test("capture screenshots", async ({ page }, info) => {
  await page.goto("/");
  await page.screenshot({ path: `../docs/screenshots/${info.project.name}-landing.png` });
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByRole("status").filter({ hasText: "Live" }).waitFor();
  const box = await page.getByTestId("canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 15 });
  await page.mouse.up();
  await page.screenshot({ path: `../docs/screenshots/${info.project.name}-board.png` });
});
