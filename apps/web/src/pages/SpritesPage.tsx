import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import type { ReactNode } from "react";
import "../sprites/sprites.css";
import {
  BUTTON_PRESSED,
  BUTTON_UP,
  DIALOG_SAMPLE,
  FACE_NORMAL,
  LED_AMBER,
  LED_DIGITS,
  LED_GREEN,
  LED_KEYS,
  NUMBER_SPRITES,
  OVERLAY_CHECK,
  OVERLAY_LAST_MOVE,
  OVERLAY_LEGAL_DOT,
  OVERLAY_SELECTED,
  PALETTE,
  PIECE_ORDER,
  PIECE_SPRITES,
  FLAG,
  SPRITE_GROUPS,
  SWATCH_GROUPS,
  TILE_CRATER,
  TILE_HIDDEN_DARK,
  TILE_HIDDEN_LIGHT,
  TILE_REVEALED,
  EXPLOSION_FRAMES,
  MINE,
  MINE_EXPLODED,
} from "../sprites";
import { SpriteImg, SpriteStack } from "../sprites/SpriteImg";
import type { Palette, Sprite } from "../sprites";

const SCALES = [1, 2, 3] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="sprites-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}

/** One sprite (optionally over base layers) at 1x, 2x and 3x. */
function Scales({
  name,
  layers,
  palette,
}: {
  name: string;
  layers: readonly Sprite[];
  palette?: Palette;
}) {
  return (
    <figure className="sprites-item" style={{ margin: 0 }} data-sprite={name}>
      <div className="sprites-scales">
        {SCALES.map((scale) =>
          layers.length === 1 && layers[0] ? (
            <SpriteImg
              key={scale}
              sprite={layers[0]}
              palette={palette}
              scale={scale}
              label={name}
            />
          ) : (
            <SpriteStack key={scale} layers={layers} scale={scale} label={name} />
          ),
        )}
      </div>
      <figcaption className="sprites-caption">{name}</figcaption>
    </figure>
  );
}

function LedNumber({ text, palette, scale }: { text: string; palette: Palette; scale: number }) {
  return (
    <div className="sprites-led" role="img" aria-label={`LED ${text}`}>
      {text.split("").map((ch, i) => (
        <SpriteImg key={i} sprite={LED_DIGITS[ch] ?? []} palette={palette} scale={scale} />
      ))}
    </div>
  );
}

const TILE_ROWS: readonly { key: string; side: "w" | "b"; tile: Sprite }[] = [
  { key: "White on light", side: "w", tile: TILE_HIDDEN_LIGHT },
  { key: "White on dark", side: "w", tile: TILE_HIDDEN_DARK },
  { key: "Black on light", side: "b", tile: TILE_HIDDEN_LIGHT },
  { key: "Black on dark", side: "b", tile: TILE_HIDDEN_DARK },
];

function SampleBoard({ scale }: { scale: number }) {
  const size = 16 * scale;
  const n = (i: number): Sprite => NUMBER_SPRITES[i] ?? [];
  const cells: Sprite[][] = [
    [TILE_HIDDEN_DARK, PIECE_SPRITES.bn],
    [TILE_HIDDEN_LIGHT, FLAG],
    [TILE_REVEALED, n(0)],
    [TILE_REVEALED, n(2)],
    [TILE_HIDDEN_LIGHT, PIECE_SPRITES.bk, OVERLAY_CHECK],
    [TILE_REVEALED, n(1), OVERLAY_LAST_MOVE],
    [TILE_CRATER],
    [TILE_HIDDEN_LIGHT, OVERLAY_LEGAL_DOT],
    [TILE_REVEALED, PIECE_SPRITES.wq, OVERLAY_SELECTED],
    [TILE_HIDDEN_DARK, PIECE_SPRITES.wp],
    [TILE_REVEALED, MINE_EXPLODED],
    [TILE_REVEALED, n(3)],
    [TILE_HIDDEN_LIGHT, OVERLAY_LEGAL_DOT],
    [TILE_REVEALED, PIECE_SPRITES.wr, OVERLAY_LAST_MOVE],
    [TILE_HIDDEN_DARK, FLAG],
    [TILE_REVEALED, n(4)],
  ];
  return (
    <div
      className="sprites-grid"
      style={{ gridTemplateColumns: `repeat(4, ${String(size)}px)` }}
      data-testid={`sample-board-${String(scale)}x`}
    >
      {cells.map((layers, i) => (
        <SpriteStack key={i} layers={layers} scale={scale} label={`cell ${String(i + 1)}`} />
      ))}
    </div>
  );
}

