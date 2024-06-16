export type WatchedCurrency = {
    currency: string;
    desiredPrice: number;
    payload: {
        userId: number;
        tokenId: 'USDT';
        currencyId: string;
        payment: ['359'],
        side: '0',
        size: '10',
        page: '1',
        amount: '',
        authMaker: false,
        canTrade: false,
    };
    sleepTimer: number;
}

export type Config = {
    sleepTimeAfterFindingDesiredOrder: number;
    watchedCurrencies: { currency: string; desiredPrice: number }[];
};
export type Cursor = [row: number, column: number];