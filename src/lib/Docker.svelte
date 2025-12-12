<script lang="ts" module>
	import type { SvelteHTMLElements } from 'svelte/elements';
	type PanelNode = {
		el?: HTMLElement;
		dir: PanelDir;
		s: number;
		parentNode?: PanelNode;
		children?: PanelNode[];
		component?: string;
	};

	export type Panel = {
		dir: PanelDir;
		s: number;
		children?: Panel[];
		component?: string;
	};

	export type DockApi = {
		splitPanel: (node: Panel, dir?: PanelDir, size?: number, targetIsFirst?: boolean) => void;
		closePanel: (node: Panel) => void;
		setComponent: (node: Panel, component: string) => void;
	};

	export type HotcornerProps = (
		panel: Panel,
		corner: 'tl' | 'tr' | 'bl' | 'br'
	) => SvelteHTMLElements['button'];

	export type ResizerProps = (
		panel: Panel,
		dir: PanelDir
	) => Omit<SvelteHTMLElements['button'], 'onmousedown' | 'onkeydown'>;

	export type OverlayPanelProps = (
		dir: PanelDir,
		move: boolean,
		isTarget: boolean
	) => SvelteHTMLElements['div'];

	export type OverlayProps = (props: {
		action: 'split' | 'move';
		isTarget: boolean;
		dir: PanelDir;
		s: number;
	}) => SvelteHTMLElements['div'];

	export type HotCornerPos = 'tl' | 'tr' | 'bl' | 'br';
	export type PanelDir = 'w' | 'h';

	export type PanelProps = (props: {
		isMoveTarget: boolean;
		isResizable: boolean;
		isLeaf: boolean;
		isMoveStart: boolean;
		isSplitting: boolean;
		dir?: PanelDir;
	}) => SvelteHTMLElements['div'];

	//@ts-expect-error EmptySnippet
	const EmptySnippetKey = Object.getOwnPropertyNames(EmptySnippet).join('');
	export function isSnippet<P extends unknown[]>(t: any): t is Snippet<P> {
		return Object.getOwnPropertyNames(t).join('') == EmptySnippetKey;
	}
</script>

