# T Poker — Apple App Store screenshot package (iPhone)

Dedicated, App-Store-ready iPhone screenshot package. Generated **June 17, 2026**
from the existing production captures (no app/production code touched).

```
assets/store/ios/
├── iphone-65/   # iPhone 6.5" — 1242 × 2688 px  (generated — primary upload set)
├── iphone-67/   # iPhone 6.7" — 1290 × 2796 px  (existing production captures)
└── source/      # 6.7" originals used as the resize source (1290 × 2796 px)
```

## Apple dimensions

| Slot | Required px | Folder | Status |
|------|-------------|--------|--------|
| iPhone 6.5" (XS Max / 11 Pro Max / XR / 11) | **1242 × 2688** (portrait) | `iphone-65/` | ✅ generated |
| iPhone 6.7" (14/15/16 Pro Max) | 1290 × 2796 (portrait) | `iphone-67/` | ✅ present |

Apple accepts 1242 × 2688 **or** 1284 × 2778 for the 6.5" slot; this package uses
1242 × 2688. Min 1 / max 10 screenshots per slot — we ship 6.

## Source screenshots

`source/` and `iphone-67/` hold the six production captures (1290 × 2796), originally
produced by the Playwright harness `store-shots.js` against the exported web bundle
(`apps/poker-mobile/dist`). They mirror `apps/poker-mobile/store-assets/screenshots/ios-6.7/`.

## Generated screenshots (`iphone-65/`, 1242 × 2688)

| File | Screen | Content theme |
|------|--------|---------------|
| `01-home.png` | Guest home | Cash Game / Tournament entry cards |
| `02-tournament-live.png` | Tournament dashboard | Blind clock, prize pool, players (tournament management) |
| `03-tournament-podium.png` | Tournament complete | Medals, payouts, confetti (tournament management) |
| `04-final-count.png` | The Final Count | End-of-session chip count / settlement step |
| `05-cash-summary.png` | Game Over | Results + cash settlements |
| `06-stats.png` | Stats | Table statistics |

## Generation commands

The 6.5" set is derived from the 6.7" sources with a **uniform "cover" scale + center
crop** (aspect ratio preserved exactly; no stretching, no black bars). 6.7"
(1290 × 2796, AR 0.4614) → 6.5" (1242 × 2688, AR 0.4621): scale to fill width 1242
(→ 1242 × 2692), then center-crop 4 px of height. Re-run from repo root:

```powershell
Add-Type -AssemblyName System.Drawing
$srcDir = "assets\store\ios\source"; $outDir = "assets\store\ios\iphone-65"
$TW = 1242; $TH = 2688
foreach ($f in Get-ChildItem $srcDir -Filter *.png) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $scale = [Math]::Max($TW/$img.Width, $TH/$img.Height)
  $sw = [int][Math]::Round($img.Width*$scale); $sh = [int][Math]::Round($img.Height*$scale)
  $ox = [int][Math]::Round(($TW-$sw)/2); $oy = [int][Math]::Round(($TH-$sh)/2)
  $bmp = New-Object System.Drawing.Bitmap($TW,$TH,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle($ox,$oy,$sw,$sh)))
  $bmp.Save((Join-Path $outDir $f.Name),[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
```

**Alternative — native capture (sharpest, optional).** 6.5" = 414 × 896 logical points
@ scale 3 = 1242 × 2688 exactly. Add a profile to `store-shots.js`:
`{ name: 'ios-6.5', width: 414, height: 896, scale: 3 }`, rebuild the web bundle
(`npx expo export -p web`), and run the harness to capture natively instead of resizing.

## App Store Connect upload instructions

1. App Store Connect → **My Apps → T Poker → (version) → App Store → Previews and
   Screenshots**.
2. Select the **iPhone 6.5" Display** size in the device dropdown.
3. Drag all six `iphone-65/*.png` in order (01 → 06). First image is the listing hero.
4. (Optional) Select **iPhone 6.7" Display** and upload `iphone-67/*.png` for that slot.
5. Save. Localized per-language if you add locales (English only today).

> Positioning note: keep captions/category framing consistent with
> `docs/store-release.md` — scorekeeping tool, not gambling (Lifestyle/Utilities).
