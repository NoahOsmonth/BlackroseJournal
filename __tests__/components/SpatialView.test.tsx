import { getSpatialFrame } from '../../components/ui/SpatialView';

describe('getSpatialFrame', () => {
    it('returns Android-safe primitive transform values', () => {
        const frame = getSpatialFrame(0);

        expect(frame).toEqual({
            opacity: 0,
            translateY: 35,
            scale: 0.94,
            rotateX: -6,
        });
    });

    it('formats visible state without object transform payloads', () => {
        const frame = getSpatialFrame(1);
        const rotateX = `${frame.rotateX}deg`;

        expect(frame.translateY).toBe(0);
        expect(frame.scale).toBe(1);
        expect(rotateX).toBe('0deg');
        expect(rotateX).not.toContain('[object Object]');
    });
});
