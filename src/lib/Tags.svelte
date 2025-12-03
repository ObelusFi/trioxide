<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLInputAttributes, HTMLLabelAttributes } from 'svelte/elements';
	type T = $$Generic<{ value: string }>;

	let {
		tags = $bindable(),
		Tag,
		onTag = (x) => {
			x.value = x.value.trim();
			if (x.value === '') return undefined;
			return x as T;
		},
		PlaceHolder,
		createOn = [' ', 'Enter'],
		cursorProps,
		...containerProps
	}: {
		tags: T[];
		createOn?: string[] | ((e: KeyboardEvent) => boolean);
		Tag: Snippet<[value: T, props: Record<string, any>]>;
		PlaceHolder?: Snippet;
		onTag?: (newValue: { value: string }) => T | undefined;
		cursorProps?: HTMLInputAttributes;
	} & HTMLLabelAttributes = $props();
	let cursor = $state({
		value: '',
		pos: tags.length
	});
	let internal = false;
	let el: HTMLElement;
	let cursorEl: HTMLInputElement = $state(null!);
	const items = $derived.by(() => {
		const vls = [...tags.values()];
		return [...vls.slice(0, cursor.pos), cursor, ...vls.slice(cursor.pos)];
	});

	const splice = (start: number, deleteCount: number, ...append: T[]) => {
		internal = true;
		tags.splice(start, deleteCount, ...append);
	};

	function getCssStyle(element: HTMLElement, prop: string) {
		return window.getComputedStyle(element).getPropertyValue(prop);
	}
	function measureText(text: string, el: HTMLElement) {
		if (typeof window === 'undefined' || !el) return 0;
		const fontWeight = getCssStyle(el, 'font-weight') || 'normal';
		const fontSize = getCssStyle(el, 'font-size') || '16px';
		const fontFamily = getCssStyle(el, 'font-family') || 'Times New Roman';
		const font = `${fontWeight} ${fontSize} ${fontFamily}`;
		// @ts-ignore
		const canvas = measureText.canvas || (measureText.canvas = new OffscreenCanvas(200, 200));
		const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
		context.font = font;
		const metrics = context.measureText(text);
		return metrics.width;
	}

	const w = $derived.by(() => {
		return measureText(cursor.value, el) + 5;
	});

	const focusAtPos = (n: number = 0) => {
		el.focus();
		setTimeout(() => {
			if (n < 0) {
				n = cursor.value.length + n + 1;
			}
			cursorEl.selectionStart = n;
			cursorEl.selectionEnd = n;
			cursorEl.focus();
		});
	};

	$effect(() => {
		tags.length;
		if (internal) {
			internal = false;
			return;
		}
		untrack(() => {
			cursor.pos = tags.length;
		});
	});

	const shouldCreate = (e: KeyboardEvent) => {
		if (typeof createOn == 'function') {
			return createOn(e);
		}
		return createOn.includes(e.key);
	};

	const onkeydown = (e: KeyboardEvent) => {
		const pos = cursorEl.selectionStart;
		const dir = getComputedStyle(el).direction;

		if (shouldCreate(e)) {
			e.preventDefault();
			const start = cursor.value.slice(0, pos || undefined);
			const end = cursor.value.slice(pos || cursor.value.length);
			const nv = onTag({ value: start });
			if (!nv) return;
			splice(cursor.pos, 0, nv);
			cursor.value = end;
			cursor.pos += 1;
			focusAtPos(0);
			return;
		}

		const [left, right] = dir == 'ltr' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];

		if (e.key == 'Backspace' && pos == 0 && cursor.pos > 0) {
			if (!cursor.value.length) {
				const nv = tags[cursor.pos - 1].value;
				splice(cursor.pos - 1, 1);
				cursor.value = nv;
				cursor.pos -= 1;
			} else {
				const nextCursor = tags[cursor.pos - 1].value;
				const newV = onTag({ value: cursor.value });
				if (!newV) {
					return;
				}
				splice(cursor.pos - 1, 1, newV);
				cursor.value = nextCursor;
				cursor.pos -= 1;
			}
			focusAtPos(-1);
			return;
		}

		if (e.key == left && pos == 0 && cursor.pos > 0) {
			if (!cursor.value.length) {
				const nv = tags[cursor.pos - 1].value;
				splice(cursor.pos - 1, 1);
				cursor.value = nv;
				cursor.pos -= 1;
			} else {
				const newV = onTag({ value: cursor.value });
				if (!newV) return;
				splice(cursor.pos, 0, newV);
				cursor.value = '';
			}
			focusAtPos(-1);
			return;
		}
		if (e.key == right && pos == cursor.value.length && cursor.pos < tags.length) {
			if (!cursor.value.length) {
				const nv = tags[cursor.pos].value;
				splice(cursor.pos, 1);
				cursor.value = nv;
			} else {
				const newV = onTag({ value: cursor.value });
				if (!newV) return;
				splice(cursor.pos, 0, newV);
				cursor.pos += 1;
				cursor.value = '';
			}
			focusAtPos(0);
			return;
		}

		if (
			e.key == right &&
			pos == cursor.value.length &&
			cursor.pos == tags.length &&
			cursor.value.length
		) {
			const newV = onTag({ value: cursor.value });
			if (!newV) return;
			splice(cursor.pos, 0, newV);
			cursor.value = '';
			cursor.pos += 1;
			focusAtPos(0);
			return;
		}

		if (e.key == left && pos == 0 && cursor.pos == 0 && cursor.value.length) {
			const newV = onTag({ value: cursor.value });
			if (!newV) return;
			splice(cursor.pos, 0, newV);
			cursor.value = '';
			cursor.pos = 0;
			focusAtPos(0);
			return;
		}
	};

	const onblur = () => {
		setTimeout(() => {
			if (document.activeElement == cursorEl) return;
			if (cursor.value.length) {
				const newV = onTag({ value: cursor.value });
				if (newV) {
					splice(cursor.pos, 0, newV);
				}
			}
			cursor.value = '';
			cursor.pos = tags.length;
		}, 2); // makes sure the focus is triggered before
	};

	const onclick = (v: T) => (e: MouseEvent) => {
		if (cursor.value.length) {
			const newV = onTag({ value: cursor.value });
			if (newV) {
				splice(cursor.pos, 0, newV);
			}
		}
		const range = document.caretPositionFromPoint(e.clientX, e.clientY);
		if (range?.offsetNode.nodeType != 3) return;
		let i = tags.indexOf(v);
		splice(i, 1);
		cursor.pos = i;
		cursor.value = v.value;
		focusAtPos(range?.offset);
	};

	const cursorId = ((length = 10) => {
		return Math.random()
			.toString(36)
			.substring(2, length + 2);
	})();

	function isTag(x: any): x is T {
		return x != cursor;
	}

	let hasFocus = $state(false);
	const onfocuschange = () => {
		hasFocus = document.activeElement == cursorEl;
	};
</script>

<svelte:window onfocusin={onfocuschange} onfocusout={onfocuschange} />

<label bind:this={el} {...containerProps} for={cursorId}>
	{#if tags.length == 0 && cursor.value == '' && !hasFocus}
		{@render PlaceHolder?.()}
	{/if}
	{#each items as v}
		{#if isTag(v)}
			{@render Tag(v, { onmousedown: onclick(v) })}
		{:else}
			<input
				{...cursorProps}
				type="text"
				bind:this={cursorEl}
				bind:value={cursor.value}
				autocomplete="off"
				style:max-width="{w}px"
				style:outline="0"
				style:text-align="center"
				style:border="0"
				{onkeydown}
				{onblur}
				id={cursorId}
			/>
		{/if}
	{/each}
</label>
