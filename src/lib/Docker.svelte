<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';
	type PanelNode = {
		el?: HTMLElement;
		dir: 'w' | 'h';
		s: number;
		parentNode?: PanelNode;
		children?: PanelNode[];
		component?: string;
	};

	export type Panel = {
		dir: 'w' | 'h';
		s: number;
		children?: Panel[];
		component?: string;
	};

	export type DockApi = {
		splitPanel: (node: Panel, dir?: 'w' | 'h', size?: number, targetIsFirst?: boolean) => void;
		closePanel: (node: Panel) => void;
	};

	export type HotcornerProps = (
		panel: Panel,
		corner: 'tl' | 'tr' | 'bl' | 'br'
	) => HTMLAttributes<HTMLButtonElement>;

	export type ResizerProps = (
		panel: Panel,
		dir: 'w' | 'h'
	) => Omit<HTMLAttributes<HTMLButtonElement>, 'onmousedown' | 'onkeydown'>;

	export type OverlayPanelProps = (
		dir: 'w' | 'h',
		move: boolean,
		isTarget: boolean
	) => HTMLAttributes<HTMLDivElement>;

	export type OverlayProps = (dir: 'w' | 'h', move: boolean) => HTMLAttributes<HTMLDivElement>;

	export type PanelProps = (props: {
		isMoveTarget: boolean;
		isResizable: boolean;
		isLeaf: boolean;
		isMoveStart: boolean;
		isSplitting: boolean;
		dir?: 'w' | 'h';
	}) => HTMLAttributes<HTMLDivElement>;
</script>

<script lang="ts">
	import { onMount, type Component, type Snippet } from 'svelte';

	const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), max);

	let {
		components,
		layout = $bindable(),
		EmptyView,
		HotcornerContent,
		hotcornerProps,
		resizerProps,
		containerProps,
		overlayProps,
		overlayPanelProps,
		panelProps,
		'panel-gap': panelGap,
		OverlayMoveTargetContent,
		OverlayMoveRestContent,
		OverlaySplitTargetContent,
		OverlaySplitRestContent,
		'min-size': minSize,
		api
	}: {
		layout: Panel;
		components: Record<string, Snippet | Component>;
		EmptyView?: Snippet;
		HotcornerContent?: Snippet<['tl' | 'tr' | 'bl' | 'br']>;
		containerProps?: HTMLAttributes<HTMLDivElement>;
		overlayProps?: OverlayProps;
		overlayPanelProps?: OverlayPanelProps;
		panelProps?: PanelProps;
		'panel-gap'?: string;
		OverlayMoveTargetContent?: Snippet;
		OverlayMoveRestContent?: Snippet;
		OverlaySplitTargetContent?: Snippet;
		OverlaySplitRestContent?: Snippet;
		resizerProps?: ResizerProps;
		hotcornerProps?: HotcornerProps;
		'min-size'?: number;
		api?: DockApi;
	} = $props();

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
		dir: 'w' as 'w' | 'h',
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

	const splitMove = (e: MouseEvent) => {
		if (!splitTargetStart) return;

		const rect = splitTargetStart.el!.getBoundingClientRect();
		const [x, y] = [e.clientX, e.clientY];
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

	const resizeMove = (e: MouseEvent) => {
		if (!resizeTarget?.parentNode) return;
		const parent = resizeTarget.parentNode;
		const [dx, dy] = [lastPos[0] - e.clientX, lastPos[1] - e.clientY];
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
		lastPos = [e.clientX, e.clientY];
	};

	const splittingStart = (node: PanelNode) => (e: MouseEvent) => {
		if (e.buttons != 1) return;
		splitTargetStart = node;
		lastPos = [e.clientX, e.clientY];
	};

	const resizeStart = (node: PanelNode) => (e: MouseEvent) => {
		if (e.buttons != 1) return;
		resizeTarget = node;
		lastPos = [e.clientX, e.clientY];
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

	const panels = (e: HTMLElement) => {
		return Array.from(e.children).filter((e) =>
			e.classList.contains('trioxide_panel')
		) as HTMLElement[];
	};

	$effect(() => {
		const stack = [[layout, panels(el)[0]] as [PanelNode, HTMLElement]];
		while (stack.length) {
			const [node, dom] = stack.pop()!;
			node.el = dom;

			node.children?.forEach((child, i) => {
				child.parentNode = node;
				stack.push([child, panels(dom)[i] as HTMLElement]);
			});
		}
	});

	const onmousemove = (e: MouseEvent) => {
		splitMove(e);
		resizeMove(e);
	};

	const onmouseup = () => {
		splitEnd();
		moveEnd();
		splitCancel();
	};

	const splitPanel = (
		node: PanelNode,
		dir: 'w' | 'h' = 'w',
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

	onMount(() => {
		dir = getComputedStyle(el).direction as 'ltr';
		if (!api) return;
		api.closePanel = closePanel;
		api.splitPanel = splitPanel;
	});

	const omit = <T extends Record<string, any> | undefined>(
		props: T,
		...keys: (keyof NonNullable<T>)[]
	): T => {
		if (!props) return undefined as T;
		let cp: Record<string, any> = {};
		for (let k in props) {
			if (keys.includes(k)) continue;
			cp[k] = props[k];
		}
		return cp as T;
	};
</script>

<svelte:window
	{onmousemove}
	{onmouseup}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			setTimeout(() => {
				(document.activeElement as HTMLElement)?.blur?.();
			});
			splitCancel();
		}
	}}
