import { expect, test } from "@playwright/test";

// Two independent browser contexts = two different users.
async function twoUsersOnNewBoard(browser) {
  const alice = await (await browser.newContext()).newPage();
  await alice.goto("/");
  await alice.getByRole("button", { name: "New board" }).click();
  await expect(alice).toHaveURL(/\/board\/[0-9a-f-]{36}$/);
  await expect(alice.getByRole("status").filter({ hasText: "Live" })).toBeVisible();

  const bob = await (await browser.newContext()).newPage();
  await bob.goto(alice.url());
  await expect(bob.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
  return { alice, bob };
}

async function drag(page, from, to, steps = 10) {
  const box = await page.getByTestId("canvas").boundingBox();
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps });
  await page.mouse.up();
}

const shapes = (page) => page.locator("[data-testid=canvas] [data-shape-id]");

test("strokes, shapes, erasing and undo sync between two users", async ({ browser }) => {
  const { alice, bob } = await twoUsersOnNewBoard(browser);

  // Alice draws a stroke: Bob sees it, Alice has exactly one (no echo).
  await drag(alice, [300, 300], [500, 350]);
  await expect(shapes(bob)).toHaveCount(1);
  await expect(shapes(alice)).toHaveCount(1);

  // Bob draws a rectangle with the keyboard shortcut.
  await bob.keyboard.press("r");
  await drag(bob, [300, 450], [450, 550]);
  await expect(bob.locator("[data-testid=canvas] rect[data-shape-id]")).toHaveCount(1);
  await expect(shapes(alice)).toHaveCount(2);

  // Bob reloads: the board is still there.
  await bob.reload();
  await expect(shapes(bob)).toHaveCount(2);

  // Alice erases the rectangle by dragging across its top edge.
  await alice.keyboard.press("e");
  await drag(alice, [350, 430], [350, 470]);
  await expect(shapes(bob)).toHaveCount(1);

  // Alice undoes the erase: it comes back for Bob too.
  await alice.keyboard.press("Control+z");
  await expect(shapes(bob)).toHaveCount(2);
});

test("text is placed by click-then-type and keeps its size", async ({ browser }) => {
  const { alice, bob } = await twoUsersOnNewBoard(browser);
  await alice.keyboard.press("t");
  const box = await alice.getByTestId("canvas").boundingBox();
  await alice.mouse.click(box.x + 400, box.y + 300);
  await alice.getByRole("textbox", { name: "Text" }).fill("Hello Bob");
  await alice.keyboard.press("Enter");

  const text = bob.locator("[data-testid=canvas] text[data-shape-id]");
  await expect(text).toHaveText("Hello Bob");
  const size = Number(await text.getAttribute("font-size"));
  expect(size).toBeGreaterThan(8);
});

test("participants see each other, live cursors and in-progress strokes", async ({ browser }) => {
  const { alice, bob } = await twoUsersOnNewBoard(browser);
  await expect(alice.getByLabel("2 people on this board")).toBeVisible();

  const aliceName = await alice.evaluate(() => localStorage.getItem("teamsketch:name"));
  const box = await alice.getByTestId("canvas").boundingBox();
  await alice.mouse.move(box.x + 200, box.y + 200);
  await alice.mouse.move(box.x + 250, box.y + 220);
  await expect(bob.getByText(aliceName, { exact: true })).toBeVisible();

  // While Alice is still drawing, Bob already sees the stroke (not yet committed).
  await alice.mouse.down();
  await alice.mouse.move(box.x + 400, box.y + 300, { steps: 10 });
  const peerStrokes = bob.locator("[data-testid=canvas] path[data-shape-id]");
  await expect(peerStrokes).toHaveCount(1);
  await expect(peerStrokes).toHaveAttribute("opacity", "0.6");
  await alice.mouse.up();
  await expect(peerStrokes).toHaveAttribute("opacity", "1");
  await expect(peerStrokes).toHaveCount(1);
});

test("unknown boards show a not-found page", async ({ page }) => {
  await page.goto(`/board/${crypto.randomUUID()}`);
  await expect(page.getByRole("heading", { name: "This board doesn't exist" })).toBeVisible();
});
