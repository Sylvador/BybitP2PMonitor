import axios, { Axios } from 'axios';
import process from 'process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const url = 'https://api2.bybit.com/fiat/otc/item/online';

const byBitClient = new Axios({
    baseURL: url,
    ...axios.defaults,
    headers: {
        'Content-Type': 'application/json',
    },
})


class Monitor {
    constructor(config) {
        this.fetchInterval = 1000 * 30;
        this.fetchTimer = 0;
        this.fetchStatus = this.fetchStatuses.SLEEPING;

        this.sleepTime = 1000 * 60 * config.sleepTimeAfterFindingDesiredOrder;
        this.watchedCurrencies = config.watchedCurrencies.map(
            watchedCurrency => Object.assign(watchedCurrency, {
                sleepTimer: 0,
                payload: {
                    "userId": 110341422,
                    "tokenId": "USDT",
                    "currencyId": watchedCurrency.currency,
                    "payment": ["359"],
                    "side": "0",
                    "size": "10",
                    "page": "1",
                    "amount": "",
                    "authMaker": false,
                    "canTrade": false
                }
            }));

        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

        this.botClient = new Axios({
            baseURL: `https://api.telegram.org/bot${this.telegramBotToken}`,
            ...axios.defaults,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        autoBind(this);
    }

    fetchStatuses = {
        SLEEPING: 'SLEEPING',
        FETCHING: 'FETCHING',
    }

    async monitor() {
        setInterval(async () => {
            Time.setDeltaTime();
            this.updateTimers();
            this.renderTerminal();
            await this.checkOrders();
        }, 1000);
    }

    async checkOrders() {
        try {
            if (this.fetchTimer > 0 || this.fetchStatus === this.fetchStatuses.FETCHING || this.watchedCurrencies.every(wc => wc.sleepTimer > 0)) return;

            this.fetchTimer = this.fetchInterval;

            for (const watchedCurrency of this.watchedCurrencies) {
                if (watchedCurrency.sleepTimer === 0) {
                    console.log('Checking order for: ', watchedCurrency.currency)
                    const data = await this.fetch(watchedCurrency.payload);
                    const { result: { items } } = data;
                    const desiredOrder = items[0]?.price >= watchedCurrency.desiredPrice ? items[0] : null;
                    if (desiredOrder) {
                        await this.notify(desiredOrder);
                        watchedCurrency.sleepTimer = this.sleepTime
                        this.sleepingCurrenciesCounter++;
                    }
                }
            }
        } catch (error) {
            await this.notifyAboutError(error);
            throw error;
        }
    }

    async fetch(payload) {
        this.fetchStatus = this.fetchStatuses.FETCHING;
        const { data } = await byBitClient.post('', payload);
        this.fetchStatus = this.fetchStatuses.SLEEPING;
        return data;
    }

    renderTerminal() {
        if (this.shouldUpdateTerminal) {
            this.clearTerminal();
            this.renderTimers();
            this.renderFetchStatus();
            console.log('DeltaTime: ', Time.deltaTime)
            this.shouldUpdateTerminal = false;
        }
    }

    clearTerminal() {
        process.stdout.write('\u001B[2J\u001B[0;0f');
    }

    runTime = {
        milliseconds: 0,
        seconds: 0,
        minutes: 0,
        hours: 0,
    }
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
            watchedCurrency.sleepTimer = Math.max(watchedCurrency.sleepTimer - Time.deltaTime, 0);
        }
    }

    renderTimers() {
        const { hours, minutes, seconds } = this.runTime;
        console.log(`App is running for ${this.formatTime(hours, minutes, seconds)}`);
        console.log(`fetchTimer: ${Math.floor(this.fetchTimer / 1000)}`);
        for (const watchedCurrency of this.watchedCurrencies) {
            console.log(`${watchedCurrency.currency} sleepTimer: ${Math.floor(watchedCurrency.sleepTimer / 1000)}`);
        }
    }

    renderFetchStatus() {
        console.log(`Fetch status: ${this.fetchStatus}`);
    }

    formatTime(hours, minutes, seconds) {
        return `${hours.toString().padStart(2, 0)}:${minutes.toString().padStart(2, 0)}:${seconds.toString().padStart(2, 0)}`;
    }

    async startApp() {
        this.startTime = process.hrtime.bigint();
        await this.monitor();
    }

    getAppRunTime() {
        const diff = process.hrtime.bigint() - this.startTime;
        const minutes = parseInt(diff / BigInt(60000000000));
        return minutes;
    }

    async notifyAboutError(error) {
        await this.botClient.post(`/sendMessage`, { chat_id: this.chatId, text: error.message });
    }

    async notify(order) {
        const { id, price, minAmount, maxAmount } = order;
        const message = `Price: ${price}, Min: ${minAmount}, Max: ${maxAmount}, ID: ${id}`;
        await this.botClient.post(`/sendMessage`, { chat_id: this.chatId, text: message });
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

function autoBind(target) {
    const prototype = Object.getPrototypeOf(target)
    for (const key of Reflect.ownKeys(prototype)) {
        if (key === 'constructor') {
            continue
        }

        const descriptor = Reflect.getOwnPropertyDescriptor(prototype, key)
        if (descriptor && typeof descriptor.value === 'function') {
            target[key] = target[key].bind(target)
        }
    }
}

const config = require('./config.json');
const monitor = new Monitor(config);

monitor.startApp();
