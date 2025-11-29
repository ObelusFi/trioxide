<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import { createAttachmentKey, type Attachment } from 'svelte/attachments';
	import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';

	// Base menu types
	export type MenuItemButton = {
		type: 'button';
		content: Snippet | string;
		action: (item: MenuItem) => void;
		props?: HTMLButtonAttributes;
	};

	type MenuItemButtonInternal = MenuItemButton & {
		active?: boolean;
		anchor?: HTMLElement;
	};

	export type MenuItemLabel = {
		type: 'label';
		content: Snippet | string;
		props?: HTMLAttributes<HTMLDivElement>;
	};

	export type MenuItemSeparator = {
		type: 'separator';
		content?: Snippet;
	};

	export type MenuItemSubmenu = {
		type: 'submenu';
		content: Snippet | string;
		menu: MenuInternal;
		props?: HTMLButtonAttributes;
	};

	type MenuItemSubmenuInternal = MenuItemSubmenu & {
		active?: boolean;
		anchor?: HTMLElement;
	};

	export type MenuItem = MenuItemButton | MenuItemLabel | MenuItemSeparator | MenuItemSubmenu;

	type MenuItemInternal =
		| MenuItemButtonInternal
		| MenuItemLabel
		| MenuItemSeparator
		| MenuItemSubmenuInternal;

	type MenuInternal = {
		show?: boolean;
		el?: HTMLElement;
		timeout?: ReturnType<typeof setTimeout>;
		props?: HTMLAttributes<HTMLDivElement>;
		children: MenuItemInternal[];
	};

	export type Menu = {
		children: (MenuItemButton | MenuItemLabel | MenuItemSeparator | MenuItemSubmenu)[];
	};

	// Activable types
	export type ActivableMenuItem = Extract<MenuItemInternal, { type: 'button' | 'submenu' }>;

	export const useContextMenu = (menu: Menu) => ({
		[createAttachmentKey()]: (node: HTMLElement): ReturnType<Attachment<HTMLElement>> => {
			const handle = (e: MouseEvent) => {
				e.preventDefault();
				e.stopImmediatePropagation();

				const pos: [number, number] = [e.clientX, e.clientY];
				window.dispatchEvent(new CustomEvent('set-context', { detail: [menu, pos] }));
			};

			node.addEventListener('contextmenu', handle);

			return () => node.removeEventListener('contextmenu', handle);
		}
	});

	// Global context menu state
	export const activeContextMenu: { menu: MenuInternal } = $state({
		menu: { children: [] }
	});
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let cursorPos: [number, number] = $state([0, 0]);
	let activeMenu: MenuInternal;

	/* -----------------------------
	   Utility helpers
	----------------------------- */

	const isActivable = (item: MenuItem): item is ActivableMenuItem =>
		(item.type === 'button' || item.type === 'submenu') && !item.props?.disabled;

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

	/* -----------------------------
	   Menu Positioning
	----------------------------- */

	function clampToViewport(x: number, y: number, rect: DOMRect): [number, number] {
		return [
			Math.min(x, window.innerWidth - rect.width),
			Math.min(y, window.innerHeight - rect.height)
		];
	}

	const computeRootPosition = (pos: [number, number], menu: MenuInternal): [number, number] => {
		if (!menu.el) return pos;

		const rect = menu.el.getBoundingClientRect();
		return clampToViewport(pos[0], pos[1], rect);
	};

	const computeSubmenuPosition = (anchor: HTMLElement, menu: MenuInternal): [number, number] => {
		if (!menu.el) return [0, 0];

		const a = anchor.getBoundingClientRect();
		const rect = menu.el.getBoundingClientRect();

		let x = a.x + a.width;
		let y = a.y;

		if (x + rect.width > window.innerWidth) x = a.x - rect.width;
		if (y + rect.height > window.innerHeight) y = a.y - rect.height + a.height;

		return [x, y];
	};

	const getPosition = (
		source: [number, number] | HTMLElement,
		menu: MenuInternal
	): [number, number] =>
		Array.isArray(source)
			? computeRootPosition(source, menu)
			: computeSubmenuPosition(source, menu);

	/* -----------------------------
	   Visual state helpers
	----------------------------- */

	const activateItem = (menu: MenuInternal, item: ActivableMenuItem) => {
		menu.children.forEach((c) => isActivable(c) && (c.active = false));
		item.active = true;
		item.anchor?.focus();
	};

	const deactivateItem = (item: ActivableMenuItem) => {
		item.active = false;
		item.anchor?.blur();
	};

	/* -----------------------------
	   Show / Hide Logic
	----------------------------- */

	const showContextMenu = () => {
		if (activeContextMenu.menu.children.length) {
			activeContextMenu.menu.show = true;
			activeMenu = activeContextMenu.menu;
		}
	};

	const hideContextMenu = () => {
		activeContextMenu.menu = {
			show: false,
			children: []
		};
	};

	/* -----------------------------
	   Submenu control
	----------------------------- */

	const showSubMenu = (item: MenuItem) => () => {
		if (item.type !== 'submenu') return;

		if (item.menu.timeout) clearTimeout(item.menu.timeout);

		activateItem(item.menu, item);
		item.menu.show = true;
		activeMenu = item.menu;
	};

	const hideSubMenu =
		(item: MenuItemInternal, delay = 0) =>
		(e: MouseEvent | FocusEvent) => {
			if (item.type !== 'submenu') return;

			const doHide = () => {
				item.menu.show = false;
				activeMenu = activeContextMenu.menu;
				deactivateItem(item);
			};

			if (e instanceof FocusEvent) {
				setTimeout(() => {
					if (
						!item.menu.el?.contains(document.activeElement) &&
						document.activeElement !== item.anchor
					) {
						doHide();
					}
				});
			} else {
				if (delay) {
					item.menu.timeout = setTimeout(doHide, delay);
					return;
				}
				doHide();
			}
		};

	/* -----------------------------
	   Keyboard control
	----------------------------- */

	const getParentMenu = (target: MenuInternal, root = activeContextMenu.menu): MenuInternal => {
		for (const c of root.children) {
			if (c.type === 'submenu' && c.menu === target) return root;
			if (c.type === 'submenu') {
				const found = getParentMenu(target, c.menu);
				if (found) return found;
			}
		}
		return activeContextMenu.menu;
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (!activeContextMenu.menu.show) return;

		const items = activeMenu.children.filter(isActivable);

		switch (e.key) {
			case 'Escape':
				hideContextMenu();
				break;

			case 'ArrowDown':
			case 'ArrowUp': {
				e.preventDefault();
				const dir = e.key === 'ArrowDown' ? 1 : -1;
				let idx = items.findIndex((i) => i.active);
				if (idx === -1) activateItem(activeMenu, items[0]);
				else {
					idx = (idx + dir + items.length) % items.length;
					activateItem(activeMenu, items[idx]);
				}
				break;
			}

			case 'ArrowLeft': {
				if (activeMenu === activeContextMenu.menu) return;

				const parent = getParentMenu(activeMenu);
				const parentItem = parent.children.find(
					(i) => i.type === 'submenu' && i.menu === activeMenu
				) as ActivableMenuItem;

				parentItem.anchor?.focus();
				parentItem.active = true;
				activeMenu.show = false;
				activeMenu = parent;
				break;
			}

			case 'ArrowRight': {
				const idx = items.findIndex((i) => i.active);
				if (items[idx]?.type === 'submenu') showSubMenu(items[idx])();
				break;
			}
		}
	};

	/* -----------------------------
	   Wheel Navigation
	----------------------------- */

	let wheelDelta = 0;
	let lastWheel = 0;
	const SCROLL_THRESHOLD = 24;
	const RESET_DELAY = 60;

	const handleWheel = (e: WheelEvent) => {
		if (!activeContextMenu.menu.show) return;

		e.preventDefault();
		e.stopPropagation();

		const now = Date.now();
		if (now - lastWheel > RESET_DELAY) wheelDelta = 0;
		lastWheel = now;

		wheelDelta = Math.max(Math.min(wheelDelta + e.deltaY, 200), -200);

		const items = activeMenu.children.filter(isActivable);

		let idx = items.findIndex((i) => i.active);

		if (wheelDelta > SCROLL_THRESHOLD) {
			idx = Math.max(idx - 1, 0);
			activateItem(activeMenu, items[idx]);
			wheelDelta = 0;
		} else if (wheelDelta < -SCROLL_THRESHOLD) {
			idx = Math.min(idx + 1, items.length - 1);
			activateItem(activeMenu, items[idx]);
			wheelDelta = 0;
		}
	};

	/* -----------------------------
	   Mouse + Focus handlers
	----------------------------- */

	const handleAction = (item: MenuItem) => (e: Event) => {
		if (item.type !== 'button') return;
		e.stopPropagation();
		e.preventDefault();
		hideContextMenu();
		item.action(item);
	};

	const handleContextMenu = (e: MouseEvent) => {
		e.stopImmediatePropagation();
		cursorPos = [e.clientX, e.clientY];
		showContextMenu();
	};

	const handleFocusTrap = () => {
		if (!activeContextMenu.menu.show) return;

		setTimeout(() => {
			if (!activeMenu.el?.contains(document.activeElement)) {
				const first = activeMenu.children.find(isActivable);
				first?.anchor?.focus();
			}
		}, 10);
	};

	const handleClickOutside = (e: MouseEvent) => {
		if (activeContextMenu.menu.el?.contains(e.target as Node)) return;
		if (activeContextMenu.menu.show) hideContextMenu();
	};

	/* -----------------------------
	   Context menu injection
	----------------------------- */

	const handleSetContext = (ev: Event) => {
		const { detail } = ev as CustomEvent<[MenuInternal, [number, number]]>;
		[activeContextMenu.menu, cursorPos] = detail;
		activeMenu = activeContextMenu.menu;
		activeContextMenu.menu.show = false;
		showContextMenu();
	};

	onMount(() => {
		activeMenu = activeContextMenu.menu;

		window.addEventListener('wheel', handleWheel, { passive: false });
		window.addEventListener('set-context', handleSetContext);
		window.addEventListener('mousedown', handleClickOutside, true);

		return () => {
			window.removeEventListener('wheel', handleWheel);
			window.removeEventListener('set-context', handleSetContext);
			window.removeEventListener('mousedown', handleClickOutside);
		};
	});
