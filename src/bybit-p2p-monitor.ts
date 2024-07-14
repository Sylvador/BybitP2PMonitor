import axios, { Axios } from 'axios';
import process from 'process';
import {
    Config,
    Cursor,
    CursorMap,
    IHttpResult,
    IWatchedCurrency,
    OrdersResponse,
} from './types';
import { Renderable } from './decorators';
import { MappedRenderer } from './renderer';
import { autoBind, makeRendereableProperty } from './utils';
import { Time } from './time';

require('dotenv').config();
const url = 'https://api2.bybit.com/fiat/otc/item/online';

const byBitClient = new Axios({
    baseURL: url,
    ...axios.defaults,
    headers: {
        'Content-Type': 'application/json',
    },
});

const fetchStatuses = {
    SLEEPING: 'SLEEPING',
    FETCHING: 'FETCHING',
} as const;
type FetchStatus = (typeof fetchStatuses)[keyof typeof fetchStatuses];

export class Monitor {
    private renderer = new MappedRenderer();
    private fetchInterval: number;

    @Renderable({
        transformer: (fetchTimer: number) =>
        Math.floor(fetchTimer / 1000)
            .toString()
            .padStart(2, '0')
    })
    private fetchTimer: number = 0;

    @Renderable()
    private fetchStatus: FetchStatus = fetchStatuses.SLEEPING;
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
        this.watchedCurrencies = config.watchedCurrencies.map(
            (watchedCurrency) =>
                Object.assign(watchedCurrency, {
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
                })
        );

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

    async monitor() {
        setInterval(async () => {
            Time.setDeltaTime();
            this.renderer.renderValue('deltaTime', Time.deltaTime.toFixed(0));
            this.updateTimers();
            // this.renderTerminal();
            await this.checkOrders();
        }, 1000);
    }

    async checkOrders() {
        try {
            if (
                this.fetchTimer > 0 ||
                this.fetchStatus === fetchStatuses.FETCHING ||
                this.watchedCurrencies.every((wc) => wc.sleepTimer > 0)
            )
                return;

            this.fetchTimer = this.fetchInterval;

            for (const watchedCurrency of this.watchedCurrencies) {
                if (watchedCurrency.sleepTimer === 0) {
                    const data = await this.fetch(watchedCurrency.payload);
                    const {
                        result: { items },
                    } = data;
                    const desiredOrder =
                        +items[0]?.price >= watchedCurrency.desiredPrice
                            ? items[0]
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

    async fetch(payload: IWatchedCurrency['payload']): Promise<OrdersResponse> {
        this.fetchStatus = fetchStatuses.FETCHING;
        const { data } = (await byBitClient.post(
            '',
            payload
        )) as IHttpResult<OrdersResponse>;
        this.fetchStatus = fetchStatuses.SLEEPING;
        return data;
    }

    clearTerminal() {
        process.stdout.write('\x1b[?25l'); // Hide the cursor
        process.stdout.write('\x1b[2J'); // Clear the terminal
        process.stdout.write('\x1b[0;0H'); // Move the cursor to the top-left corner
    }

    @Renderable({
        transformer: (value: number) => value.toString().padStart(2, '0'),
        exclude: ['milliseconds']
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
                0
            );
        }
    }

    formatTime(
        hours: number | string,
        minutes: number | string,
        seconds: number | string
    ) {
        return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    renderTemplateAndMapRenderValues() {
        const cursorMap: CursorMap = {};
        const appIsRunningForTxt = 'App is running for: ';
        cursorMap.hours = { cursor: [appIsRunningForTxt.length, 0], lastLength: 2 };
        cursorMap.minutes = { cursor: [appIsRunningForTxt.length + 3, 0], lastLength: 2 };
        cursorMap.seconds = { cursor: [appIsRunningForTxt.length + 6, 0], lastLength: 2 };
        process.stdout.write(
            appIsRunningForTxt +
                this.formatTime(
                    this.runTime.hours,
                    this.runTime.minutes,
                    this.runTime.seconds
                ) +
                '\n'
        );
        const fetchTimerTxt = 'Fetch timer: ';
        cursorMap.fetchTimer = { cursor: [fetchTimerTxt.length, 1], lastLength: 2 };
        process.stdout.write(
            fetchTimerTxt + Math.floor(this.fetchTimer / 1000) + '\n'
        );
        for (let i = 0; i < this.watchedCurrencies.length; i++) {
            const watchedCurrency = this.watchedCurrencies[i];
            const currencySleepTimerTxt = `${watchedCurrency.currency} sleep timer: `;
            const renderKeyPrefix = watchedCurrency.currency;
            const renderKey = `${renderKeyPrefix}.sleepTimer`
            cursorMap[renderKey] = { cursor: [
                currencySleepTimerTxt.length,
                i + 2,
            ], lastLength: 4 };
            makeRendereableProperty(this.renderer, {
                key: 'sleepTimer',
                target: watchedCurrency,
                renderKeyPrefix,
                transformer: (value: number) => (value/1000).toFixed(0),
            });
            process.stdout.write(
                currencySleepTimerTxt +
                    Math.floor(watchedCurrency.sleepTimer / 1000) +
                    '\n'
            );
        }
        const fetchStatusTxt = 'Fetch status: ';
        cursorMap.fetchStatus = {cursor: [
            fetchStatusTxt.length,
            this.watchedCurrencies.length + 2,
        ], lastLength: fetchStatuses.FETCHING.length };
        process.stdout.write(fetchStatusTxt + this.fetchStatus + '\n');
        const deltaTimeTxt = 'DeltaTime: ';
        cursorMap.deltaTime = { cursor: [
            deltaTimeTxt.length,
            this.watchedCurrencies.length + 3,
        ], lastLength: 4 };
        process.stdout.write(deltaTimeTxt + Time.deltaTime + '\n');
        this.renderer.updateCursorMap(cursorMap);
    }

    async startApp() {
        this.clearTerminal();
        this.renderTemplateAndMapRenderValues();
        await this.monitor();
    }

    async notifyAboutError(error: any) {
        await this.botClient.post(`/sendMessage`, {
            chat_id: this.chatId,
            text: error.message,
        });
    }

    async notify(order: any) {
        const { id, price, minAmount, maxAmount, currencyId } = order;
        const message = `Currency: ${currencyId}, Price: ${price}, Min: ${minAmount}, Max: ${maxAmount}, ID: ${id}`;
        await this.botClient.post(`/sendMessage`, {
            chat_id: this.chatId,
            text: message,
        });
    }
}

const config = require('../config.json');
const monitor = new Monitor(config);

monitor.startApp();