<script lang="ts">
	import { onMount, type Component, type Snippet } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), max);

	let {
		components,
		layout = $bindable(),
		EmptyView,
		HotCorner,
		Resizer,
		overlayProps,
		overlayPanelProps,
		panelProps,
		'min-size': minSize,
		api,
		...containerProps
	}: {
		layout: Panel;
		components: Record<string, Snippet<[{ panel?: Panel }]> | Component<{ panel?: Panel }>>;
		EmptyView?: Snippet<[Panel]>;
		HotCorner?: Snippet<[ReturnType<typeof getHotCornerBindings>]>;
		Resizer?: Snippet<[]>;
		overlayProps?: OverlayProps;
		overlayPanelProps?: OverlayPanelProps;
		panelProps?: PanelProps;
		'panel-gap'?: string;
		'min-size'?: number;
		api?: DockApi;
	} & SvelteHTMLElements['div'] = $props();

	let el: HTMLElement = $state(undefined!);
	let dir: 'rtl' | 'ltr' = $state('rtl');

	let splitTargetStart: PanelNode | undefined = $state(undefined);
	let moveTarget: PanelNode | undefined = $state(undefined);
	let resizeTarget: PanelNode | undefined = undefined;
	let lastPos: [number, number] = [0, 0];

	let overlay = $state({
		x: 0,
		y: 0,
		w: 0,
		h: 0,
		s: 0,
		dir: 'w' as PanelDir,
		move: false,
		moveTargetIsFirst: true
	});

	const getNodeByPos = (x: number, y: number, node: PanelNode = layout): PanelNode | undefined => {
		if (node.children?.length) return node.children.map((c) => getNodeByPos(x, y, c)).find(Boolean);
		const rect = node.el?.getBoundingClientRect();
		if (!rect) return;
		return rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom
			? node
			: undefined;
	};

	const flatten = (node: PanelNode) => {
		if (!node.children || node.component) return;
		node.children.forEach(flatten);
		if (node.children.length === 1) {
			Object.assign(node, {
				...node.children[0],
				s: node.s
			});
			node.children?.forEach((c) => (c.parentNode = node));
		}
		if (!node.children || node.component) {
			normalizeSizes(node);
			return;
		}
		let changed = true;
		while (changed) {
			changed = false;
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				if (!child.children || child.component) continue;
				if (child.dir === node.dir && child.children.length > 0) {
					const childInnerTotal = child.children.reduce((a, b) => a + b.s, 0);
					const hoisted = child.children.map((gc) => ({
						...gc,
						s: (child.s * gc.s) / childInnerTotal,
						parentNode: node
					}));
					node.children.splice(i, 1, ...hoisted);
					i += hoisted.length - 1;
					changed = true;
				}
			}
		}
		normalizeSizes(node);
	};

	const normalizeSizes = (node: PanelNode) => {
		const total = node.children?.reduce((sum, p) => sum + p.s, 0) || 1;
		node.children?.forEach((p) => (p.s = (p.s / total) * 100));
	};

	const getHotCornerBindings = (node: PanelNode, pos: HotCornerPos) => {
		return {
			node,
			get pos() {
				return pos;
			},
			bindings: {
				onmousedown: splittingStart(node),
				ontouchstart: splittingStart(node),
				get style() {
					return `position:absolute;${['tl', 'bl'].includes(pos) ? 'left:0;' : ''}${['tr', 'br'].includes(pos) ? 'right:0;' : ''}${['tl', 'br'].includes(pos) ? 'top:0;' : ''}${['br', 'bl'].includes(pos) ? 'bottom:0;' : ''}`;
				}
			}
		};
	};

	const updateOverlayFromRect = (rect: DOMRect, x: number, y: number) => {
		let rx = (x - rect.x) / rect.width;
		rx = dir == 'ltr' ? rx : 1 - rx;
		const ry = (y - rect.y) / rect.height;
		let px = el.getBoundingClientRect();
		overlay.w = rect.width;
		overlay.h = rect.height;
		overlay.x = rect.x - px.left;
		overlay.y = rect.y - px.top;
		overlay.s = (overlay.dir === 'w' ? rx : ry) * 100;
	};

	const splitMove = (x: number, y: number) => {
		if (!splitTargetStart) return;

		const rect = splitTargetStart.el!.getBoundingClientRect();
		const dx = Math.abs(x - lastPos[0]);
		const dy = Math.abs(y - lastPos[1]);

		if (Math.abs(dx - dy) > 16) {
			overlay.dir = dx > dy ? 'w' : 'h';
			lastPos = [x, y];
		}

		const rx = (x - rect.x) / rect.width;
		const ry = (y - rect.y) / rect.height;

		if (rx < 0 || rx > 1 || ry < 0 || ry > 1) {
			moveTarget = getNodeByPos(x, y);
			if (!moveTarget) return;
			const targetRect = moveTarget.el!.getBoundingClientRect();
			updateOverlayFromRect(targetRect, x, y);
			let rel =
				overlay.dir === 'w'
					? (x - targetRect.x) / targetRect.width
					: (y - targetRect.y) / targetRect.height;
			rel = dir == 'rtl' && overlay.dir === 'w' ? 1 - rel : rel;
			overlay.move = true;
			overlay.moveTargetIsFirst = rel < 0.5;
			overlay.s = clamp(rel * 100 + (overlay.moveTargetIsFirst ? 25 : -25), 0, 100);
			return;
		}

		updateOverlayFromRect(rect, x, y);
		overlay.move = false;
	};

	const resizeMove = (x: number, y: number) => {
		if (!resizeTarget?.parentNode) return;
		const parent = resizeTarget.parentNode;
		const [dx, dy] = [lastPos[0] - x, lastPos[1] - y];
		const rect = parent.el!.getBoundingClientRect();
		const spx = parent.dir === 'w' ? rect.width : rect.height;
		let delta = 100 * ((parent.dir === 'w' ? dx : dy) / spx);

		delta *= dir == 'rtl' && parent.dir === 'w' ? -1 : 1;

		const idx = parent.children!.indexOf(resizeTarget);
		parent.children![idx].s -= delta;
		parent.children![idx + 1].s += delta;
		if (minSize != undefined && (parent.children![idx].s / 100) * spx < minSize) {
			closePanel(parent.children![idx]);
			splitCancel();
		} else if (minSize != undefined && (parent.children![idx + 1].s / 100) * spx < minSize) {
			closePanel(parent.children![idx + 1]);
			splitCancel();
		}
		lastPos = [x, y];
	};

	const splittingStart = (node: PanelNode) => (e: MouseEvent | TouchEvent) => {
		if (e instanceof MouseEvent) {
			if (e.buttons != 1) return;
			lastPos = [e.clientX, e.clientY];
		} else {
			lastPos = [e.touches[0].clientX, e.touches[0].clientY];
		}
		splitTargetStart = node;
	};

	const resizeStart = (node: PanelNode) => (e: MouseEvent | TouchEvent) => {
		if (e instanceof MouseEvent) {
			if (e.buttons != 1) return;
			lastPos = [e.clientX, e.clientY];
		} else {
			lastPos = [e.touches[0].clientX, e.touches[0].clientY];
		}
		resizeTarget = node;
	};

	const keyboardResize = (node: PanelNode) => (e: KeyboardEvent) => {
		const parent = node.parentNode!;
		let keys = parent.dir === 'w' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
		if (!keys.includes(e.key)) return;
		let delta = dir == 'ltr' ? 1 : -1;
		if (e.key == keys[1]) {
			delta *= -1;
		}
		const idx = parent.children!.indexOf(node);
		const rect = parent.el!.getBoundingClientRect();
		const spx = parent.dir === 'w' ? rect.width : rect.height;
		const l = ((parent.children![idx].s - delta) / 100) * spx;
		const r = ((parent.children![idx + 1].s + delta) / 100) * spx;
		if (minSize != undefined && l < minSize) {
			closePanel(parent.children![idx]);
			return;
		}
		if (minSize != undefined && r < minSize) {
			closePanel(parent.children![idx + 1]);
			return;
		}
		parent.children![idx].s -= delta;
		parent.children![idx + 1].s += delta;
	};

	const splitEnd = () => {
		if (!splitTargetStart || overlay.move) return;
		const parent = splitTargetStart.parentNode;
		const frac = overlay.s / 100;

		if (parent && parent.children) {
			const rect = parent.el!.getBoundingClientRect();
			const spx = overlay.dir == 'w' ? rect.width : rect.height;
			if (minSize && (frac * spx < minSize || (1 - frac) * spx < minSize)) {
				return;
			}
			const idx = parent.children.indexOf(splitTargetStart);
			if (overlay.dir === parent.dir) {
				parent.children.splice(idx + 1, 0, {
					el: undefined!,
					children: [],
					dir: 'w',
					s: splitTargetStart.s * (1 - frac)
				});
				splitTargetStart.s *= frac;
			} else {
				parent.children[idx] = {
					el: undefined!,
					children: [
						splitTargetStart,
						{ el: undefined!, children: [], dir: 'w', s: 100 - overlay.s }
					],
					dir: overlay.dir,
					s: splitTargetStart.s
				};
				splitTargetStart.s = overlay.s;
			}
		} else {
			// Root split
			const rect = el.getBoundingClientRect();
			const spx = overlay.dir == 'w' ? rect.width : rect.height;
			if (minSize && (frac * spx < minSize || (1 - frac) * spx < minSize)) {
				return;
			}
			if (overlay.dir !== splitTargetStart.dir) splitTargetStart.dir = overlay.dir;
			splitTargetStart.children = [
				{ el: undefined!, children: [], dir: 'w', s: overlay.s },
				{ el: undefined!, children: [], dir: 'w', s: 100 - overlay.s }
			];
		}
	};

	const moveEnd = () => {
		const from = splitTargetStart;
		const to = moveTarget;
		if (!from || !to || !overlay.move || !from.parentNode || !to.parentNode) return;

		const fromParent = from.parentNode;
		fromParent.children = fromParent.children!.filter((c) => c !== from);

		const toParent = to.parentNode;
		const dir = overlay.dir;
		const before = overlay.moveTargetIsFirst;
		const frac = overlay.s / 100;
		const idx = toParent.children!.indexOf(to);

		if (toParent.dir === dir) {
			toParent.children!.splice(idx + (before ? 0 : 1), 0, from);
			const ratio = to.s * (before ? frac : 1 - frac);
			from.s = ratio;
			to.s -= ratio;
		} else {
			toParent.children![idx] = {
				el: undefined!,
				children: before ? [from, to] : [to, from],
				dir,
				s: to.s
			};
			from.s = before ? overlay.s : 100 - overlay.s;
			to.s = 100 - from.s;
		}

		normalizeSizes(fromParent);
		flatten(layout);
	};

	const splitCancel = () => {
		splitTargetStart = undefined;
		resizeTarget = undefined;
		overlay = {
			x: 0,
			y: 0,
			w: 0,
			h: 0,
			s: 0,
			dir: 'w',
			move: false,
			moveTargetIsFirst: true
		};
	};

	let panels = new WeakSet<Element>();

	const panelsOf = (e: HTMLElement) => {
		return Array.from(e.children).filter((e) => panels.has(e)) as HTMLElement[];
	};

	$effect(() => {
		const stack = [[layout, panelsOf(el)[0]] as [PanelNode, HTMLElement]];
		while (stack.length) {
			const [node, dom] = stack.pop()!;
			node.el = dom;

			node.children?.forEach((child, i) => {
				child.parentNode = node;
				stack.push([child, panelsOf(dom)[i] as HTMLElement]);
			});
		}
	});

	const setComponent = (node: Panel, component: string) => {
		if (components[component]) {
			node.component = component;
		}
	};

	const onmousemove = (e: MouseEvent | TouchEvent) => {
		if (!splitTargetStart && !resizeTarget?.parentNode) return;
		let x, y;
		if (e instanceof MouseEvent) {
			x = e.clientX;
			y = e.clientY;
		} else {
			e.preventDefault();
			x = e.touches[0].clientX;
			y = e.touches[0].clientY;
		}
		splitMove(x, y);
		resizeMove(x, y);
	};

	const onmouseup = () => {
		splitEnd();
		moveEnd();
		splitCancel();
	};

	const splitPanel = (
		node: PanelNode,
		dir: PanelDir = 'w',
		size: number = 50,
		targetIsFirst: boolean = true
	) => {
		splitTargetStart = node;
		overlay.dir = dir;
		overlay.s = size;
		overlay.moveTargetIsFirst = targetIsFirst;
		splitEnd();
		splitCancel();
	};

	const closePanel = (node: PanelNode) => {
		if (!node.parentNode) {
			return;
		}
		let idx = node.parentNode!.children!.indexOf(node);
		node.parentNode?.children?.splice(idx, 1);
		flatten(layout);
	};

	const onkeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			setTimeout(() => {
				(document.activeElement as HTMLElement)?.blur?.();
			});
			splitCancel();
		}
	};

	const getResizerBindings = (node: PanelNode, dir: PanelDir) => {
		return {
			get dir() {
				return dir;
			},
			node,
			bindings: {
				onmousedown: resizeStart(node),
				ontouchstart: resizeStart(node),
				onkeydown: keyboardResize(node)
			}
		};
	};

	onMount(() => {
		dir = getComputedStyle(el).direction as 'ltr';
		if (api) {
			api.closePanel = closePanel;
			api.splitPanel = splitPanel;
			api.setComponent = setComponent;
		}
		window.addEventListener('touchmove', onmousemove, { passive: false });
		window.addEventListener('mousemove', onmousemove, { passive: false });
		window.addEventListener('mouseup', onmouseup);
		window.addEventListener('touchend', onmouseup);
		window.addEventListener('keydown', onkeydown);

		return () => {
			window.removeEventListener('touchmove', onmousemove);
			window.removeEventListener('mousemove', onmousemove);
			window.removeEventListener('mouseup', onmouseup);
			window.removeEventListener('touchend', onmouseup);
			window.removeEventListener('keydown', onkeydown);
		};
	});
