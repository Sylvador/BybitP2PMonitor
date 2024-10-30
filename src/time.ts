export class Time {
	static deltaTime = 0;
	static lastTickTime = performance.now();

	static setDeltaTime() {
		const tickTime = performance.now();
		Time.deltaTime = tickTime - Time.lastTickTime;
		Time.lastTickTime = tickTime;
	}
}
