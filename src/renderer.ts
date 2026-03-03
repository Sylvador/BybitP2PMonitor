import { Cursor, CursorMap } from './types';

export class MappedRenderer {
    private cursorMap: CursorMap = {};

    addRenderable(
        key: string,
        value: string,
        displayText?: string,
        cursorOverride?: Cursor,
    ) {
        const cursor: Cursor = cursorOverride
            ? cursorOverride
            : [displayText?.length ?? 0, Object.keys(this.cursorMap).length];
        this.cursorMap[key] = {
            cursor,
            lastLength: value.length,
        };

        if (displayText) {
            this.writeAtCursor([0, cursor[1]], displayText);
        }
        this.writeAtCursor(cursor, value);
    }

    updateCursorMap(cursorMap: CursorMap) {
        for (const key in cursorMap) {
            this.cursorMap[key] = {
                cursor: [cursorMap[key].cursor[0], cursorMap[key].cursor[1]],
                lastLength: cursorMap[key].lastLength,
            };
        }
    }

    renderValue(key: string, value: string) {
        value = value.padEnd(this.cursorMap[key].lastLength, ' ');
        this.cursorMap[key].lastLength = value.length;
        this.writeAtCursor(this.cursorMap[key].cursor, value);
    }

    clearLineAfterCursor(cursor: Cursor) {
        process.stdout.cursorTo(cursor[0], cursor[1]);
        process.stdout.clearLine(1);
    }

    writeAtCursor(cursor: Cursor, text: string) {
        process.stdout.cursorTo(cursor[0], cursor[1]);
        process.stdout.write(text);
    }
}
