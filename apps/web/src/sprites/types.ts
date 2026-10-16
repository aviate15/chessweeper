/** A sprite is equal-length rows of palette keys; "." is transparent. */
export type Sprite = readonly string[];
export type Palette = Readonly<Record<string, string>>;

export interface SpriteEntry {
  readonly name: string;
  readonly sprite: Sprite;
  /** Palette override (e.g. LED colour variants). Defaults to PALETTE. */
  readonly palette?: Palette;
}

export interface SpriteGroup {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly SpriteEntry[];
}
