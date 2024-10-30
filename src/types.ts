export type Payload = {
	userId: number;
	tokenId: 'USDT';
	currencyId: string;
	payment: ['359'];
	side: '0';
	size: '1';
	page: '1';
	amount: '';
	authMaker: false;
	canTrade: false;
};

export interface IWatchedCurrency {
	currency: string;
	desiredPrice: number;
	payload: Payload;
	sleepTimer: number;
}

export interface IHttpResult<T> {
	data: T;
	status: number;
	statusText: string;
	headers: any;
	config: any;
	request: any;
}

export type OrdersResponse = {
	ret_code: number;
	ret_msg: string;
	result: {
		count: number;
		items: Array<{
			id: string;
			accountId: string;
			userId: string;
			nickName: string;
			tokenId: 'USDT';
			tokenName: string;
			currencyId: string;
			side: number;
			priceType: number;
			price: string;
			premium: string;
			lastQuantity: string;
			quantity: string;
			frozenQuantity: string;
			executedQuantity: string;
			minAmount: string;
			maxAmount: string;
			remark: string;
			status: number;
			createDate: string;
			payments: ['359'];
			orderNum: number;
			finishNum: number;
			recentOrderNum: number;
			recentExecuteRate: number;
			fee: string;
			isOnline: boolean;
			lastLogoutTime: string;
			blocked: string;
			makerContact: boolean;
			symbolInfo: {
				id: string;
				exchangeId: string;
				orgId: string;
				tokenId: 'USDT';
				currencyId: string;
				status: number;
				lowerLimitAlarm: number;
				upperLimitAlarm: number;
				itemDownRange: string;
				itemUpRange: string;
				currencyMinQuote: string;
				currencyMaxQuote: string;
				currencyLowerMaxQuote: string;
				tokenMinQuote: string;
				tokenMaxQuote: string;
				kycCurrencyLimit: string;
				itemSideLimit: number;
				buyFeeRate: string;
				sellFeeRate: string;
				orderAutoCancelMinute: number;
				orderFinishMinute: number;
				tradeSide: number;
				currency: {
					id: string;
					exchangeId: string;
					orgId: string;
					currencyId: string;
					scale: number;
				};
				token: {
					id: string;
					exchangeId: string;
					orgId: string;
					tokenId: string;
					scale: number;
					sequence: number;
				};
			};
			tradingPreferenceSet: {
				hasUnPostAd: number;
				isKyc: number;
				isEmail: number;
				isMobile: number;
				hasRegisterTime: number;
				registerTimeThreshold: number;
				orderFinishNumberDay30: number;
				completeRateDay30: string;
				nationalLimit: string;
				hasOrderFinishNumberDay30: number;
				hasCompleteRateDay30: number;
				hasNationalLimit: number;
			};
			version: number;
			authStatus: number;
			recommend: boolean;
			recommendTag: string;
		}>;
	};
	ext_code: string;
	ext_info: null;
	time_now: string;
};

export type Config = {
	sleepTimeAfterFindingDesiredOrder: number;
	watchedCurrencies: { currency: string; desiredPrice: number }[];
};
export type Cursor = [row: number, column: number];
export type CursorMap = {
	[key: string]: { cursor: Cursor; lastLength: number };
};

export type MakeRendereableProperty =
	typeof import('./utils.ts').makeRendereableProperty;

export const FetchStatus = {
	SLEEPING: 'SLEEPING',
	FETCHING: 'FETCHING',
} as const;
export type FetchStatus = (typeof FetchStatus)[keyof typeof FetchStatus];