</script>

{#snippet HotCornerDefault({ bindings, pos }: ReturnType<typeof getHotCornerBindings>)}
	<button
		style:position="absolute"
		style:left={['tl', 'bl'].includes(pos) ? '0' : ''}
		style:top={['tl', 'tr'].includes(pos) ? '0' : ''}
		style:bottom={['bl', 'br'].includes(pos) ? '0' : ''}
		style:right={['br', 'tr'].includes(pos) ? '0' : ''}
		style:width="10px"
		style:height="10px"
		style:cursor="crosshair"
		{...bindings}
	></button>
{/snippet}

{#snippet HotCorners(node: PanelNode)}
	{#each ['tl', 'tr', 'bl', 'br'] as const as pos}
		{@render (HotCorner || HotCornerDefault)(getHotCornerBindings(node, pos))}
	{/each}
{/snippet}

{#snippet Panel(node: PanelNode, parent?: PanelNode)}
	{@const last = parent?.children!.at(-1)}
	{@const isResizable = !!last && last != node}
	{@const isLeaf = !node.children?.length && layout != node}
	{@const isMoveStart = node === splitTargetStart && overlay.move}
	{@const isSplitting = splitTargetStart == node && !overlay.move}
	{@const isMoveTarget = node == moveTarget && overlay.move}
	{@const props = panelProps?.({
		isResizable,
		isLeaf,
		isMoveStart,
		isSplitting,
		isMoveTarget,
		dir: parent?.dir!
	})}
	<div
		style:width={parent?.dir == 'w' ? `${node.s}%` : '100%'}
		style:height={parent?.dir == 'w' ? '100%' : `${node.s}%`}
		style:position="relative"
		style:display="flex"
		style:flex-direction={node.dir == 'w' ? 'row' : 'column'}
		{@attach (el) => {
			panels.add(el);
			return () => {
				panels.delete(el);
			};
		}}
		{...props}
	>
		{#if node.children?.length}
			{#each node.children as child}
				{@render Panel(child, node)}
			{/each}
		{:else}
			{#if node.component}
				{@const C = components[node.component]}
				{#if isSnippet(C)}
					{@render C({ panel: node })}
				{:else}
					<C panel={node}></C>
				{/if}
			{:else}
				{@render (EmptyView || EmptyViewDefault)(node)}
			{/if}
			{@render HotCorners(node)}
		{/if}
	</div>
	{#if isResizable}
		{@render ResizerDefault(getResizerBindings(node, parent!.dir))}
	{/if}
{/snippet}

{#snippet ResizerDefault({ dir, bindings, node }: { dir: PanelDir; bindings: any; node: any })}
	<button
		style:position="relative"
		style:z-index="10"
		style:height={dir == 'w' ? '100%' : '3px'}
		style:width={dir == 'h' ? '100%' : '3px'}
		style:cursor={dir == 'w' ? 'col-resize' : 'row-resize'}
		{...bindings}
	></button>
{/snippet}

{#snippet EmptyViewDefault(_: Panel)}
	<div class=""></div>
{/snippet}

<div style:position="relative" {...containerProps} bind:this={el}>
	{@render Panel(layout)}
	{#if splitTargetStart}
		{@const action = overlay.move ? 'move' : 'split'}
		{@const dir = overlay.dir}
		<div
			style:display="flex"
			style:width="{overlay.w}px"
			style:height="{overlay.h}px"
			style:left="{overlay.x}px"
			style:top="{overlay.y}px"
			style:position="absolute"
			style:flex-direction={dir == 'w' ? 'row' : 'column'}
			style:z-index="10"
			style:cursor={action == 'split' ? (dir == 'w' ? 'col-resize' : 'row-resize') : 'grabbing'}
			{...overlayProps?.({
				action,
				isTarget: overlay.moveTargetIsFirst,
				dir: overlay.dir,
				s: overlay.s
			})}
		>
			{@render OverlayPanelDefault({
				action,
				isTarget: overlay.moveTargetIsFirst,
				isFirst: true,
				dir: overlay.dir,
				s: overlay.s
			})}
			{@render OverlayPanelDefault({
				action,
				isTarget: overlay.moveTargetIsFirst,
				isFirst: false,
				dir: overlay.dir,
				s: overlay.s
			})}
		</div>
	{/if}
</div>

{#snippet OverlayPanelDefault({
	dir,
	s,
	isTarget,
	isFirst
}: {
	action: 'split' | 'move';
	isTarget: boolean;
	dir: PanelDir;
	s: number;
	isFirst: boolean;
})}
	<div
		style:width={dir == 'w' ? `${s}%` : ''}
		style:height={dir == 'h' ? `${s}%` : ''}
		style:background-color={(isFirst ? isTarget : !isTarget) ? 'rgba(255, 255, 255, 0.1)' : ''}
		style:flex={isFirst ? '' : '1'}
	></div>
{/snippet}

{#snippet EmptySnippet()}{/snippet}
