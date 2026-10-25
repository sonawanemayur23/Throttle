// Icons and title scenes from src/art/ui (Claude Design, Prompt 8), as data
// URLs. Used by the touch controls here in the app layer and by the menus.
// Icons are 128 x 128, white with a dark outline and one accent color.

const raw = import.meta.glob('../art/ui/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const urls = new Map<string, string>();
for (const [path, svg] of Object.entries(raw)) {
  const name = (path.split('/').pop() as string).replace(/\.svg$/, '');
  urls.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

export type IconName =
  | 'punch'
  | 'kick'
  | 'brake'
  | 'club'
  | 'chain'
  | 'pause'
  | 'sound-on'
  | 'sound-off'
  | 'police'
  | 'trophy'
  | 'cash'
  | 'lock';

export const iconUrl = (name: IconName) => urls.get(`icon-${name}`) ?? '';

/** Title scene: 'wide' is 1920 x 1080, 'tall' is 1080 x 1920. Top third is left clear for the logo. */
export const titleUrl = (shape: 'wide' | 'tall') => urls.get(`title-${shape}`) ?? '';

/** Put an icon and a short label inside a button, replacing its text. */
export function setButtonIcon(btn: Element | null, name: IconName, label?: string) {
  if (!btn) return;
  btn.replaceChildren();
  const img = document.createElement('img');
  img.src = iconUrl(name);
  img.alt = '';
  img.className = 'ico';
  img.draggable = false;
  btn.append(img);
  if (label) {
    const span = document.createElement('span');
    span.textContent = label;
    btn.append(span);
  }
}
