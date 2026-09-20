# Multiplication Rectangles Through 81

## Goal

Extend the current rectangle game into one seamless six-board experience that progresses from products up to 16 through products up to 81.

## Experience

- The child starts immediately on Board 1 of 6.
- Boards use square grids sized 4×4, 5×5, 6×6, 7×7, 8×8, and 9×9.
- Each board contains three or four predefined multiplication products and has a known complete rectangular tiling.
- Dragging shows the selected dimensions and product.
- A correct rectangle remains colored and celebrates with stars.
- An incorrect rectangle disappears gently without a red error state.
- Completing a board enables **Next**. Next opens the following board without a menu or page reload.
- Board 6 completion shows a simple completion message.
- **Restart** clears only the current board.
- **Hint** briefly highlights one unsolved target rectangle.
- A small “Board N of 6” label communicates progress without scores or rewards.

## Progress

The highest unlocked board is saved in `localStorage`. Returning players resume at that board. If storage is unavailable, the game still works for the current session.

## Implementation

Keep the app as one self-contained `index.html` with no dependencies, backend, build step, authentication, or Telegram-specific code. Store the six predefined board definitions as plain JavaScript data and reuse the existing pointer-based drag interaction.

Each target definition includes its number, label position, intended rectangle, and color. Rectangle validation requires:

1. Exactly one unsolved number inside the selection.
2. Selection area equals that number.
3. Selection does not overlap a solved rectangle.

## Verification

- Confirm every predefined board tiles its full grid without overlaps or gaps.
- Confirm correct and incorrect selections behave as expected.
- Confirm Next stays disabled until all targets are solved.
- Confirm Hint identifies an unsolved target.
- Confirm Restart and saved progress work.
- Confirm mouse and pointer interaction remain supported.
