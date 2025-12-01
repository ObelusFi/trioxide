<script lang="ts" module>
	//
	type WeekInfo = number;
	/* @generated cf: formatjs/packages/intl-locale/week-data.generated.ts */
	const weekData: Record<string, WeekInfo> = JSON.parse(
		`{"001":1167,"AC":1167,"AD":1467,"AE":1167,"AF":6145,"AG":7167,"AI":1167,"AL":1167,"AM":1167,"AO":1167,"AQ":1167,"AR":1167,"AS":7167,"AT":1467,"AU":1167,"AW":1167,"AX":1467,"AZ":1167,"BA":1167,"BB":1167,"BD":7167,"BE":1467,"BF":1167,"BG":1467,"BH":6156,"BI":1167,"BJ":1167,"BL":1167,"BM":1167,"BN":1167,"BO":1167,"BQ":1167,"BR":7167,"BS":7167,"BT":7167,"BV":1167,"BW":7167,"BY":1167,"BZ":7167,"CA":7167,"CC":1167,"CD":1167,"CF":1167,"CG":1167,"CH":1467,"CI":1167,"CK":1167,"CL":1167,"CM":1167,"CN":1167,"CO":7167,"CP":1167,"CQ":1167,"CR":1167,"CU":1167,"CV":1167,"CW":1167,"CX":1167,"CY":1167,"CZ":1467,"DE":1467,"DG":1167,"DJ":6167,"DK":1467,"DM":7167,"DO":7167,"DZ":6156,"EA":1167,"EC":1167,"EE":1467,"EG":6156,"EH":1167,"ER":1167,"ES":1467,"ET":7167,"FI":1467,"FJ":1467,"FK":1167,"FM":1167,"FO":1467,"FR":1467,"GA":1167,"GB":1467,"GD":1167,"GE":1167,"GF":1467,"GG":1467,"GH":1167,"GI":1467,"GL":1167,"GM":1167,"GN":1167,"GP":1467,"GQ":1167,"GR":1467,"GS":1167,"GT":7167,"GU":7167,"GW":1167,"GY":1167,"HK":7167,"HM":1167,"HN":7167,"HR":1167,"HT":1167,"HU":1467,"IC":1167,"ID":7167,"IE":1467,"IL":7156,"IM":1467,"IN":717,"IO":1167,"IQ":6156,"IR":615,"IS":1467,"IT":1467,"JE":1467,"JM":7167,"JO":6156,"JP":7167,"KE":7167,"KG":1167,"KH":7167,"KI":1167,"KM":1167,"KN":1167,"KP":1167,"KR":7167,"KW":6156,"KY":1167,"KZ":1167,"LA":7167,"LB":1167,"LC":1167,"LI":1467,"LK":1167,"LR":1167,"LS":1167,"LT":1467,"LU":1467,"LV":1167,"LY":6156,"MA":1167,"MC":1467,"MD":1167,"ME":1167,"MF":1167,"MG":1167,"MH":7167,"MK":1167,"ML":1167,"MM":7167,"MN":1167,"MO":7167,"MP":1167,"MQ":1467,"MR":1167,"MS":1167,"MT":7167,"MU":1167,"MV":5167,"MW":1167,"MX":7167,"MY":1167,"MZ":7167,"NA":1167,"NC":1167,"NE":1167,"NF":1167,"NG":1167,"NI":7167,"NL":1467,"NO":1467,"NP":7167,"NR":1167,"NU":1167,"NZ":1167,"OM":6156,"PA":7167,"PE":7167,"PF":1167,"PG":1167,"PH":7167,"PK":7167,"PL":1467,"PM":1167,"PN":1167,"PR":7167,"PS":1167,"PT":7467,"PW":1167,"PY":7167,"QA":6156,"RE":1467,"RO":1167,"RS":1167,"RU":1467,"RW":1167,"SA":7156,"SB":1167,"SC":1167,"SD":6156,"SE":1467,"SG":7167,"SH":1167,"SI":1167,"SJ":1467,"SK":1467,"SL":1167,"SM":1467,"SN":1167,"SO":1167,"SR":1167,"SS":1167,"ST":1167,"SV":7167,"SX":1167,"SY":6156,"SZ":1167,"TA":1167,"TC":1167,"TD":1167,"TF":1167,"TG":1167,"TH":7167,"TJ":1167,"TK":1167,"TL":1167,"TM":1167,"TN":1167,"TO":1167,"TR":1167,"TT":7167,"TV":1167,"TW":7167,"TZ":1167,"UA":1167,"UG":117,"UM":7167,"US":7167,"UY":1167,"UZ":1167,"VA":1467,"VC":1167,"VE":7167,"VG":1167,"VI":7167,"VN":1167,"VU":1167,"WF":1167,"WS":7167,"XK":1167,"YE":7156,"YT":1167,"ZA":7167,"ZM":1167,"ZW":7167,"ZZ":1167}`
	);

	const rtl: string[] = JSON.parse(
		`[ "apc",  "ar",  "ar-AE",  "ar-BH",  "ar-DJ",  "ar-DZ",  "ar-EG",  "ar-EH",  "ar-ER",  "ar-IL",  "ar-IQ",  "ar-JO",  "ar-KM",  "ar-KW",  "ar-LB",  "ar-LY",  "ar-MA",  "ar-MR",  "ar-OM",  "ar-PS",  "ar-QA",  "ar-SA",  "ar-SD",  "ar-SO",  "ar-SS",  "ar-SY",  "ar-TD",  "ar-TN",  "ar-YE",  "az-Arab",  "az-Arab-IQ",  "az-Arab-TR",  "bal",  "bal-Arab",  "bgn",  "bgn-AE",  "bgn-AF",  "bgn-IR",  "bgn-OM",  "bm-Nkoo",  "ckb",  "ckb-IR",  "dv",  "fa",  "fa-AF",  "ff-Adlm",  "ff-Adlm-BF",  "ff-Adlm-CM",  "ff-Adlm-GH",  "ff-Adlm-GM",  "ff-Adlm-GW",  "ff-Adlm-LR",  "ff-Adlm-MR",  "ff-Adlm-NE",  "ff-Adlm-NG",  "ff-Adlm-SL",  "ff-Adlm-SN",  "ha-Arab",  "ha-Arab-SD",  "he",  "kk-Arab",  "ks",  "ks-Arab",  "lrc",  "lrc-IQ",  "ms-Arab",  "ms-Arab-BN",  "mzn",  "nqo",  "pa-Arab",  "ps",  "ps-PK",  "rhg",  "rhg-Rohg",  "rhg-Rohg-BD",  "sd",  "sd-Arab",  "sdh",  "sdh-IQ",  "skr",  "syr",  "syr-SY",  "trw",  "ug",  "ur",  "ur-IN",  "uz-Arab",  "yi"]`
	);

	export type CalendarData = {
		activeDate: Date;
		days: {
			date: Date;
			isToday: boolean;
			isWeekend: boolean;
			isPrevMonth: boolean;
			isNextMonth: boolean;
		}[];
		weekDaysNames: {
			long: string;
			narrow: string;
			short: string;
			isWeekend: boolean;
		}[];
		weekStartOffset: number;
		useGridNavigation: Record<string, any>;
		dir: 'ltr' | 'rtl';
	};

	export type CalendarApi = {
		goToNextMonth(): void;
		goToPrevMonth(): void;
		goToToday(): void;
		format(d: Date, options?: Intl.DateTimeFormatOptions): string;
		formatToParts(d: Date, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[];
		sameDay(a: Date, b: Date): boolean;
		isBetween(date: Date, start: Date, end: Date): boolean;
	};
</script>

<script lang="ts">
	import { type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	let {
		View,
		activeDate = $bindable(),
		show = 'extended',
		locale,
		api = $bindable(),
		onGridNavigationInlineEnd,
		onGridNavigationInlineStart,
		onGridNavigationBlockStart,
		onGridNavigationBlockEnd
	}: {
		View: Snippet<[CalendarData]>;
		locale?: Intl.UnicodeBCP47LocaleIdentifier;
		show?: number | 'month' | 'extended';
		activeDate?: Date;
		api?: CalendarApi;
		onGridNavigationInlineEnd?: () => void;
		onGridNavigationInlineStart?: () => void;
		onGridNavigationBlockStart?: () => void;
		onGridNavigationBlockEnd?: () => void;
	} = $props();

	const sameDay = (a: Date, b: Date) => {
		const ac = new Date(a);
		const bc = new Date(b);
		ac.setHours(0, 0, 0, 0);
		bc.setHours(0, 0, 0, 0);
		return ac.getTime() === bc.getTime();
	};

	const goToNextMonth = () => {
		activeDate!.setMonth(activeDate!.getMonth() + 1);
		activeDate = new Date(activeDate!);
	};

	const goToPrevMonth = () => {
		activeDate!.setMonth(activeDate!.getMonth() - 1);
		activeDate = new Date(activeDate!);
	};

	const goToToday = () => {
		activeDate = new Date();
	};

	activeDate = activeDate ?? new Date();
	const { weekInfo, weekDaysNames, format, formatToParts, dir } = $derived.by(() => {
		const loc = new Intl.Locale(locale || navigator.languages[0] || 'en').maximize();
		const dir: 'ltr' | 'rtl' = rtl.includes(loc.minimize().toString()) ? 'rtl' : 'ltr';
		const info = (weekData[loc.region!] || weekData['001']).toString().split('').map(Number);
		const weekInfo = {
			firstDay: info[0] % 7,
			weekend: info.slice(2).map((d) => d % 7)
		};

		const format = (d: Date, options?: Intl.DateTimeFormatOptions) => {
			return Intl.DateTimeFormat(loc, options).format(d);
		};

		const formatToParts = (d: Date, options?: Intl.DateTimeFormatOptions) => {
			return Intl.DateTimeFormat(loc, options).formatToParts(d);
		};

		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const offset = Array.from({ length: 7 }, (_, i) => {
			return (weekInfo.firstDay + i) % 7;
		}).indexOf(start.getDay());
		start.setDate(start.getDate() - offset);
		const weekNames = Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			const isWeekend = weekInfo.weekend.includes(d.getDay());
			return (['long', 'narrow', 'short'] as const).reduce(
				(acc, n) => {
					acc[n] = format(d, { weekday: n });
					return acc;
				},
				{
					isWeekend
				} as CalendarData['weekDaysNames'][0]
			);
		});

		return {
			loc,
			weekInfo,
			weekDaysNames: weekNames,
			format,
			formatToParts,
			dir
		};
	});

	const { days, weekStartOffset } = $derived.by(() => {
		let startOfMonth = activeDate ? new Date(activeDate) : new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		let endOfMonth = new Date(startOfMonth);
		endOfMonth.setMonth(endOfMonth.getMonth() + 1);
		endOfMonth.setDate(0);
		let daysInMonth = endOfMonth.getDate() - startOfMonth.getDate();
		let startDate;
		let endDate;
		const weekStartOffset = Array.from({ length: 7 }, (_, i) => {
			return (weekInfo.firstDay + i) % 7;
		}).indexOf(startOfMonth.getDay());

		if (show === 'extended') {
			startDate = new Date(startOfMonth);
			startDate.setDate(startOfMonth.getDate() - weekStartOffset);
			endDate = new Date(endOfMonth);
			endDate.setDate(endOfMonth.getDate() + 42 - daysInMonth - weekStartOffset - 1);
		} else if (show == 'month') {
			startDate = new Date(startOfMonth);
			endDate = new Date(endOfMonth);
		} else {
			startDate = new Date(startOfMonth);
			endDate = new Date(startOfMonth);
			endDate.setMonth(endDate.getMonth() + show + 1);
			endDate.setDate(0);
		}
		const days: CalendarData['days'] = [];
		let cursor = new Date(startDate);
		const td = new Date();
		while (cursor <= endDate) {
			const d = {
				date: new Date(cursor),
				isToday: sameDay(cursor, td),
				isWeekend: weekInfo.weekend.includes(cursor.getDay()),
				isPrevMonth: cursor < startOfMonth,
				isNextMonth: cursor > endOfMonth
			};
			days.push(d);
			cursor.setDate(cursor.getDate() + 1);
		}
		return {
			days,
			weekStartOffset
		};
	});

	const items = new Set<HTMLElement>();

	const isFocusable = (el: HTMLElement) =>
		typeof el.focus === 'function' &&
		!el.hasAttribute('disabled') &&
		!el.getAttribute('aria-hidden') &&
		(el.tabIndex >= 0 || /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName));

	const useGridNavigation = () => {
		const keydown = (e: KeyboardEvent) => {
			const el = e.currentTarget as HTMLElement;
			if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
			if (!items.has(el)) return;
			const cells = [...items].map((e) => [e, e.getBoundingClientRect()] as [HTMLElement, DOMRect]);
			const [_, myRect] = cells.find((c) => c[0] == el)!;
			let best: [HTMLElement, DOMRect] | null = null;
			let bestScore = Infinity;

			const isUp = e.key === 'ArrowUp';
			const isDown = e.key === 'ArrowDown';
			const isLeft = e.key === 'ArrowLeft';
			const isRight = e.key === 'ArrowRight';

			for (const [cell, rect] of cells) {
				if (cell === el) continue;
				if (!isFocusable(cell)) continue;
				if (isUp && rect.bottom > myRect.top) continue;
				if (isDown && rect.top < myRect.bottom) continue;
				if (isLeft && rect.right > myRect.left) continue;
				if (isRight && rect.left < myRect.right) continue;

				const dx = rect.left + rect.width / 2 - (myRect.left + myRect.width / 2);
				const dy = rect.top + rect.height / 2 - (myRect.top + myRect.height / 2);
				const dist = Math.hypot(dx, dy);

				if (dist < bestScore) {
					bestScore = dist;
					best = [cell, rect];
				}
			}

			const [l, r] =
				dir === 'ltr'
					? [onGridNavigationInlineStart, onGridNavigationInlineEnd]
					: [onGridNavigationInlineEnd, onGridNavigationInlineStart];
			if (!best) {
				if (isLeft) l?.();
				if (isRight) r?.();
				if (isUp) onGridNavigationBlockStart?.();
				if (isDown) onGridNavigationBlockEnd?.();
				return;
			}
			best[0].focus();
			e.preventDefault();
		};
		return {
			[createAttachmentKey()]: (el: HTMLElement) => {
				items.add(el);
				el.addEventListener('keydown', keydown);
				return () => {
					items.delete(el);
					el.removeEventListener('keydown', keydown);
				};
			}
		};
	};

	const isBetween = (v: Date, a: Date, b: Date) => {
		const [start, end] = [+a, +b].sort((a, b) => a - b);
		const t = +v;
		return t >= start && t <= end;
	};

	api = {
		goToNextMonth,
		goToPrevMonth,
		goToToday,
		sameDay,
		isBetween,
		get format() {
			return format;
		},
		get formatToParts() {
			return formatToParts;
		}
	};

	const calendar: CalendarData = $derived({
		activeDate,
		days,
		weekDaysNames,
		weekStartOffset,
		dir,
		useGridNavigation: useGridNavigation()
	});
</script>

{#if typeof window != 'undefined'}
	{@render View(calendar)}
{/if}
