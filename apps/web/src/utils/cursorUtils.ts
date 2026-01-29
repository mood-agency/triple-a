/**
 * Calculates the cursor position based on click coordinates using canvas for measurement.
 * This mimics the behavior of the EditableTitle component which the user confirmed works well.
 * 
 * @param text The text content to measure.
 * @param fontStyle One or more font properties strings (e.g. "bold 16px sans-serif").
 * @param clickX The X coordinate of the click relative to the text start.
 * @returns The character index.
 */
export function getCursorPosition(text: string, fontStyle: string, clickX: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx || !text) return 0;

    ctx.font = fontStyle;

    // Quick check if click is past the end
    if (clickX >= ctx.measureText(text).width) {
        return text.length;
    }

    if (clickX <= 0) {
        return 0;
    }

    // Linear scan to find the best break point
    // We want the point where the cursor would naturally fall (between characters)
    for (let i = 1; i <= text.length; i++) {
        const width = ctx.measureText(text.substring(0, i)).width;
        if (width >= clickX) {
            // Check if we are closer to i-1 or i
            const prevWidth = ctx.measureText(text.substring(0, i - 1)).width;
            const distToPrev = clickX - prevWidth;
            const distToNext = width - clickX;

            return distToPrev <= distToNext ? i - 1 : i;
        }
    }

    return text.length;
}

/**
 * Helper to extract font string from computed style
 */
export function getFontString(style: CSSStyleDeclaration): string {
    return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}
