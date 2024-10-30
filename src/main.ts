import axios, { Axios } from 'npm:axios';
import process from 'node:process';
import {
	Config,
	CursorMap,
	FetchStatus,
	IHttpResult,
	IWatchedCurrency,
	OrdersResponse,
} from './types.ts';
import { Renderable } from './decorators.ts';
import { MappedRenderer } from './renderer.ts';
import { autoBind, makeRendereableProperty } from './utils.ts';
import { Time } from './time.ts';

import 'dotenv/config';

const url = 'https://api2.bybit.com/fiat/otc/item/online';

const byBitClient = new Axios({
	baseURL: url,
	...axios.defaults,
	headers: {
		'Content-Type': 'application/json',
	},
});

export class Monitor {
	private renderer = new MappedRenderer();
	private fetchInterval: number;

	@Renderable({
		transformer: (fetchTimer: number) =>
			Math.floor(fetchTimer / 1000)
				.toString()
				.padStart(2, '0'),
	})
	private fetchTimer: number = 0;

	@Renderable()
	private fetchStatus: FetchStatus = FetchStatus.SLEEPING;
	private sleepTime: number;
	private watchedCurrencies: IWatchedCurrency[];
	private chatId: string;
	private telegramBotToken: string;
	private botClient: Axios;
	private sleepingCurrenciesCounter: number;

	constructor(config: Config) {
		this.fetchInterval = 1000 * 30;
		this.sleepingCurrenciesCounter = 0;

		this.sleepTime = 1000 * 60 * config.sleepTimeAfterFindingDesiredOrder;
		this.watchedCurrencies = config.watchedCurrencies.map((
			watchedCurrency,
		) => Object.assign(watchedCurrency, {
			sleepTimer: 0,
			payload: {
				userId: 110341422,
				tokenId: 'USDT',
				currencyId: watchedCurrency.currency,
				payment: ['359'],
				side: '0',
				size: '1',
				page: '1',
				amount: '',
				authMaker: false,
				canTrade: false,
			} as any,
		}));

		this.chatId = process.env.TELEGRAM_CHAT_ID as string;
		this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN as string;

		this.botClient = new Axios({
			baseURL: `https://api.telegram.org/bot${this.telegramBotToken}`,
			...axios.defaults,
			headers: {
				'Content-Type': 'application/json',
			},
		});
		autoBind(this);
	}

	monitor() {
		setInterval(async () => {
			Time.setDeltaTime();
			this.renderer.renderValue('deltaTime', Time.deltaTime.toFixed(0));
			this.updateTimers();
			await this.checkOrders();
		}, 1000);
	}

	async checkOrders() {
		try {
			if (
				this.fetchTimer > 0 ||
				this.fetchStatus === FetchStatus.FETCHING ||
				this.watchedCurrencies.every((wc) => wc.sleepTimer > 0)
			) {
				return;
			}

			this.fetchTimer = this.fetchInterval;

			for (const watchedCurrency of this.watchedCurrencies) {
				if (watchedCurrency.sleepTimer === 0) {
					const data = await this.fetch(watchedCurrency.payload)
						.catch(
							(reason) => {
								this.notifyAboutError(reason);
							},
						);
					if (!data) {
						continue;
					}
					const {
						result: { items },
					} = data;
					const topOrder = items[0];

					const renderKey = `${watchedCurrency.currency}.bestOrder`;
					if (topOrder) {
						this.renderer.renderValue(
							renderKey,
							`{ price: ${topOrder.price}; minAmount: ${topOrder.minAmount}; maxAmount: ${topOrder.maxAmount} }`,
						);
					} else {
						this.renderer.renderValue(
							renderKey,
							`{ no available orders }`,
						);
					}

					const desiredOrder =
						+topOrder?.price >= watchedCurrency.desiredPrice
							? topOrder
							: null;
					if (desiredOrder) {
						await this.notify(desiredOrder);
						watchedCurrency.sleepTimer = this.sleepTime;
						this.sleepingCurrenciesCounter++;
					}
				}
			}
		} catch (error) {
			await this.notifyAboutError(error);
			throw error;
		}
	}

	async fetch(
		payload: IWatchedCurrency['payload'],
	): Promise<OrdersResponse | undefined> {
		this.fetchStatus = FetchStatus.FETCHING;
		let orders: OrdersResponse | undefined;
		try {
			const request = () => byBitClient.post('', payload);
			const { data } = (await this.retry(
				request,
			)) as IHttpResult<OrdersResponse>;
			orders = data;
		} catch {
			//TODO render error
		}
		this.fetchStatus = FetchStatus.SLEEPING;
		return orders;
	}

	clearTerminal() {
		process.stdout.write('\x1b[?25l'); // Hide the cursor
		process.stdout.write('\x1b[2J'); // Clear the terminal
		process.stdout.write('\x1b[0;0H'); // Move the cursor to the top-left corner
	}

	@Renderable({
		transformer: (value: number) => value.toString().padStart(2, '0'),
		exclude: ['milliseconds'],
	})
	runTime = {
		milliseconds: 0,
		seconds: 0,
		minutes: 0,
		hours: 0,
	};
	shouldUpdateTerminal = true;