export function SpritesPage() {
  const group = (id: string) => SPRITE_GROUPS.find((g) => g.id === id)?.entries ?? [];
  return (
    <main className="sprites-page">
      <h1>Chessweeper style tile</h1>

      <Section id="pieces" title="Pieces (white and black, light and dark tile)">
        {SCALES.map((scale) => (
          <div key={scale} style={{ marginBottom: 12 }}>
            <div className="sprites-caption">{String(scale)}x</div>
            {TILE_ROWS.map((row) => (
              <div key={row.key} className="sprites-row" style={{ gap: 0 }}>
                {PIECE_ORDER.map((kind) => (
                  <SpriteStack
                    key={kind}
                    layers={[row.tile, PIECE_SPRITES[`${row.side}${kind}`]]}
                    scale={scale}
                    label={`${row.key} ${kind}`}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </Section>

      <Section id="tiles" title="Tile states">
        <div className="sprites-row">
          {group("tiles").map((entry) => {
            const isOverlay =
              entry.name !== "Hidden light" &&
              entry.name !== "Hidden dark" &&
              entry.name !== "Revealed" &&
              entry.name !== "Crater";
            return (
              <Scales
                key={entry.name}
                name={entry.name}
                layers={isOverlay ? [TILE_HIDDEN_LIGHT, entry.sprite] : [entry.sprite]}
              />
            );
          })}
        </div>
      </Section>

      <Section id="numbers" title="Numbers on a revealed tile">
        <div className="sprites-row">
          {NUMBER_SPRITES.map((sprite, i) => (
            <Scales key={i} name={String(i + 1)} layers={[TILE_REVEALED, sprite]} />
          ))}
        </div>
      </Section>

      <Section id="marks" title="Flag, mine, crater, explosion, king lives">
        <div className="sprites-row">
          <Scales name="Flag on hidden" layers={[TILE_HIDDEN_LIGHT, FLAG]} />
          <Scales name="Mine" layers={[TILE_REVEALED, MINE]} />
          <Scales name="Exploded mine" layers={[MINE_EXPLODED]} />
          <Scales name="Crater" layers={[TILE_CRATER]} />
          {EXPLOSION_FRAMES.map((frame, i) => (
            <Scales key={i} name={`Explosion ${String(i + 1)}`} layers={[TILE_REVEALED, frame]} />
          ))}
          {group("marks")
            .filter((e) => e.name.startsWith("Life"))
            .map((e) => (
              <Scales key={e.name} name={e.name} layers={[e.sprite]} />
            ))}
        </div>
      </Section>

      <Section id="smileys" title="Smileys">
        <div className="sprites-row">
          {group("smileys").map((e) => (
            <Scales key={e.name} name={e.name} layers={[e.sprite]} />
          ))}
        </div>
      </Section>

      <Section id="led" title="LED digits">
        <div className="sprites-row">
          {SCALES.map((scale) => (
            <div key={scale} className="sprites-item">
              <LedNumber text="042" palette={PALETTE} scale={scale} />
              <LedNumber text="042" palette={LED_GREEN} scale={scale} />
              <LedNumber text="042" palette={LED_AMBER} scale={scale} />
              <span className="sprites-caption">{String(scale)}x red / green / amber</span>
            </div>
          ))}
        </div>
        <div className="sprites-row" style={{ marginTop: 8 }}>
          <LedNumber text={LED_KEYS.join("")} palette={PALETTE} scale={1} />
          <LedNumber text="-09" palette={PALETTE} scale={2} />
        </div>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="sprites-row">
          {[
            { name: "Up", sprite: BUTTON_UP, nudge: 0 },
            { name: "Pressed", sprite: BUTTON_PRESSED, nudge: 1 },
          ].map((b) => (
            <div key={b.name} className="sprites-item">
              <div className="sprites-scales">
                {SCALES.map((scale) => (
                  <div key={scale} style={{ position: "relative" }}>
                    <SpriteImg
                      sprite={b.sprite}
                      scale={scale}
                      label={`Button ${b.name} ${String(scale)}x`}
                    />
                    <span
                      className="sprites-button-label"
                      style={{
                        fontSize: 8 * scale,
                        transform: `translate(${String(b.nudge * scale)}px, ${String(b.nudge * scale)}px)`,
                      }}
                    >
                      Reset
                    </span>
                  </div>
                ))}
              </div>
              <span className="sprites-caption">{b.name}</span>
            </div>
          ))}
          <Scales name="Face button (normal)" layers={[FACE_NORMAL]} />
        </div>
      </Section>

      <Section id="dialog" title="Dialog chrome">
        <div className="sprites-row">
          {SCALES.map((scale) => (
            <div key={scale} className="sprites-item">
              <div style={{ position: "relative" }}>
                <SpriteImg
                  sprite={DIALOG_SAMPLE}
                  scale={scale}
                  label={`Sample dialog ${String(scale)}x`}
                />
                <span
                  className="sprites-dialog-title"
                  style={{ left: 6 * scale, top: 4 * scale, fontSize: 8 * scale }}
                >
                  Game over
                </span>
              </div>
              <span className="sprites-caption">{String(scale)}x</span>
            </div>
          ))}
        </div>
        <div className="sprites-row" style={{ marginTop: 8 }}>
          {group("dialog")
            .filter((e) => e.name !== "Sample dialog")
            .map((e) => (
              <Scales key={e.name} name={e.name} layers={[e.sprite]} />
            ))}
        </div>
      </Section>

      <Section id="icons" title="Icons and favicon">
        <div className="sprites-row">
          {group("icons").map((e) => (
            <Scales key={e.name} name={e.name} layers={[e.sprite]} />
          ))}
        </div>
      </Section>

      <Section id="palette" title="Palette">
        {SWATCH_GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 8 }}>
            <div className="sprites-caption">{g.title}</div>
            <div className="sprites-swatches">
              {g.keys.map((key) => (
                <div key={key} className="sprites-swatch" data-swatch={key}>
                  <i style={{ background: PALETTE[key] }} />
                  <span>
                    {key} {PALETTE[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section id="board" title="Sample board corner (4x4)">
        <div className="sprites-row">
          {SCALES.map((scale) => (
            <SampleBoard key={scale} scale={scale} />
          ))}
        </div>
      </Section>
    </main>
  );
}

export default SpritesPage;
