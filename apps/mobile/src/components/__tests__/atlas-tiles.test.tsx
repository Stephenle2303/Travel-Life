import { visibleAtlasTiles } from '@/atlas/visible-tiles';
import { fittedSize, WORLD_VIEW } from '@/atlas/viewport';
import { projectWorldPoint } from '@/atlas/world-projection';
import { ATLAS_TILES } from '@/atlas/tile-assets';
import { fireEvent, render } from '@testing-library/react-native';
import { LocalAtlasMap } from '@/components/local-atlas-map';

describe('offline multiresolution cartography', () => {
  const size = { width: 390, height: 430 };
  it('uses the base at world fit and higher source resolution as zoom or density increases', () => {
    expect(visibleAtlasTiles(size, WORLD_VIEW, 3)).toEqual([]);
    expect(visibleAtlasTiles(size, { ...WORLD_VIEW, scale: 4 }, 2)[0].level).toBe(4096);
    expect(visibleAtlasTiles(size, { ...WORLD_VIEW, scale: 4 }, 3)[0].level).toBe(8192);
    expect(visibleAtlasTiles(size, { ...WORLD_VIEW, scale: 32 }, 3)[0].level).toBe(16384);
  });
  it('keeps visible decode residency bounded while exploring Vietnam at deep zoom', () => {
    const point = projectWorldPoint(106.7, 10.8)!;
    const fit = fittedSize(size);
    const view = { scale: 64, x: (.5-point.x)*fit.width*64, y: (.5-point.y)*fit.height*64 };
    const tiles = visibleAtlasTiles(size, view, 3);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(9);
    for (const tile of tiles) {
      expect(ATLAS_TILES[tile.level][`${tile.col}:${tile.row}`]).toBeDefined();
      expect(tile.col).toBeGreaterThanOrEqual(0);
      expect(tile.col).toBeLessThan(32);
      expect(tile.row).toBeLessThan(20);
      // Overlay coordinates and tile origin use the same full-world transform.
      const originX = (size.width-fit.width*64)/2+view.x;
      expect(tile.left).toBeCloseTo(originX+tile.col/32*fit.width*64);
    }
  });
  it('never selects offscreen cells or invalid registry keys at world edges', () => {
    for (const scale of [2,4,8,16,32,64]) {
      for (const x of [-10000,0,10000]) {
        const tiles = visibleAtlasTiles(size, { scale, x, y: 0 }, 3);
        expect(tiles.length).toBeLessThanOrEqual(48);
        for (const tile of tiles) {
          expect(tile.left).toBeLessThanOrEqual(size.width);
          expect(tile.left+tile.size).toBeGreaterThan(0);
        }
      }
    }
  });
  it('caps decode candidates on unusually dense or large screens', () => {
    for (const width of [350,640,1200]) {
      for (const density of [3,4,6]) {
        for (const scale of [1,1.5,2,3,8,16,64]) {
          expect(visibleAtlasTiles({width,height:430},{scale,x:0,y:0},density).length).toBeLessThanOrEqual(48);
        }
      }
    }
  });
  it('mounts only the visible detail tiles and retains the base if a detail decode fails', async () => {
    const point = projectWorldPoint(106.7,10.8)!;
    const fit = fittedSize(size);
    const view = { scale:64, x:(.5-point.x)*fit.width*64, y:(.5-point.y)*fit.height*64 };
    const screen = await render(<LocalAtlasMap journeys={[]} selectedJourneyId={null} initialViewport={view} onChoose={jest.fn()} onGestureChange={jest.fn()} />);
    await fireEvent(screen.getByTestId('local-atlas-canvas'),'layout',{nativeEvent:{layout:size}});
    const tiles = screen.getAllByTestId(/^atlas-tile-/);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(9);
    expect(tiles[0].props.testID).toMatch(/16384/);
    await fireEvent(tiles[0],'error',{nativeEvent:{error:'Synthetic decode failure'}});
    expect(screen.getAllByTestId(/^atlas-tile-/)).toHaveLength(tiles.length-1);
    expect(screen.getByTestId('atlas-image-plane')).toBeOnTheScreen();
  });
});