	updateTimers() {
		this.runTime.milliseconds += Time.deltaTime;
		if (this.runTime.milliseconds >= 1000) {
			this.shouldUpdateTerminal = true;
			this.runTime.seconds += 1;
			this.runTime.milliseconds = 0;
		}

		if (this.runTime.seconds >= 60) {
			this.runTime.minutes += 1;
			this.runTime.seconds = 0;
		}
		if (this.runTime.minutes >= 60) {
			this.runTime.hours += 1;
			this.runTime.minutes = 0;
		}
		this.fetchTimer = Math.max(this.fetchTimer - Time.deltaTime, 0);
		for (const watchedCurrency of this.watchedCurrencies) {
			watchedCurrency.sleepTimer = Math.max(
				watchedCurrency.sleepTimer - Time.deltaTime,
				0,
			);
		}
	}

	formatTime(
		hours: number | string,
		minutes: number | string,
		seconds: number | string,
	) {
		return `${hours.toString().padStart(2, '0')}:${
			minutes.toString().padStart(2, '0')
		}:${seconds.toString().padStart(2, '0')}`;
	}

	renderTemplateAndMapRenderValues() {
		const cursorMap: CursorMap = {};
		const appIsRunningForTxt = 'App is running for: ';
		let cursorRow = 0;
		cursorMap.hours = {
			cursor: [appIsRunningForTxt.length, cursorRow],
			lastLength: 2,
		};
		cursorMap.minutes = {
			cursor: [appIsRunningForTxt.length + 3, cursorRow],
			lastLength: 2,
		};
		cursorMap.seconds = {
			cursor: [appIsRunningForTxt.length + 6, cursorRow],
			lastLength: 2,
		};
		process.stdout.write(
			appIsRunningForTxt +
				this.formatTime(
					this.runTime.hours,
					this.runTime.minutes,
					this.runTime.seconds,
				) +
				'\n',
		);
		++cursorRow;
		const fetchTimerTxt = 'Fetch timer: ';
		cursorMap.fetchTimer = {
			cursor: [fetchTimerTxt.length, cursorRow],
			lastLength: 2,
		};
		process.stdout.write(
			fetchTimerTxt + Math.floor(this.fetchTimer / 1000) + '\n',
		);

		++cursorRow;
		for (
			let i = 0;
			i < this.watchedCurrencies.length;
			++i, cursorRow += 2
		) {
			const watchedCurrency = this.watchedCurrencies[i];
			const currencySleepTimerTxt =
				`${watchedCurrency.currency} sleep timer: `;
			const renderKeyPrefix = watchedCurrency.currency;
			const renderKey = `${renderKeyPrefix}.sleepTimer`;
			cursorMap[renderKey] = {
				cursor: [currencySleepTimerTxt.length, cursorRow],
				lastLength: 4,
			};
			makeRendereableProperty(this.renderer, {
				key: 'sleepTimer',
				target: watchedCurrency,
				renderKeyPrefix,
				transformer: (value: number) => (value / 1000).toFixed(0),
			});
			process.stdout.write(
				currencySleepTimerTxt +
					Math.floor(watchedCurrency.sleepTimer / 1000) +
					'\n',
			);

			const lastBestCurrencyOrderTxt =
				`Last best order for ${watchedCurrency.currency}: `;
			process.stdout.write(lastBestCurrencyOrderTxt + '\n');
			cursorMap[renderKeyPrefix + '.bestOrder'] = {
				cursor: [lastBestCurrencyOrderTxt.length, cursorRow + 1],
				lastLength: 8,
			};
		}
		const fetchStatusTxt = 'Fetch status: ';
		cursorMap.fetchStatus = {
			cursor: [fetchStatusTxt.length, cursorRow],
			lastLength: FetchStatus.FETCHING.length,
		};
		++cursorRow;
		process.stdout.write(fetchStatusTxt + this.fetchStatus + '\n');
		const deltaTimeTxt = 'DeltaTime: ';
		cursorMap.deltaTime = {
			cursor: [deltaTimeTxt.length, cursorRow],
			lastLength: 4,
		};
		process.stdout.write(deltaTimeTxt + Time.deltaTime + '\n');
		this.renderer.updateCursorMap(cursorMap);
	}

	startApp() {
		this.clearTerminal();
		this.renderTemplateAndMapRenderValues();
		this.monitor();
	}

	notifyAboutError(error: any) {
		const request = () =>
			this.botClient.post(`/sendMessage`, {
				chat_id: this.chatId,
				text: error.message,
			});
		return this.retry(request);
	}

	async retry(request: Function) {
		let retries = 3;
		while (retries > 0) {
			--retries;
			const res = await request();
			if (res.status === 200) return res;
		}
		//TODO render error
	}

	notify(order: any) {
		const { id, price, minAmount, maxAmount, currencyId } = order;
		const message =
			`Currency: ${currencyId}, Price: ${price}, Min: ${minAmount}, Max: ${maxAmount}, ID: ${id}`;
		const request = () =>
			this.botClient.post(`/sendMessage`, {
				chat_id: this.chatId,
				text: message,
			});
		return this.retry(request);
	}
}

import config from '../config.json' with { type: 'json' };

setTimeout(() => {
	const monitor = new Monitor(config);
	monitor.startApp();
}, 5000);
