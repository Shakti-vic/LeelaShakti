# Multiplication Through 81 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current board into one seamless six-board multiplication rectangle game progressing from 4×4 through 9×9.

**Architecture:** Keep all runtime HTML, CSS, board data, and JavaScript in `index.html`. Use six predefined tilings and one `loadBoard(index)` path to render every board. A dependency-free Python test reads the HTML and verifies the board data and required controls.

**Tech Stack:** HTML, CSS, browser JavaScript, Python standard-library `unittest`

## Global Constraints

- Keep the runtime as one self-contained `index.html`.
- Add no dependencies, backend, build step, authentication, or Telegram-specific code.
- Use predefined solvable boards rather than a generator.
- Preserve mobile-first pointer dragging and gentle feedback.
- Save only the highest unlocked board with `localStorage`.

---

### Task 1: Define and verify the six solvable boards

**Files:**
- Create: `tests/test_game.py`
- Modify: `index.html`

**Interfaces:**
- Consumes: the existing rectangle validation and rendering behavior
- Produces: `LEVELS`, an array of six objects with `size` and `targets`; every target has `value`, `row`, `col`, `rect`, and `color`

- [ ] **Step 1: Write the failing board-data test**

Create `tests/test_game.py`:

```python
import json
import re
import unittest
from pathlib import Path

HTML = Path(__file__).parents[1].joinpath("index.html").read_text(encoding="utf-8")


def read_levels():
    match = re.search(
        r"const LEVELS = /\*TEST_DATA_START\*/(\[.*?\])/\*TEST_DATA_END\*/;",
        HTML,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("LEVELS test data marker not found")
    return json.loads(match.group(1))


class GameDataTest(unittest.TestCase):
    def test_has_six_levels_from_four_to_nine(self):
        levels = read_levels()
        self.assertEqual([level["size"] for level in levels], [4, 5, 6, 7, 8, 9])

    def test_each_level_is_a_complete_non_overlapping_tiling(self):
        for level in read_levels():
            size = level["size"]
            occupied = set()
            for target in level["targets"]:
                row, col, height, width = target["rect"]
                self.assertEqual(target["value"], height * width)
                self.assertLess(target["row"], size)
                self.assertLess(target["col"], size)
                self.assertTrue(row <= target["row"] < row + height)
                self.assertTrue(col <= target["col"] < col + width)
                for r in range(row, row + height):
                    for c in range(col, col + width):
                        self.assertTrue(0 <= r < size and 0 <= c < size)
                        self.assertNotIn((r, c), occupied)
                        occupied.add((r, c))
            self.assertEqual(len(occupied), size * size)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
python -m unittest tests/test_game.py -v
```

Expected: FAIL with `LEVELS test data marker not found`.

- [ ] **Step 3: Replace the single board with six predefined JSON-compatible levels**

In `index.html`, replace `SIZE` and `BOARD` with `LEVELS`. Use these exact tilings:

- 4×4: two 2×4 rectangles (`8`, `8`)
- 5×5: one 2×5 (`10`) and three 1×5 (`5`, `5`, `5`)
- 6×6: one 3×6 (`18`) and three 1×6 (`6`, `6`, `6`)
- 7×7: one 4×7 (`28`) and three 1×7 (`7`, `7`, `7`)
- 8×8: one 5×8 (`40`) and three 1×8 (`8`, `8`, `8`)
- 9×9: one 6×9 (`54`) and three 1×9 (`9`, `9`, `9`)

Represent each target as JSON-compatible data between `/*TEST_DATA_START*/` and `/*TEST_DATA_END*/`. Put each number inside its intended rectangle and assign one of four pleasant colors.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
python -m unittest tests/test_game.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add index.html tests/test_game.py
git commit -m "feat: add six solvable multiplication boards"
```

---

### Task 2: Add seamless progression, Hint, Restart, and saved progress

**Files:**
- Modify: `tests/test_game.py`
- Modify: `index.html`

**Interfaces:**
- Consumes: `LEVELS`
- Produces: `loadBoard(index)`, `saveProgress(index)`, `showHint()`, and a single mutable `currentLevel`

- [ ] **Step 1: Write failing UI and progression tests**

Add to `GameDataTest`:

```python
    def test_required_controls_and_progress_are_present(self):
        for element_id in ("progress", "hint", "restart", "next"):
            self.assertIn(f'id="{element_id}"', HTML)

    def test_progression_and_storage_functions_are_present(self):
        self.assertIn("function loadBoard(index)", HTML)
        self.assertIn("function saveProgress(index)", HTML)
        self.assertIn("function showHint()", HTML)
        self.assertIn('localStorage.setItem("rectangleMathLevel"', HTML)
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
python -m unittest tests/test_game.py -v
```

Expected: FAIL because `progress`, `hint`, and the three functions do not exist.

- [ ] **Step 3: Implement the minimal seamless flow**

Update `index.html`:

- Add `Board 1 of 6` in `#progress`.
- Add a `Hint` button before `Restart`.
- Replace fixed `SIZE` and `BOARD` reads with current-level getters.
- Implement `loadBoard(index)` to reset transient state, rebuild the grid, clone targets, update progress, and disable Next.
- Implement `saveProgress(index)` with `try/catch` around `localStorage.setItem("rectangleMathLevel", String(index))`.
- On startup, read the saved index with `try/catch`, clamp it to `0..5`, and call `loadBoard`.
- Implement `showHint()` by briefly drawing a dashed overlay on the intended `rect` of the first unsolved target, then remove it after 900 ms.
- Make Restart call `loadBoard(currentLevel)`.
- Make Next increment the board, save the newly unlocked index, and load it. On the final board, display `You finished every board! 🎉` and keep Next disabled.
- Keep validation based on selected area, exactly one enclosed unsolved number, and no solved overlap.

- [ ] **Step 4: Run the full tests and verify GREEN**

Run:

```powershell
python -m unittest tests/test_game.py -v
```

Expected: all four tests PASS with no warnings.

- [ ] **Step 5: Check the final HTML manually**

Open `index.html` directly in Chrome or Edge. Verify:

1. It starts on Board 1 of 6.
2. Correct rectangles lock and incorrect rectangles clear.
3. Hint briefly outlines an unsolved rectangle.
4. Restart clears only the current board.
5. Next advances only after all targets are solved.
6. Refresh resumes the highest unlocked board.
7. Board 6 ends with the completion message.

- [ ] **Step 6: Commit**

```powershell
git add index.html tests/test_game.py
git commit -m "feat: add seamless progression through 81"
```