/>

{#snippet HotCorners(node: PanelNode)}
	{#each ['tl', 'tr', 'bl', 'br'] as const as pos}
		{@const props = hotcornerProps?.(node, pos)}
		<button
			class="trioxide_hotcorner {props?.class?.toString() || 'trioxide_hotcorner-default'} {pos}"
			onmousedown={splittingStart(node)}
			{...omit(props, 'class', 'onmousedown')}
		>
			{@render HotcornerContent?.(pos)}</button
		>
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
		class="trioxide_panel
		{node.dir}
		{props?.class?.toString()}
		{isSplitting && !props?.class?.toString() ? 'trioxide_panel-spliting-default' : ''}
		{isMoveStart && !props?.class?.toString() ? 'trioxide_panel-is-move-start-default' : ''}
		{isMoveTarget && !props?.class?.toString() ? 'trioxide_panel-is-move-end-default' : ''}
		{isLeaf && !props?.class?.toString() ? 'trioxide_panel-leaf-default' : ''}
		"
		{...omit(props, 'class')}
		style:--w={parent?.dir == 'w' ? `${node.s}%` : '100%'}
		style:--h={parent?.dir == 'w' ? '100%' : `${node.s}%`}
	>
		{#if node.children?.length}
			{#each node.children as child}
				{@render Panel(child, node)}
			{/each}
		{:else}
			{#if node.component}
				{@render (components[node.component] as any)()}
			{:else}
				{@render (EmptyView || EmptyViewDefault)()}
			{/if}
			{@render HotCorners(node)}
		{/if}
	</div>
	{#if isResizable}
		{@const props = resizerProps?.(node, parent!.dir) as HTMLAttributes<HTMLButtonElement>}
		<button
			class="trioxide_resizer {parent!.dir} {props?.class?.toString() ||
				'trioxide_resizer-default'}"
			onmousedown={resizeStart(node)}
			onkeydown={keyboardResize(node)}
			{...omit(props, 'onmousedown', 'onkeydown', 'class')}
		></button>
	{/if}
{/snippet}

{#snippet EmptyViewDefault()}
	<div class=""></div>
{/snippet}

<div
	class="trioxide_ctr {containerProps?.class?.toString() || 'trioxide_ctr-default'}"
	{...omit(containerProps, 'class')}
	style:--gap={panelGap || '2px'}
	bind:this={el}
>
	{@render Panel(layout)}
	{#if splitTargetStart}
		{@const props = overlayProps?.(overlay.dir, overlay.move)}
		{@const pPropsTarget = overlayPanelProps?.(overlay.dir, overlay.move, true)}
		{@const pProps = overlayPanelProps?.(overlay.dir, overlay.move, false)}
		{@const action = overlay.move ? 'move' : 'split'}
		{@const firstCls = `trioxide_overlay-${action}-${overlay.moveTargetIsFirst ? 'target' : 'rest'}-default trioxide_overlay-panel-default`}
		{@const sndCls = `trioxide_overlay-${action}-${overlay.moveTargetIsFirst ? 'rest' : 'target'}-default trioxide_overlay-panel-default`}
		<div
			class="trioxide_overlay {overlay.dir} {props?.class?.toString() ||
				'trioxide_overlay-default'}"
			class:move={overlay.move}
			{...omit(props, 'class')}
			style:--s="{overlay.s}%"
			style:--w="{overlay.w}px"
			style:--h="{overlay.h}px"
			style:--x="{overlay.x}px"
			style:--y="{overlay.y}px"
		>
			<div
				class="trioxide_overlay-panel-first
				{(overlay.moveTargetIsFirst ? pPropsTarget?.class?.toString() : pProps?.class?.toString()) ||
					firstCls}"
				{...omit(overlay.moveTargetIsFirst ? pPropsTarget : pProps, 'class')}
			>
				{@render (overlay.move
					? overlay.moveTargetIsFirst
						? OverlayMoveTargetContent
						: OverlayMoveRestContent
					: OverlaySplitTargetContent)?.()}
			</div>
			<div
				class="trioxide_overlay-panel-second
				{(overlay.moveTargetIsFirst ? pProps?.class?.toString() : pPropsTarget?.class?.toString()) ||
					sndCls}"
				{...omit(overlay.moveTargetIsFirst ? pProps : pPropsTarget, 'class')}
			>
				{@render (overlay.move
					? !overlay.moveTargetIsFirst
						? OverlayMoveTargetContent
						: OverlayMoveRestContent
					: OverlaySplitRestContent)?.()}
			</div>
		</div>
	{/if}
</div>

<style>
	.trioxide_overlay {
		display: flex;
		z-index: 10;
		position: absolute;
		gap: var(--gap);
		width: var(--w);
		height: var(--h);
		left: var(--x);
		top: var(--y);
		&.w {
			display: flex;
			cursor: col-resize;
			flex-direction: row;
			.trioxide_overlay-panel-first {
				width: calc(var(--s) - var(--gap));
			}
			.trioxide_overlay-panel-second {
				flex: 1;
			}
		}

		&.h {
			cursor: row-resize;
			flex-direction: column;
			.trioxide_overlay-panel-first {
				height: calc(var(--s) - var(--gap));
			}
			.trioxide_overlay-panel-second {
				flex: 1;
			}
		}

		&.move.w,
		&.move.h {
			cursor: grabbing;
		}
	}

	.trioxide_ctr {
		position: relative;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.trioxide_panel-spliting-default,
	.trioxide_panel-is-move-end-default {
		border: transparent;
	}

	.trioxide_overlay-panel-default {
		border-color: var(--trioxide_neutral-7);
		border-radius: var(--radius-md);
		border-width: 1px;
	}
	.trioxide_overlay-move-target-default {
		background-color: var(--trioxide_neutral-a2);
	}
	.trioxide_overlay-split-target-default {
		background-color: var(--trioxide_neutral-a2);
	}

	.trioxide_panel-is-move-start-default {
		&::after {
			content: '';
			background-color: var(--trioxide_neutral-a2);
			position: absolute;
			inset: 0;
			z-index: 10;
			width: 100%;
			height: 100%;
			border-radius: var(--radius-md);
			backdrop-filter: blur(var(--blur-sm));
		}
	}

	.trioxide_resizer.w {
		position: relative;
		z-index: 10;
		height: 100%;
		width: var(--gap);
		cursor: col-resize;
		&::after {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			height: 100%;
			width: 12px;
			transform: translateX(-50%);
		}
	}

	.trioxide_resizer.h {
		position: relative;
		z-index: 10;
		height: var(--gap);
		width: 100%;
		cursor: row-resize;
		&::after {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			height: 12px;
			width: 100%;
			transform: translateY(-50%);
		}
	}

	.trioxide_resizer-default {
		border-radius: var(--full);
		outline: 0;
		&:active {
			background-color: var(--trioxide_neutral-7);
		}
		&:focus-visible {
			background-color: var(--trioxide_highlight-7);
		}

		&.w {
			height: calc(100% - 2 * var(--radius-md));
		}
		&.h {
			width: var(100% - 2 * var(--radius-md));
		}
	}

	.trioxide_panel-leaf-default {
		border-color: var(--trioxide_neutral-7);
		background-color: var(--trioxide_neutral-1);
		border-radius: var(--radius-md);
		border-width: 1px;
	}

	.trioxide_panel {
		position: relative;
		display: flex;
		height: var(--h);
		width: var(--w);
		align-items: center;
		justify-content: center;
		&.w {
			flex-direction: row;
		}
		&.h {
			flex-direction: column;
		}
	}

	.trioxide_hotcorner-default {
		outline: 0;
		border-radius: var(--radius-xs);
		cursor: crosshair;
		width: calc(var(--spacing) * 3);
		height: calc(var(--spacing) * 3);
		&:focus-visible {
			background-color: var(--trioxide_highlight-7);
		}
		&:active {
			background-color: transparent;
		}
		&.tl {
			border-top-left-radius: calc(var(--radius-md) - 1px);
		}
		&.tr {
			border-top-right-radius: calc(var(--radius-md) - 1px);
		}
		&.bl {
			border-bottom-left-radius: calc(var(--radius-md) - 1px);
		}
		&.br {
			border-bottom-right-radius: calc(var(--radius-md) - 1px);
		}
	}

	.trioxide_hotcorner {
		position: absolute;
		&.tl {
			top: 0;
			left: 0;
		}
		&.tr {
			top: 0;
			right: 0;
		}
		&.bl {
			bottom: 0;
			left: 0;
		}
		&.br {
			bottom: 0;
			right: 0;
		}
	}
</style>
