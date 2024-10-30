import { Cursor, CursorMap } from './types.ts';
import process from 'node:process';

export class MappedRenderer {
	private cursorMap: CursorMap = {};

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
