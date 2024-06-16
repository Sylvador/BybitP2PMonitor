import { Cursor } from './types';

export class MappedRenderer {
    private cursorMap: { [key: string]: Cursor } = {};

    addValuesToRender(values: { [key: string]: Cursor }) {
        for (const key in values) {
            this.cursorMap[key] = values[key];
        }
    }

    renderValue(key: string, value: string) {
        this.writeAtCursor(this.cursorMap[key], value);
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