</script>

<svelte:window
	oncontextmenu={handleContextMenu}
	onkeydown={handleKeydown}
	onfocusin={handleFocusTrap}
/>

{#snippet Menu(menu: MenuInternal, at: [number, number] | HTMLElement)}
	{@const pos = getPosition(at, menu)}

	<div
		class="trioxide_menu {menu.props?.class || 'trioxide_menu_default'}"
		{...omit(menu.props, 'class')}
		style:--x="{pos[0]}px"
		style:--y="{pos[1]}px"
		class:trioxide_hide={!activeContextMenu.menu.show || !menu.show}
		bind:this={menu.el}
	>
		{#each menu.children as item}
			{#if item.type === 'button'}
				<button
					class="trioxide_action {item.props?.class || 'trioxide_action-default'}"
					class:trioxide_active={item.active}
					onmouseenter={() => activateItem(menu, item)}
					onmouseleave={() => deactivateItem(item)}
					onfocus={() => activateItem(menu, item)}
					onmousedown={(e) => e.preventDefault()}
					onkeydown={(e) => e.key === 'Enter' && handleAction(item)(e)}
					onclick={handleAction(item)}
					bind:this={item.anchor}
					{...omit(item.props, 'class')}
				>
					{#if typeof item.content === 'string'}
						{item.content}
					{:else}
						{@render item.content()}
					{/if}
				</button>
			{:else if item.type === 'separator'}
				<div class="trioxide_separator">
					{@render item.content?.()}
				</div>
			{:else if item.type === 'label'}
				<div
					class="trioxide_label {item.props?.class?.toString() || 'trioxide_label-default'}"
					{...omit(item.props, 'class')}
				>
					{#if typeof item.content === 'string'}
						{item.content}
					{:else}
						{@render item.content()}
					{/if}
				</div>
			{:else if item.type === 'submenu'}
				<button
					class="trioxide_action {item.props?.class || 'trioxide_action-default'}"
					class:trioxide_active={item.active}
					onmouseenter={showSubMenu(item)}
					onmouseleave={hideSubMenu(item)}
					onfocus={() => activateItem(menu, item)}
					onfocusout={hideSubMenu(item)}
					onkeydown={(e) => e.key === 'Enter' && showSubMenu(item)()}
					onmousedown={(e) => e.preventDefault()}
					bind:this={item.anchor}
					{...omit(item.props, 'class')}
				>
					{#if typeof item.content === 'string'}
						{item.content}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							height="1rem"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path
								d="M13.1717 12.0007L8.22192 7.05093L9.63614 5.63672L16.0001 12.0007L9.63614 18.3646L8.22192 16.9504L13.1717 12.0007Z"
							/>
						</svg>
					{:else}
						{@render item.content()}
					{/if}

					{@render Menu(item.menu, item.anchor)}
				</button>
			{/if}
		{/each}
	</div>
{/snippet}

{#if activeContextMenu.menu.show}
	{@render Menu(activeContextMenu.menu, cursorPos)}
{/if}

<style>
	.trioxide_hide {
		visibility: hidden;
	}
	.trioxide_separator {
		height: 1px;
		border-radius: var(--rounded-full);
		background-color: var(--trioxide_neutral-6);
	}
	.trioxide_label {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding-inline: calc(var(--spacing) * 2);
		text-align: start;
	}
	.trioxide_menu {
		position: fixed;
		left: var(--x);
		top: var(--y);
		z-index: 50;
		display: flex;
		flex-direction: column;
	}

	.trioxide_menu_default {
		min-width: var(--container-3xs);
		border-radius: var(--radius-md);
		border-width: 1px;
		border-color: var(--trioxide_neutral-6);
		font-size: var(--text-sm);
		background-color: var(--trioxide_neutral-1);
	}

	.trioxide_label-default {
		font-size: smaller;
		color: var(--trioxide_neutral-9);
	}

	.trioxide_action-default {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: var(--radius-xs);
		padding-inline: calc(var(--spacing) * 2);
		padding-block: calc(var(--spacing) * 1);
		text-align: start;
		outline: 0;

		&:last-child {
			border-bottom-left-radius: var(--radius-md);
			border-bottom-right-radius: var(--radius-md);
		}

		&:first-child {
			border-top-left-radius: var(--radius-md);
			border-top-right-radius: var(--radius-md);
		}

		&:disabled {
			opacity: 30%;
		}
		&.trioxide_active {
			background-color: var(--trioxide_neutral-2);
		}
	}
</style>
