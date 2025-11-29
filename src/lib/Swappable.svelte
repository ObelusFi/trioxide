<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	type T = $$Generic;

	const elements = new Map<T, HTMLElement>();

	let {
		items = $bindable(),
		Item,
		onSwap,
		threshold = 20,
		'drag-on-hold': dragOnHold = 0
	}: {
		items: T[];
		Item: Snippet<[props: T, bindings: ReturnType<typeof bindings>]>;
		onSwap?: (n: number, m: number) => void;
		threshold?: number;
		'drag-on-hold'?: number;
	} = $props();

	// Drag settings

	function swap(arr: T[], i: number, j: number) {
		[arr[i], arr[j]] = [arr[j], arr[i]];
		onSwap?.(i, j);
	}

	function bindings(item: T) {
		let dy = $state(0);

		let isDragging = $state(false);
		let startY = 0;
		let prevMouseY = 0;
		let yLoc = 0;

		let grabbedIdx = -1;
		let timeout: ReturnType<typeof setTimeout>;

		function onMouseMove(e: MouseEvent | TouchEvent) {
			clearTimeout(timeout);
			if (!isDragging) return;
			let pageY;
			if (e instanceof MouseEvent) {
				pageY = e.pageY;
			} else {
				e.preventDefault();
				pageY = e.touches[0].pageY;
			}

			const direction = pageY - prevMouseY;
			grabbedIdx = items.indexOf(item);
			if (grabbedIdx === -1) return;

			if (direction > 0 && dy > threshold && grabbedIdx < items.length - 1) {
				const nextEl = elements.get(items[grabbedIdx + 1])!;
				const nextRect = nextEl.getBoundingClientRect();

				swap(items, grabbedIdx, grabbedIdx + 1);
				startY = nextRect.y - yLoc;
			} else if (direction < 0 && dy < -threshold && grabbedIdx > 0) {
				const prevEl = elements.get(items[grabbedIdx - 1])!;
				const prevRect = prevEl.getBoundingClientRect();
				swap(items, grabbedIdx, grabbedIdx - 1);
				startY = prevRect.y - yLoc;
			}

			dy = pageY - startY;
			prevMouseY = pageY;
		}

		function onMouseUp() {
			clearTimeout(timeout);
			isDragging = false;
			dy = 0;
			grabbedIdx = -1;
		}

		function dragStart(e: MouseEvent | TouchEvent) {
			timeout = setTimeout(() => {
				let pageY;
				if (e instanceof MouseEvent) {
					pageY = e.pageY;
				} else {
					pageY = e.touches[0].pageY;
				}
				isDragging = true;
				startY = pageY;
				prevMouseY = pageY;
				yLoc = elements.get(item)!.getBoundingClientRect().y - pageY;
			}, dragOnHold);
		}

		if (typeof window != 'undefined') {
			document.body.addEventListener('mouseup', onMouseUp);
			document.body.addEventListener('touchend', onMouseUp);

			document.body.addEventListener('mousemove', onMouseMove);
			document.body.addEventListener('touchmove', onMouseMove, {
				passive: false
			});
		}

		return {
			element: {
				// element binding
				[createAttachmentKey()](el: HTMLElement) {
					elements.set(item, el);

					return () => {
						document.body.removeEventListener('mouseup', onMouseUp);
						document.body.removeEventListener('touchend', onMouseUp);

						document.body.removeEventListener('mousemove', onMouseMove);
						document.body.removeEventListener('touchmove', onMouseMove);
						clearTimeout(timeout);
						elements.delete(item);
					};
				},
				get style() {
					return `translate: 0 ${dy}px;`;
				}
			},
			handle: {
				onmousedown: dragStart,
				ontouchstart: dragStart
			},
			get isDragging() {
				return isDragging;
			},
			get dy() {
				return dy;
			}
		};
	}
</script>

{#each items as item (item)}
	{@render Item(item, bindings(item))}
{/each}
