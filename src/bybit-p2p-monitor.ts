import axios, { Axios } from 'axios';
import process from 'process';
import { Config, Cursor, WatchedCurrency } from './types';
import { Renderable } from './decorators';
import { MappedRenderer } from './renderer';

require('dotenv').config();
const url = 'https://api2.bybit.com/fiat/otc/item/online';

const byBitClient = new Axios({
    baseURL: url,
    ...axios.defaults,
    headers: {
        'Content-Type': 'application/json',
    },
});

export class Monitor {
    [key: string]: any;
    private renderer = new MappedRenderer();
    private fetchInterval: number;

    @Renderable((fetchTimer: number) => Math.floor(fetchTimer / 1000).toString().padStart(2, '0'))
    private fetchTimer: number;

    @Renderable()
    private fetchStatus: string;
    private sleepTime: number;
    private watchedCurrencies: WatchedCurrency[];
    private chatId: string;
    private telegramBotToken: string;
    private botClient: Axios;
    private sleepingCurrenciesCounter: number;
    private startTime: bigint;

    constructor(config: Config) {
        this.fetchInterval = 1000 * 30;
        this.fetchTimer = 0;
        this.fetchStatus = this.fetchStatuses.SLEEPING;
        this.sleepingCurrenciesCounter = 0;
        this.startTime = process.hrtime.bigint();

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
                        size: '10',
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

        // console.log(Object.keys(this))
        // console.log(Object.keys(this.runTime));
        // console.log(Object.getOwnPropertyDescriptor(this.runTime, 'hours')?.get)
    }

    fetchStatuses = {
        SLEEPING: 'SLEEPING',
        FETCHING: 'FETCHING',
    };

    async monitor() {
        setInterval(async () => {
            Time.setDeltaTime();
            this.renderer.renderValue('deltaTime', Time.deltaTime.toString());
            this.updateTimers();
            // this.renderTerminal();
            await this.checkOrders();
        }, 1000);
    }

    async checkOrders() {
        try {
            if (
                this.fetchTimer > 0 ||
                this.fetchStatus === this.fetchStatuses.FETCHING ||
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
                        items[0]?.price >= watchedCurrency.desiredPrice
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

    async fetch(payload: WatchedCurrency['payload']) {
        this.fetchStatus = this.fetchStatuses.FETCHING;
        const { data } = await byBitClient.post('', payload);
        this.fetchStatus = this.fetchStatuses.SLEEPING;
        return data;
    }

    renderTerminal() {
        if (this.shouldUpdateTerminal) {
            // this.renderer.clearLineAfterCursor(this.cursorMap.deltaTime);
            // this.renderer.writeAtCursor(
            //     this.cursorMap.deltaTime,
            //     Time.deltaTime.toString()
            // );
            this.shouldUpdateTerminal = false;
        }
    }

    clearTerminal() {
        process.stdout.write('\x1b[?25l'); // Hide the cursor
        process.stdout.write('\x1b[2J'); // Clear the terminal
        process.stdout.write('\x1b[0;0H'); // Move the cursor to the top-left corner
    }

    @Renderable((value: number) => value.toString().padStart(2, '0'))
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
            // this.setValue(
            //     `${watchedCurrency.currency}SleepTimer`,
            //     watchedCurrency.sleepTimer
            // );
        }
    }

    renderTimers() {
        const { hours, minutes, seconds } = this.runTime;
        // this.writeAtCursor(this.cursorPositions.runTime, this.formatTime(hours, minutes, seconds));
        this.writeAtCursor(
            this.cursorPositions.fetchTimer,
            Math.floor(this.fetchTimer / 1000).toString()
        );
        for (let i = 0; i < this.watchedCurrencies.length; i++) {
            const watchedCurrency = this.watchedCurrencies[i];
            this.writeAtCursor(
                this.cursorPositions[`currency${i}SleepTimer`],
                Math.floor(watchedCurrency.sleepTimer / 1000).toString()
            );
        }
    }

    renderFetchStatus() {
        this.writeAtCursor(this.cursorPositions.fetchStatus, this.fetchStatus);
    }

    formatTime(hours: number | string, minutes: number | string, seconds: number | string) {
        return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    renderFirstTemplateAndMapValues() {
        const cursorMap: Record<string, Cursor> = {};
        const appIsRunningForTxt = 'App is running for: ';
        cursorMap.hours = [appIsRunningForTxt.length, 0];
        cursorMap.minutes = [appIsRunningForTxt.length + 3, 0];
        cursorMap.seconds = [appIsRunningForTxt.length + 6, 0];
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
        cursorMap.fetchTimer = [fetchTimerTxt.length, 1];
        process.stdout.write(
            fetchTimerTxt + Math.floor(this.fetchTimer / 1000) + '\n'
        );
        for (let i = 0; i < this.watchedCurrencies.length; i++) {
            const watchedCurrency = this.watchedCurrencies[i];
            const currencySleepTimerTxt = `${watchedCurrency.currency} sleep timer: `;
            cursorMap[`${watchedCurrency.currency}SleepTimer`] = [
                currencySleepTimerTxt.length,
                i + 2,
            ];
            process.stdout.write(
                currencySleepTimerTxt +
                    Math.floor(watchedCurrency.sleepTimer / 1000) +
                    '\n'
            );
        }
        const fetchStatusTxt = 'Fetch status: ';
        cursorMap.fetchStatus = [
            fetchStatusTxt.length,
            this.watchedCurrencies.length + 2,
        ];
        process.stdout.write(fetchStatusTxt + this.fetchStatus + '\n');
        const deltaTimeTxt = 'DeltaTime: ';
        cursorMap.deltaTime = [
            deltaTimeTxt.length,
            this.watchedCurrencies.length + 3,
        ];
        process.stdout.write(deltaTimeTxt + Time.deltaTime + '\n');
        this.renderer.addValuesToRender(cursorMap);
    }

    async startApp() {
        this.startTime = process.hrtime.bigint();
        this.clearTerminal();
        this.renderFirstTemplateAndMapValues();
        await this.monitor();
    }

    getAppRunTime() {
        const diff = process.hrtime.bigint() - this.startTime;
        const minutes = parseInt(diff / BigInt(60000000000) as any);
        return minutes;
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

class Time {
    static deltaTime = 0;
    static lastTickTime = performance.now();

    static setDeltaTime() {
        const tickTime = performance.now();
        Time.deltaTime = tickTime - Time.lastTickTime;
        Time.lastTickTime = tickTime;
    }
}

function autoBind(target: any) {
    const prototype = Object.getPrototypeOf(target);
    for (const key of Reflect.ownKeys(prototype)) {
        if (key === 'constructor') {
            continue;
        }

        const descriptor = Reflect.getOwnPropertyDescriptor(prototype, key);
        if (descriptor && typeof descriptor.value === 'function') {
            target[key] = target[key].bind(target);
        }
    }
}

const config = require('../config.json');
const monitor = new Monitor(config);

monitor.startApp();
